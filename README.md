# elevenlabs-stt

OpenClaw plugin that adds ElevenLabs Speech-to-Text to the normal inbound audio pipeline (`tools.media.audio`).

It is intended for voice notes and audio attachments such as Telegram voice messages or Discord audio uploads, using ElevenLabs' file-based STT endpoint.

## What this plugin does

- registers an OpenClaw media-understanding provider with provider ID `elevenlabs`
- transcribes normal inbound audio files through `POST /v1/speech-to-text`
- supports `model_id`, optional `language_code`, and selected ElevenLabs STT request options through `providerOptions.elevenlabs`
- lets OpenClaw handle fallback order through `tools.media.audio.models`
- propagates upstream failures so the next configured fallback entry can run

## Current scope

Included:

- normal inbound audio transcription only
- plugin ID `elevenlabs-stt`
- npm package name `@mkv21/elevenlabs-stt`
- media-understanding provider ID `elevenlabs`
- explicit config through `plugins.entries`, `models.providers`, and `tools.media.audio.models`
- selected advanced ElevenLabs STT request controls

Not included:

- `voice-call` / telephony integration
- realtime or streaming STT
- async webhook-based transcription flow
- array- or object-shaped request options such as `keyterms` and `additional_formats`
- broader structured ElevenLabs response metadata in OpenClaw output

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

- `models.providers.elevenlabs` must be a structurally valid OpenClaw custom provider entry.
- `models.providers.elevenlabs.models: []` is currently required by OpenClaw's shared provider config shape, even though this plugin uses OpenClaw's media-understanding path instead of the normal text-model catalog.
- If you prefer an explicit env-backed secret ref, use:

  ```yaml
  apiKey:
    source: env
    provider: default
    id: ELEVENLABS_API_KEY
  ```

  `${ELEVENLABS_API_KEY}` also works if that matches your normal OpenClaw config style.
- If you want fallback behavior, add additional entries after the ElevenLabs model in `tools.media.audio.models`.
- The plugin does not implement its own internal fallback logic.

## Supported configuration surface

These are the main V1 configuration fields supported by the plugin path today:

- `models.providers.elevenlabs.baseUrl`
  Optional base URL override. Defaults to `https://api.elevenlabs.io/v1`.
- `models.providers.elevenlabs.apiKey`
  Required provider auth for real requests.
- `tools.media.audio.models[].provider`
  Must be `elevenlabs` for this plugin.
- `tools.media.audio.models[].model`
  Optional ElevenLabs STT model ID. Defaults to `scribe_v2`.
- `tools.media.audio.language`
  Optional global language hint passed as `language_code`.
- `tools.media.audio.models[].language`
  Optional per-entry language hint. This overrides the global `tools.media.audio.language` value for that model entry.
- `tools.media.audio.timeoutSeconds`
  Optional global request timeout.
- `tools.media.audio.models[].timeoutSeconds`
  Optional per-entry request timeout override.

Example with a per-entry language override:

```yaml
tools:
  media:
    audio:
      language: en
      models:
        - provider: elevenlabs
          model: scribe_v2
          language: de
```

In that example, the ElevenLabs request for that entry uses `language_code=de`.

## Optional ElevenLabs STT options

This plugin currently supports these ElevenLabs request options through `providerOptions.elevenlabs`:

Most users will only care about the first group.

Most useful for normal transcripts:

- `tag_audio_events`
- `no_verbatim`
- `enable_logging`

Privacy and entity handling:

- `entity_detection`
- `redact`
- `entity_redaction`

Speaker, channel, and timing controls:

- `diarize`
- `num_speakers`
- `diarization_threshold`
- `use_multi_channel`
- `timestamps_granularity`

Advanced tuning:

- `temperature`
- `seed`
- `file_format`

You can set them globally on `tools.media.audio.providerOptions.elevenlabs` or per model entry on `tools.media.audio.models[].providerOptions.elevenlabs`.

Example:

```yaml
tools:
  media:
    audio:
      providerOptions:
        elevenlabs:
          tag_audio_events: true
          no_verbatim: true
          enable_logging: false
          diarize: true
          timestamps_granularity: word
          entity_detection: pii
      models:
        - provider: elevenlabs
          model: scribe_v2
```

Notes:

- `tag_audio_events` includes audio-event cues in the returned transcript text.
- `no_verbatim` asks ElevenLabs for a cleaner transcript with fillers and false starts reduced.
- `enable_logging: false` is useful when you want lower-retention processing behavior on the provider side.
- `no_verbatim` is intended for `scribe_v2`.
- `entity_detection`, `redact`, and `entity_redaction` control entity detection and transcript redaction behavior upstream.
- `diarize`, `num_speakers`, and `diarization_threshold` control speaker diarization behavior upstream.
- `use_multi_channel` tells ElevenLabs to treat input as separate speaker channels when the source audio actually has multiple channels.
- `timestamps_granularity` forwards ElevenLabs' word- or character-level timestamp request setting.
- `temperature` and `seed` forward transcription-generation controls to ElevenLabs.
- `file_format` is only useful when you intentionally know the uploaded audio format details and want to override ElevenLabs' default handling.
- OpenClaw currently consumes only the plain transcript text from the plugin result. Options whose main value is extra metadata such as timestamps, speakers, channels, or entities are forwarded to ElevenLabs, but that structured metadata is not yet surfaced back through OpenClaw's current audio result shape.
- `keyterms` is not yet supported in this plugin because current OpenClaw media `providerOptions` only allow scalar values, not arrays.
- `additional_formats`, `webhook`, and `cloud_storage_url` are intentionally not supported in this plugin path.

## Troubleshooting

### Gateway does not start after enabling the plugin

This is usually caused by an incomplete `models.providers.elevenlabs` block.

On current OpenClaw versions, `models.providers.<id>` is validated as a full custom provider entry. That means a partial config such as only `apiKey`, only `baseUrl`, or a missing `models: []` can make the Gateway reject the config during startup.

Use the full minimal block from the example above:

```yaml
models:
  providers:
    elevenlabs:
      baseUrl: https://api.elevenlabs.io/v1
      apiKey:
        source: env
        provider: default
        id: ELEVENLABS_API_KEY
      models: []
```

### The plugin is installed, but transcription still does not run

Check all of the following:

- `plugins.entries.elevenlabs-stt.enabled: true`
- `tools.media.audio.enabled: true`
- `tools.media.audio.models` contains an ElevenLabs entry
- `ELEVENLABS_API_KEY` is available to the Gateway process

### I want the API key to stay out of the config file

Use an env-backed secret ref for `models.providers.elevenlabs.apiKey`:

```yaml
apiKey:
  source: env
  provider: default
  id: ELEVENLABS_API_KEY
```

That keeps the secret value outside the config file while still satisfying OpenClaw's current provider-config validation rules.

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
