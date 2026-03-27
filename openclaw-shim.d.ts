declare module "openclaw/plugin-sdk/media-understanding" {
  export type MediaUnderstandingCapability = "image" | "audio" | "video";

  export type AudioTranscriptionRequest = {
    buffer: Buffer;
    fileName: string;
    mime?: string;
    apiKey: string;
    baseUrl?: string;
    headers?: Record<string, string>;
    model?: string;
    language?: string;
    prompt?: string;
    query?: Record<string, string | number | boolean>;
    timeoutMs: number;
    fetchFn?: typeof fetch;
  };

  export type AudioTranscriptionResult = {
    text: string;
    model?: string;
  };

  export type MediaUnderstandingProvider = {
    id: string;
    capabilities?: MediaUnderstandingCapability[];
    transcribeAudio?: (
      req: AudioTranscriptionRequest,
    ) => Promise<AudioTranscriptionResult>;
  };
}

declare module "openclaw/plugin-sdk/plugin-entry" {
  import type { MediaUnderstandingProvider } from "openclaw/plugin-sdk/media-understanding";

  export type OpenClawPluginApi = {
    registerMediaUnderstandingProvider(provider: MediaUnderstandingProvider): void;
  };

  export function definePluginEntry(params: {
    id: string;
    name: string;
    description: string;
    register: (api: OpenClawPluginApi) => void;
  }): {
    id: string;
    name: string;
    description: string;
    register(api: OpenClawPluginApi): void;
  };
}

declare module "openclaw/plugin-sdk/provider-http" {
  export function normalizeBaseUrl(baseUrl: string | undefined, fallback: string): string;
  export function assertOkOrThrowHttpError(res: Response, label: string): Promise<void>;
  export function requireTranscriptionText(
    value: string | undefined,
    missingMessage: string,
  ): string;
  export function postTranscriptionRequest(params: {
    url: string;
    headers: Headers;
    body: BodyInit;
    timeoutMs: number;
    fetchFn: typeof fetch;
    allowPrivateNetwork?: boolean;
  }): Promise<{
    response: Response;
    release: () => Promise<void>;
  }>;
}
