# elevenlabs-stt

Add ElevenLabs Speech-to-Text to OpenClaw's normal inbound audio pipeline (`tools.media.audio`).

The plugin is intentionally simple to use: install it, add an ElevenLabs provider block, and point an audio model entry at `provider: elevenlabs`. It also exposes selected ElevenLabs request options through `providerOptions.elevenlabs`, so you can tune transcript quality and behavior without leaving normal OpenClaw config.

- Easy OpenClaw setup for normal inbound audio transcription
- Supports useful ElevenLabs controls such as `no_verbatim`, `tag_audio_events`, diarization, and privacy-related settings
- Install target: `@mkv21/elevenlabs-stt`
- Plugin ID: `elevenlabs-stt`
- Provider ID: `elevenlabs`

## Quick Start

Install with OpenClaw:

```bash
openclaw plugins install @mkv21/elevenlabs-stt
```

Use the scoped package name for OpenClaw installs. On current OpenClaw versions, the unscoped name `elevenlabs-stt` collides with an existing ClawHub skill during resolver lookup.

Minimal working config:

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

Important notes:

- `models.providers.elevenlabs.models: []` is currently required by OpenClaw's shared provider config shape.
- If you prefer an explicit env-backed secret ref, you can use:

  ```yaml
  apiKey:
    source: env
    provider: default
    id: ELEVENLABS_API_KEY
  ```

- If you want fallback behavior, add additional entries after the ElevenLabs model in `tools.media.audio.models`.

## Common option example

You can tune the upstream ElevenLabs request through `providerOptions.elevenlabs`:

```yaml
tools:
  media:
    audio:
      providerOptions:
        elevenlabs:
          no_verbatim: true
          tag_audio_events: true
      models:
        - provider: elevenlabs
          model: scribe_v2
```

Those options are useful when you want cleaner transcripts and explicit audio-event markers.

## What This Plugin Covers

- normal inbound audio transcription only
- no telephony, realtime/streaming, or async webhook-based transcription flow
- OpenClaw currently consumes only the plain transcript text, so extra metadata such as timestamps, speakers, channels, or entities is forwarded upstream but not surfaced in the current audio result shape
- array- or object-shaped request options such as `keyterms` and `additional_formats` are not supported yet because current OpenClaw media `providerOptions` are scalar-only

## Compatibility

- Tested locally with OpenClaw `2026.3.24`
- Requires OpenClaw host version `>=2026.3.24`

## More Docs

- [Configuration Reference And Troubleshooting](./docs/configuration.md)

## AI-Assisted Development Disclaimer

Parts of this project were developed with assistance from generative AI tools.
All generated code and text were reviewed and adapted by a human before publication.

## License

This project is licensed under the **MIT License**.
See [LICENSE](./LICENSE) for details.
