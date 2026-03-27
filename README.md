# openclaw-elevenlabs-stt

Experimental companion project for adding ElevenLabs Speech-to-Text support to OpenClaw's inbound audio pipeline.

## Goal

Use ElevenLabs STT for normal inbound voice/audio messages (e.g. Telegram voice notes, Discord voice attachments) via OpenClaw's `tools.media.audio` path, while keeping the implementation maintainable across OpenClaw updates.

## Current intent

- Build as much as possible as a plugin/extension
- Minimize required OpenClaw core changes
- Upstream the necessary core hook/capability work to OpenClaw
- Keep this repo publishable later

## Status

Small V1 plugin implemented in this repo.

Current scope:

- registers an OpenClaw media-understanding provider with provider ID `elevenlabs`
- targets normal inbound audio transcription via `tools.media.audio`
- uses ElevenLabs batch/file STT (`POST /v1/speech-to-text`)
- supports `file`, `model_id`, and optional `language_code`
- throws on upstream errors or missing transcript text so OpenClaw fallback order can continue
- keeps the small HTTP/baseUrl/error helper logic local instead of importing `openclaw/plugin-sdk/provider-http`

Out of scope in this V1:

- `voice-call` / telephony integration
- realtime / streaming STT
- timestamps
- diarization
- advanced ElevenLabs request options

## Plugin identity

- Package name: `elevenlabs-stt`
- Plugin ID: `elevenlabs-stt`
- Media-understanding provider ID: `elevenlabs`

## Local install

From an OpenClaw host checkout:

```bash
openclaw plugins install --link /path/to/openclaw-elevenlabs-stt
```

Recommended activation:

```yaml
plugins:
  entries:
    elevenlabs-stt:
      enabled: true
```

## Recommended V1 config

```yaml
plugins:
  entries:
    elevenlabs-stt:
      enabled: true

models:
  providers:
    elevenlabs:
      baseUrl: https://api.elevenlabs.io/v1
      apiKey: ${ELEVENLABS_API_KEY}
      models: []

tools:
  media:
    audio:
      enabled: true
      timeoutSeconds: 90
      language: de
      models:
        - provider: elevenlabs
          model: scribe_v2
        - type: cli
          command: whisper
          args:
            - --model
            - turbo
            - --output_format
            - txt
            - --output_dir
            - "{{OutputDir}}"
            - --verbose
            - "False"
            - "{{MediaPath}}"
```

Notes:

- `models.providers.elevenlabs.models: []` is currently required by OpenClaw's shared provider config shape.
- fallback should be expressed by entry order in `tools.media.audio.models`.
- the plugin itself does not implement internal fallback logic.

## Development

This repo expects a sibling OpenClaw checkout during development:

```text
../openclaw
../openclaw-elevenlabs-stt
```

The current development setup is intentionally split:

- **Tests** resolve `openclaw/*` imports against `../openclaw/src` via `vitest.config.ts`
- **Typecheck** currently uses a small local SDK shim in `openclaw-shim.d.ts`

This means `npm run typecheck` is useful for local safety, but it is **not** a full compatibility guarantee against the real OpenClaw SDK surface. A real host/plugin load test remains the most important integration check.

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Run typecheck:

```bash
npm run typecheck
```
