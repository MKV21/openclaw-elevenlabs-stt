const MAX_ERROR_CHARS = 300;

function collapseErrorText(text: string): string | undefined {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (!collapsed) {
    return undefined;
  }
  if (collapsed.length <= MAX_ERROR_CHARS) {
    return collapsed;
  }
  return `${collapsed.slice(0, MAX_ERROR_CHARS)}...`;
}

export function normalizeBaseUrl(baseUrl: string | undefined, fallback: string): string {
  const raw = baseUrl?.trim() || fallback;
  return raw.replace(/\/+$/, "");
}

export function requireTranscriptionText(
  value: string | undefined,
  missingMessage: string,
): string {
  const text = value?.trim();
  if (!text) {
    throw new Error(missingMessage);
  }
  return text;
}

async function readErrorResponse(res: Response): Promise<string | undefined> {
  try {
    return collapseErrorText(await res.text());
  } catch {
    return undefined;
  }
}

export async function assertOkOrThrowHttpError(res: Response, label: string): Promise<void> {
  if (res.ok) {
    return;
  }
  const detail = await readErrorResponse(res);
  const suffix = detail ? `: ${detail}` : "";
  throw new Error(`${label} (HTTP ${res.status})${suffix}`);
}

export async function postTranscriptionRequest(params: {
  url: string;
  headers: Headers;
  body: BodyInit;
  timeoutMs: number;
  fetchFn: typeof fetch;
}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);
  timeout.unref?.();

  try {
    return await params.fetchFn(params.url, {
      method: "POST",
      headers: params.headers,
      body: params.body,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`ElevenLabs audio transcription timed out after ${params.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
