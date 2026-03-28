# Configuration Reference

This page collects the detailed configuration surface and troubleshooting notes for `@mkv21/elevenlabs-stt`.

## Install Notes

- Install target: `@mkv21/elevenlabs-stt`
- Plugin ID: `elevenlabs-stt`
- Provider ID: `elevenlabs`
- Use the scoped package for OpenClaw installs. On current OpenClaw versions, the unscoped name `elevenlabs-stt` collides with an existing ClawHub skill during resolver lookup.

## Supported Base Configuration

These are the main configuration fields supported by the plugin path today:

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

## Optional ElevenLabs STT Options

This plugin supports these ElevenLabs request options through `providerOptions.elevenlabs`.

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

### Gateway Does Not Start After Enabling The Plugin

This is usually caused by an incomplete `models.providers.elevenlabs` block.

On current OpenClaw versions, `models.providers.<id>` is validated as a full custom provider entry. That means a partial config such as only `apiKey`, only `baseUrl`, or a missing `models: []` can make the Gateway reject the config during startup.

Use a complete block like this:

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

### The Plugin Is Installed, But Transcription Does Not Run

Check all of the following:

- `plugins.entries.elevenlabs-stt.enabled: true`
- `tools.media.audio.enabled: true`
- `tools.media.audio.models` contains an ElevenLabs entry
- `ELEVENLABS_API_KEY` is available to the Gateway process

### I Want The API Key To Stay Out Of The Config File

Use an env-backed secret ref for `models.providers.elevenlabs.apiKey`:

```yaml
apiKey:
  source: env
  provider: default
  id: ELEVENLABS_API_KEY
```

That keeps the secret value outside the config file while still satisfying OpenClaw's current provider-config validation rules.
