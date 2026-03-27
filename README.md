# elevenlabs-stt

OpenClaw plugin that adds ElevenLabs Speech-to-Text to the normal inbound audio pipeline (`tools.media.audio`).

It is intended for voice notes and audio attachments such as Telegram voice messages or Discord audio uploads, using ElevenLabs' file-based STT endpoint.

## What this plugin does

- registers an OpenClaw media-understanding provider with provider ID `elevenlabs`
- transcribes normal inbound audio files through `POST /v1/speech-to-text`
- supports `model_id` and optional `language_code`
- lets OpenClaw handle fallback order through `tools.media.audio.models`
- propagates upstream failures so the next configured fallback entry can run

## V1 scope

Included in V1:

- normal inbound audio transcription only
- plugin ID `elevenlabs-stt`
- npm package name `@mkv21/elevenlabs-stt`
- media-understanding provider ID `elevenlabs`
- explicit config through `plugins.entries`, `models.providers`, and `tools.media.audio.models`

Not included in V1:

- `voice-call` / telephony integration
- realtime or streaming STT
- timestamps
- diarization
- advanced ElevenLabs request options

## Install

Install from npm:

```bash
openclaw plugins install @mkv21/elevenlabs-stt
```

Install a local checkout during development:

```bash
openclaw plugins install --link /path/to/openclaw-elevenlabs-stt
```

OpenClaw may persist plugin install metadata automatically, but the explicit activation shape for docs and config reviews remains:

```yaml
plugins:
  entries:
    elevenlabs-stt:
      enabled: true
```

Notes:

- The published package name is `@mkv21/elevenlabs-stt`, but the plugin ID remains `elevenlabs-stt`.
- Use the scoped package for OpenClaw installs. On current OpenClaw versions, the unscoped name `elevenlabs-stt` collides with an existing ClawHub skill name during resolver lookup.

## Recommended configuration

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
      language: en
      models:
        - provider: elevenlabs
          model: scribe_v2
```

Notes:

- `models.providers.elevenlabs.models: []` is currently required by OpenClaw's shared provider config shape.
- If you want fallback behavior, add additional entries after the ElevenLabs model in `tools.media.audio.models`.
- The plugin does not implement its own internal fallback logic.

## Tested host assumptions

- Tested locally with OpenClaw `2026.3.24`
- Requires OpenClaw host version `>=2026.3.24` for this published V1 package
- Earlier OpenClaw versions are unverified

## Packaging notes

This package is intentionally published as TypeScript source. OpenClaw loads plugin entrypoints from `openclaw.extensions` with its TypeScript-capable plugin loader, so a separate `dist/` build step is not required for this V1 package.

## AI-assisted development disclaimer

Parts of this project were developed with assistance from generative AI tools.
All generated code and text were reviewed and adapted by a human before publication.

## License

This project is licensed under the **MIT License**.
See [LICENSE](./LICENSE) for details.
