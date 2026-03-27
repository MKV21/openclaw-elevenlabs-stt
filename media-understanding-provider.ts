import path from "node:path";
import type {
  AudioTranscriptionRequest,
  AudioTranscriptionResult,
  MediaUnderstandingProvider,
} from "openclaw/plugin-sdk/media-understanding";
import {
  assertOkOrThrowHttpError,
  normalizeBaseUrl,
  postTranscriptionRequest,
  requireTranscriptionText,
} from "./provider-http-lite.js";

export const ELEVENLABS_DEFAULT_AUDIO_BASE_URL = "https://api.elevenlabs.io/v1";
export const ELEVENLABS_DEFAULT_AUDIO_TRANSCRIPTION_MODEL = "scribe_v2";

type ElevenLabsTranscriptionResponse = {
  text?: string;
};

function resolveModel(model: string | undefined, fallback: string): string {
  const trimmed = model?.trim();
  return trimmed || fallback;
}

function buildAudioBlob(params: Pick<AudioTranscriptionRequest, "buffer" | "mime">): Blob {
  const bytes = new Uint8Array(params.buffer);
  return new Blob([bytes], {
    type: params.mime ?? "application/octet-stream",
  });
}

function resolveFileName(fileName: string | undefined): string {
  const trimmed = fileName?.trim();
  if (!trimmed) {
    return "audio";
  }
  return path.basename(trimmed) || "audio";
}

export async function transcribeElevenLabsAudio(
  params: AudioTranscriptionRequest,
): Promise<AudioTranscriptionResult> {
  const fetchFn = params.fetchFn ?? fetch;
  const baseUrl = normalizeBaseUrl(params.baseUrl, ELEVENLABS_DEFAULT_AUDIO_BASE_URL);
  const url = `${baseUrl}/speech-to-text`;
  const model = resolveModel(params.model, ELEVENLABS_DEFAULT_AUDIO_TRANSCRIPTION_MODEL);

  const form = new FormData();
  form.append("file", buildAudioBlob(params), resolveFileName(params.fileName));
  form.append("model_id", model);
  if (params.language?.trim()) {
    form.append("language_code", params.language.trim());
  }

  const headers = new Headers(params.headers);
  if (!headers.has("xi-api-key")) {
    headers.set("xi-api-key", params.apiKey);
  }

  const res = await postTranscriptionRequest({
    url,
    headers,
    body: form,
    timeoutMs: params.timeoutMs,
    fetchFn,
  });

  await assertOkOrThrowHttpError(res, "ElevenLabs audio transcription failed");

  const payload = (await res.json()) as ElevenLabsTranscriptionResponse;
  const text = requireTranscriptionText(
    payload.text,
    "ElevenLabs audio transcription response missing text",
  );

  return { text, model };
}

export const elevenlabsMediaUnderstandingProvider: MediaUnderstandingProvider = {
  id: "elevenlabs",
  capabilities: ["audio"],
  transcribeAudio: transcribeElevenLabsAudio,
};
