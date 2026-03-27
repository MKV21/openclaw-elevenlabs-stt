# V1 Config Proposal

## Goal

This document defines the smallest practical OpenClaw configuration for using this repository's ElevenLabs STT plugin in the normal inbound media path.

Design constraints:

- no OpenClaw core patch required
- no `plugins.allow` in the recommended default example
- explicit provider selection in `tools.media.audio.models`
- clean fallback to a second entry such as local Whisper CLI

## Recommended V1 Configuration

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

## What each section does

`plugins.entries.elevenlabs-stt.enabled`

- enables the plugin itself
- this is the preferred activation mechanism for documentation in this repository

`models.providers.elevenlabs`

- stores shared provider auth and endpoint settings
- `baseUrl` should point at ElevenLabs API v1
- `apiKey` should come from a secret or env interpolation
- `models: []` is currently awkward but pragmatic because OpenClaw reuses the general provider config shape here

`tools.media.audio.models`

- defines provider execution order
- the first entry tries ElevenLabs STT
- the second entry acts as fallback when the first one fails

## Auth Recommendation for V1

Preferred V1 auth shape:

```yaml
models:
  providers:
    elevenlabs:
      baseUrl: https://api.elevenlabs.io/v1
      apiKey: ${ELEVENLABS_API_KEY}
      models: []
```

Why this is the recommended V1 path:

- it is explicit
- it already fits OpenClaw's current provider auth resolution flow
- it avoids depending on bundled-provider env heuristics that are not designed around external media-only plugins

## Fallback Recommendation

The fallback should be configured in `tools.media.audio.models` by simple ordering.

Recommended V1 behavior:

1. try ElevenLabs first
2. if ElevenLabs fails, let OpenClaw continue to the next model entry
3. use local Whisper CLI as the operational safety net

This means the plugin should not implement its own internal fallback logic.

## Alternative V1 Variants

## Variant A: no explicit language

If language detection should be left to ElevenLabs, omit `tools.media.audio.language`.

```yaml
tools:
  media:
    audio:
      enabled: true
      timeoutSeconds: 90
      models:
        - provider: elevenlabs
          model: scribe_v2
        - type: cli
          command: whisper
          args: ["--model", "turbo", "--output_format", "txt", "--output_dir", "{{OutputDir}}", "--verbose", "False", "{{MediaPath}}"]
```

## Variant B: ElevenLabs only, no local fallback

This is valid, but not the preferred V1 operational recommendation.

```yaml
tools:
  media:
    audio:
      enabled: true
      timeoutSeconds: 90
      models:
        - provider: elevenlabs
          model: scribe_v2
```

Use this only if you accept that upstream API failures can directly break transcription for inbound audio messages.

## Installation / Loading Notes

Operationally, the plugin can be installed from this repository with OpenClaw's plugin tooling, for example via a local path or symlinked path.

Important nuance:

- current OpenClaw install tooling may also write `plugins.allow`
- this document does not recommend that field as the primary user-facing config shape
- the design assumption for V1 remains: `plugins.entries.elevenlabs-stt.enabled = true` is the intended activation knob

## Known config awkwardness

There is one notable V1 wart:

- `models.providers.elevenlabs.models: []` exists only because OpenClaw's shared provider config shape currently expects a `models` array even for a media-only provider

This is acceptable for V1 and should be documented rather than papered over with custom behavior.

## Things V1 should not add to config yet

Avoid expanding the public config surface before the basic provider works.

Do not add first-version config for:

- diarization
- timestamps
- speaker counts
- audio-event tagging
- keyterms
- webhook or async processing
- provider-specific nested object settings

Reason:

- these are not needed for the first vertical slice
- some of them would push against current scalar-only `providerOptions` constraints

## Validation checklist for implementation

When implementation starts, validate this config against one realistic OpenClaw setup:

- plugin loads when `plugins.entries.elevenlabs-stt.enabled` is true
- provider resolves when `tools.media.audio.models[0].provider` is `elevenlabs`
- auth is picked up from `models.providers.elevenlabs.apiKey`
- fallback entry runs when ElevenLabs returns an error
