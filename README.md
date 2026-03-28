# elevenlabs-stt

Add ElevenLabs Speech-to-Text to OpenClaw's normal inbound audio pipeline (`tools.media.audio`).

The plugin is intentionally simple to use: install it, add an ElevenLabs provider block, and point an audio model entry at `provider: elevenlabs`. It also exposes selected ElevenLabs request options through `providerOptions.elevenlabs`, so you can tune transcript quality and behavior without leaving normal OpenClaw config.

## Table of contents

- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Provider options](#provider-options)
- [What this plugin covers](#what-this-plugin-covers)
- [Compatibility](#compatibility)
- [Development](#development)
- [Documentation](#documentation)
- [License](#license)

## Prerequisites

- OpenClaw `>=2026.3.24`
- Node.js `>=22.14.0`
- An [ElevenLabs API key](https://elevenlabs.io)

## Quick start

Install with OpenClaw:

```bash
openclaw plugins install @mkv21/elevenlabs-stt
```

Use the scoped package name for OpenClaw installs. On current OpenClaw versions, the unscoped name `elevenlabs-stt` collides with an existing ClawHub skill during resolver lookup.

> **Warning**
> Before restarting the OpenClaw Gateway after installation, add the full `models.providers.elevenlabs` config block shown below.
> If the plugin is enabled but the provider block is missing or incomplete, OpenClaw can fail validation during startup and the Gateway may no longer start.

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

## Configuration

| Field | Default | Description |
|-------|---------|-------------|
| `models.providers.elevenlabs.baseUrl` | `https://api.elevenlabs.io/v1` | Base URL for ElevenLabs API |
| `models.providers.elevenlabs.apiKey` | — | Required. ElevenLabs API key |
| `models.providers.elevenlabs.models` | — | Must be `[]` (required by OpenClaw's provider config shape) |
| `tools.media.audio.models[].provider` | — | Must be `elevenlabs` for this plugin |
| `tools.media.audio.models[].model` | `scribe_v2` | ElevenLabs STT model ID |
| `tools.media.audio.language` | — | Global language hint passed as `language_code` |
| `tools.media.audio.models[].language` | — | Per-entry language override |
| `tools.media.audio.timeoutSeconds` | — | Global request timeout in seconds |
| `tools.media.audio.models[].timeoutSeconds` | — | Per-entry request timeout override |

## Provider options

Tune the upstream ElevenLabs request through `providerOptions.elevenlabs`, set globally on `tools.media.audio.providerOptions.elevenlabs` or per model entry on `tools.media.audio.models[].providerOptions.elevenlabs`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tag_audio_events` | boolean | — | Include audio-event cues in transcript text |
| `no_verbatim` | boolean | — | Cleaner transcript with fillers and false starts reduced (`scribe_v2`) |
| `diarize` | boolean | — | Enable speaker diarization |
| `num_speakers` | number | — | Expected number of speakers for diarization |
| `diarization_threshold` | number | — | Diarization sensitivity threshold |
| `use_multi_channel` | boolean | — | Treat input as separate speaker channels |
| `timestamps_granularity` | string | — | Timestamp level: `word` or `character` |
| `entity_detection` | string | — | Entity category/type to detect (e.g. `pii`, `name`, `phone_number`) |
| `redact` | boolean | — | Legacy upstream passthrough; prefer `entity_redaction` with current ElevenLabs API |
| `entity_redaction` | string | — | Entity groups/types to redact from transcript text |
| `entity_redaction_mode` | string | — | Redaction style: `redacted`, `entity_type`, or `enumerated_entity_type` |
| `temperature` | number | — | Transcription generation temperature |
| `seed` | number | — | Transcription generation seed |
| `file_format` | string | — | Override audio format detection |

Example:

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

> **Note:** OpenClaw currently consumes only the plain transcript text. Options whose main value is extra metadata (timestamps, speakers, channels, entities) are forwarded to ElevenLabs but not yet surfaced through OpenClaw's current audio result shape. Array-shaped options such as `keyterms` and `additional_formats` are not supported because current OpenClaw media `providerOptions` are scalar-only.

> **Privacy note:** `entity_detection` alone only asks ElevenLabs to detect entities upstream. If you want the transcript text itself redacted, also set `entity_redaction` to a matching subset and optionally `entity_redaction_mode` to control how replacements are rendered.

> **Entity values:** ElevenLabs currently accepts `all`, category values such as `pii`, `phi`, `pci`, `other`, and `offensive_language`, or specific entity labels such as `name`, `phone_number`, `email_address`, `dob`, `ssn`, `credit_card`, `condition`, and `organization`. Upstream also accepts lists, but this plugin currently inherits OpenClaw's scalar-only `providerOptions`, so use one category or one specific label per option for now. See the official [Speech-to-Text API reference](https://elevenlabs.io/docs/api-reference/speech-to-text/convert) and [Entity detection guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/entity-detection).

## What this plugin covers

- Normal inbound audio transcription only
- No telephony, realtime/streaming, or async webhook-based transcription flow

## Compatibility

- Tested locally with OpenClaw `2026.3.24`
- Requires OpenClaw host version `>=2026.3.24`

## Development

```bash
# Run tests
npm test

# Type check
npm run typecheck
```

## Documentation

- [Configuration Reference and Troubleshooting](./docs/configuration.md)

## AI-Assisted Development Disclaimer

Parts of this project were developed with assistance from generative AI tools.
All generated code and text were reviewed and adapted by a human before publication.

## License

This project is licensed under the **MIT License**.
See [LICENSE](./LICENSE) for details.
