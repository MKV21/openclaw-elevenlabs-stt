# Configuration Reference

Extended configuration notes and troubleshooting for `@mkv21/elevenlabs-stt`.
For the quick-reference tables, see the main [README](../README.md#configuration).

- Install target: `@mkv21/elevenlabs-stt`
- Plugin ID: `elevenlabs-stt`
- Provider ID: `elevenlabs`

## Base configuration notes

- Use the scoped package name for OpenClaw installs. On current OpenClaw versions, the unscoped name `elevenlabs-stt` collides with an existing ClawHub skill during resolver lookup.
- `models.providers.elevenlabs.models: []` is required by OpenClaw's shared provider config shape, even though this plugin does not use the models list.

Per-entry language overrides take precedence over the global `tools.media.audio.language`:

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

## Provider option notes

The [provider options table](../README.md#provider-options) lists all supported options. Below are detailed notes grouped by category.

### Transcript quality

- `tag_audio_events` includes audio-event cues (e.g. laughter, music) in the returned transcript text.
- `no_verbatim` asks ElevenLabs for a cleaner transcript with fillers and false starts reduced. Intended for `scribe_v2`.

### Privacy and entity handling

- `entity_detection`, `redact`, `entity_redaction`, and `entity_redaction_mode` control entity detection and transcript redaction behavior upstream.
- `entity_detection` alone does not change the returned transcript text; it only asks ElevenLabs to detect entities upstream.
- To redact the transcript text itself, set `entity_redaction` to a matching subset of the detected entity groups/types and optionally choose `entity_redaction_mode` (`redacted`, `entity_type`, or `enumerated_entity_type`).
- The current ElevenLabs API documents redaction primarily through `entity_redaction` and `entity_redaction_mode`. This plugin still forwards `redact` as a raw compatibility passthrough, but `entity_redaction` is the option to prefer.
- Upstream accepts `entity_detection` and `entity_redaction` as either a single string or a list of strings. This plugin currently inherits OpenClaw's scalar-only media `providerOptions`, so configure one category or one specific entity label at a time.

Supported high-level values currently documented by ElevenLabs:

- `all`
- categories: `pii`, `phi`, `pci`, `other`, `offensive_language`
- common specific labels: `name`, `name_given`, `name_family`, `phone_number`, `email_address`, `dob`, `ssn`, `credit_card`, `bank_account`, `passport_number`, `location_address`, `ip_address`, `condition`, `drug`, `injury`, `organization`, `religion`, `political_affiliation`

Common redaction modes:

- `redacted` -> `{REDACTED}`
- `entity_type` -> `{PHONE_NUMBER}`
- `enumerated_entity_type` -> `{PHONE_NUMBER_1}`, `{PHONE_NUMBER_2}`, ...

Official ElevenLabs references:

- API reference: https://elevenlabs.io/docs/api-reference/speech-to-text/convert
- Entity detection guide and full current entity-type list: https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/entity-detection

### Speaker, channel, and timing controls

- `diarize`, `num_speakers`, and `diarization_threshold` control speaker diarization behavior upstream.
- `use_multi_channel` tells ElevenLabs to treat input as separate speaker channels when the source audio actually has multiple channels.
- `timestamps_granularity` forwards ElevenLabs' word- or character-level timestamp request setting.

### Advanced tuning

- `temperature` and `seed` forward transcription-generation controls to ElevenLabs.
- `file_format` is only useful when you intentionally know the uploaded audio format details and want to override ElevenLabs' default handling.

### Current limitations

- OpenClaw currently consumes only the plain transcript text from the plugin result. Options whose main value is extra metadata such as timestamps, speakers, channels, or entities are forwarded to ElevenLabs, but that structured metadata is not yet surfaced back through OpenClaw's current audio result shape.
- `keyterms` is not yet supported in this plugin because current OpenClaw media `providerOptions` only allow scalar values, not arrays.
- `additional_formats`, `webhook`, and `cloud_storage_url` are intentionally not supported in this plugin path.

## Troubleshooting

### Gateway does not start after enabling the plugin

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

### The plugin is installed, but transcription does not run

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
