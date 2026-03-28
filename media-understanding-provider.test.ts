import { describe, expect, it, vi } from "vitest";
import plugin from "./index.js";
import {
  ELEVENLABS_DEFAULT_AUDIO_TRANSCRIPTION_MODEL,
  elevenlabsMediaUnderstandingProvider,
  transcribeElevenLabsAudio,
} from "./media-understanding-provider.js";

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function createRequestCaptureJsonFetch(responseBody: unknown, status = 200) {
  let seenUrl: string | null = null;
  let seenInit: RequestInit | undefined;

  const fetchFn: typeof fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    seenUrl = resolveRequestUrl(input);
    seenInit = init;
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { "content-type": "application/json" },
    });
  });

  return {
    fetchFn,
    getRequest: () => ({ url: seenUrl, init: seenInit }),
  };
}

describe("elevenlabs plugin entry", () => {
  it("registers the media-understanding provider", () => {
    const registerMediaUnderstandingProvider = vi.fn();

    plugin.register({
      registerMediaUnderstandingProvider,
    } as unknown as Parameters<typeof plugin.register>[0]);

    expect(plugin.id).toBe("elevenlabs-stt");
    expect(registerMediaUnderstandingProvider).toHaveBeenCalledTimes(1);
    expect(registerMediaUnderstandingProvider).toHaveBeenCalledWith(
      elevenlabsMediaUnderstandingProvider,
    );
  });
});

describe("transcribeElevenLabsAudio", () => {
  it("builds the expected multipart request and returns transcript text", async () => {
    const { fetchFn, getRequest } = createRequestCaptureJsonFetch({
      text: "Hello world",
    });

    const result = await transcribeElevenLabsAudio({
      buffer: Buffer.from("audio-bytes"),
      fileName: "voice.wav",
      apiKey: "test-key",
      timeoutMs: 1234,
      baseUrl: "https://example.com/v1/",
      model: " scribe_v2 ",
      mime: "audio/wav",
      fetchFn,
    });

    const { url, init } = getRequest();
    expect(result).toEqual({ text: "Hello world", model: "scribe_v2" });
    expect(url).toBe("https://example.com/v1/speech-to-text");
    expect(init?.method).toBe("POST");
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    const headers = new Headers(init?.headers);
    expect(headers.get("xi-api-key")).toBe("test-key");

    const form = init?.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("model_id")).toBe("scribe_v2");
    expect(form.get("language_code")).toBeNull();

    const file = form.get("file") as Blob | { type?: string; name?: string } | null;
    expect(file).not.toBeNull();
    if (file) {
      expect(file.type).toBe("audio/wav");
      if ("name" in file && typeof file.name === "string") {
        expect(file.name).toBe("voice.wav");
      }
    }
  });

  it("passes language_code when language is configured", async () => {
    const { fetchFn, getRequest } = createRequestCaptureJsonFetch({
      text: "Hello world",
    });

    await transcribeElevenLabsAudio({
      buffer: Buffer.from("audio-bytes"),
      fileName: "voice.wav",
      apiKey: "test-key",
      timeoutMs: 1234,
      language: " en ",
      fetchFn,
    });

    const form = getRequest().init?.body as FormData;
    expect(form.get("language_code")).toBe("en");
  });

  it("passes supported scalar ElevenLabs form options from providerOptions", async () => {
    const { fetchFn, getRequest } = createRequestCaptureJsonFetch({
      text: "Hello world",
    });

    await transcribeElevenLabsAudio({
      buffer: Buffer.from("audio-bytes"),
      fileName: "voice.wav",
      apiKey: "test-key",
      timeoutMs: 1234,
      fetchFn,
      query: {
        tag_audio_events: true,
        no_verbatim: false,
        diarize: true,
        num_speakers: 2,
        diarization_threshold: 0.22,
        use_multi_channel: true,
        timestamps_granularity: "word",
        entity_detection: "pii",
        redact: "pii",
        entity_redaction: "entity_type",
        temperature: 0,
        seed: 42,
        file_format: "other",
        keyterms: "hello,world",
        additional_formats: "srt",
        ignored_option: true,
      },
    });

    const { url, init } = getRequest();
    expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");

    const form = init?.body as FormData;
    expect(form.get("tag_audio_events")).toBe("true");
    expect(form.get("no_verbatim")).toBe("false");
    expect(form.get("diarize")).toBe("true");
    expect(form.get("num_speakers")).toBe("2");
    expect(form.get("diarization_threshold")).toBe("0.22");
    expect(form.get("use_multi_channel")).toBe("true");
    expect(form.get("timestamps_granularity")).toBe("word");
    expect(form.get("entity_detection")).toBe("pii");
    expect(form.get("redact")).toBe("pii");
    expect(form.get("entity_redaction")).toBe("entity_type");
    expect(form.get("temperature")).toBe("0");
    expect(form.get("seed")).toBe("42");
    expect(form.get("file_format")).toBe("other");
    expect(form.get("keyterms")).toBeNull();
    expect(form.get("additional_formats")).toBeNull();
    expect(form.get("ignored_option")).toBeNull();
  });

  it("uses the default model when the configured model is blank", async () => {
    const { fetchFn, getRequest } = createRequestCaptureJsonFetch({
      text: "Hello world",
    });

    const result = await transcribeElevenLabsAudio({
      buffer: Buffer.from("audio-bytes"),
      fileName: "voice.wav",
      apiKey: "test-key",
      timeoutMs: 1234,
      model: " ",
      fetchFn,
    });

    const form = getRequest().init?.body as FormData;
    expect(form.get("model_id")).toBe(ELEVENLABS_DEFAULT_AUDIO_TRANSCRIPTION_MODEL);
    expect(result.model).toBe(ELEVENLABS_DEFAULT_AUDIO_TRANSCRIPTION_MODEL);
  });

  it("throws on non-2xx upstream responses", async () => {
    const { fetchFn } = createRequestCaptureJsonFetch(
      {
        detail: "rate limited",
      },
      429,
    );

    await expect(
      transcribeElevenLabsAudio({
        buffer: Buffer.from("audio-bytes"),
        fileName: "voice.wav",
        apiKey: "test-key",
        timeoutMs: 1234,
        fetchFn,
      }),
    ).rejects.toThrow("ElevenLabs audio transcription failed (HTTP 429)");
  });

  it("throws when the provider response omits text", async () => {
    const { fetchFn } = createRequestCaptureJsonFetch({});

    await expect(
      transcribeElevenLabsAudio({
        buffer: Buffer.from("audio-bytes"),
        fileName: "voice.wav",
        apiKey: "test-key",
        timeoutMs: 1234,
        fetchFn,
      }),
    ).rejects.toThrow("ElevenLabs audio transcription response missing text");
  });

  it("throws when the provider response contains only blank text", async () => {
    const { fetchFn } = createRequestCaptureJsonFetch({ text: "   " });

    await expect(
      transcribeElevenLabsAudio({
        buffer: Buffer.from("audio-bytes"),
        fileName: "voice.wav",
        apiKey: "test-key",
        timeoutMs: 1234,
        fetchFn,
      }),
    ).rejects.toThrow("ElevenLabs audio transcription response missing text");
  });
});
