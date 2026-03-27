# Architecture Analysis: ElevenLabs STT for OpenClaw Inbound Audio

## Scope

This document covers the normal inbound audio transcription path in OpenClaw, not the telephony streaming path of the `voice-call` plugin.

Focus:

- `tools.media.audio`
- inbound voice notes and audio attachments
- plugin registration and provider execution
- minimum required changes for an upstreamable ElevenLabs STT integration

Out of scope:

- `voice-call` realtime STT (`openai-realtime`)
- TTS / speech synthesis behavior

## Summary

OpenClaw already has a first-class plugin capability for media-understanding providers, including audio transcription. The normal inbound audio path is not hard-wired to Whisper or to core-only providers. It resolves providers from the plugin registry, selects models from `tools.media.audio.models` or `tools.media.models`, and executes either a provider or CLI entry per attachment.

That means an ElevenLabs STT integration is realistically possible as a plugin-only solution today, as long as configuration is explicit:

- register a `MediaUnderstandingProvider` with `capabilities: ["audio"]`
- configure `tools.media.audio.models` to point at that provider
- provide auth and optional base URL / headers through `models.providers.<providerId>`

The main reasons to consider a small generic core improvement are polish, not feasibility:

1. current media `providerOptions` only supports scalar values and is passed to providers as `query?: Record<string, string | number | boolean>`
2. generic env-var auth discovery is built from bundled-provider metadata plus a small hard-coded core map, so non-bundled media-only plugins do not automatically get env-var auth probing

Neither point blocks a working ElevenLabs STT plugin. Both matter if we want the cleanest possible upstream story.

## Architecture Analysis

### 1. Where the normal inbound audio path runs

The main inbound reply pipeline calls media understanding from `src/auto-reply/reply/get-reply.ts` (`applyMediaUnderstandingIfNeeded`) before the agent reply is generated.

Relevant files:

- `src/auto-reply/reply/get-reply.ts`
- `src/media-understanding/apply.ts`
- `src/media-understanding/audio-preflight.ts`

Observed flow:

1. `get-reply.ts` detects inbound media and calls `applyMediaUnderstanding(...)`.
2. `apply.ts` normalizes attachments, builds the media provider registry, and runs media-understanding capabilities in order.
3. Audio outputs are written back into the message context:
   - `ctx.Transcript`
   - `ctx.CommandBody`
   - `ctx.RawBody`
   - `ctx.MediaUnderstanding`
4. Optional transcript echo is sent when `tools.media.audio.echoTranscript` is enabled.
5. After preprocessing, the `message:transcribed` internal hook is fired when a transcript exists.

The normal inbound path therefore already treats audio transcription as part of the generic media-understanding layer, not as a special telephony subsystem.

### 2. Where preflight transcription runs

OpenClaw also has a preflight audio-transcription helper used before mention checking for channels such as Telegram and Discord group chats.

Relevant files:

- `src/media-understanding/audio-preflight.ts`
- `extensions/telegram/src/bot-message-context.body.ts`
- `extensions/discord/src/monitor/preflight-audio.ts`

This is important because a provider registered for `tools.media.audio` is not only used during normal message preprocessing. It is also reused for:

- Telegram voice-note mention preflight
- Discord audio-attachment mention preflight
- plugin runtime `transcribeAudioFile(...)`

So if ElevenLabs is registered in the normal media-understanding provider registry, these paths benefit automatically.

### 3. How `tools.media.audio` is resolved

Provider/model selection is handled by:

- `src/media-understanding/resolve.ts`
- `src/media-understanding/runner.ts`
- `src/media-understanding/runner.entries.ts`

Current behavior:

- `tools.media.audio.models` is the highest-priority audio-specific model list.
- `tools.media.models` is a shared fallback list across image/audio/video.
- Shared entries are filtered by provider capability.
- If no explicit entries exist, OpenClaw falls back to auto-resolution.

Current auto-resolution behavior for audio in `runner.ts` is:

1. active model provider if suitable
2. local audio CLI path:
   - `sherpa-onnx-offline`
   - `whisper-cli`
   - `whisper`
3. Gemini CLI path
4. hard-coded provider auto list:
   - `openai`
   - `groq`
   - `deepgram`
   - `google`
   - `mistral`

Important implication:

- ElevenLabs will not be auto-selected unless core defaults are changed later.
- A plugin-only ElevenLabs solution must be explicitly configured in `tools.media.audio.models`.

### 4. How provider execution works

`runProviderEntry(...)` in `src/media-understanding/runner.entries.ts` is the key execution path for provider-backed audio transcription.

For audio entries, OpenClaw currently:

- loads attachment bytes
- enforces max size and min size
- resolves auth with `resolveApiKeyForProvider(...)`
- merges provider config from:
  - `models.providers.<providerId>`
  - `tools.media.audio`
  - the individual model entry
- passes the final request to `provider.transcribeAudio(...)`

Request fields passed into the provider include:

- `buffer`
- `fileName`
- `mime`
- `apiKey`
- `baseUrl`
- `headers`
- `model`
- `language`
- `prompt`
- `query`
- `timeoutMs`

This is already generic enough for a custom HTTP-based STT provider implementation.

### 5. How plugins register audio/STT providers today

OpenClaw already exposes a dedicated plugin API for media-understanding providers.

Relevant files:

- `src/plugins/types.ts`
- `src/plugins/registry.ts`
- `src/plugins/capability-provider-runtime.ts`
- `src/plugins/manifest.ts`
- `src/media-understanding/provider-registry.ts`

The registration chain is:

1. plugin `register(api)` calls `api.registerMediaUnderstandingProvider(...)`
2. plugin registry stores the provider under `registry.mediaUnderstandingProviders`
3. media-understanding registry resolves all providers for the capability key `mediaUnderstandingProviders`
4. `runCapability(...)` looks up the selected provider by normalized provider id and executes it

This is not hypothetical. OpenClaw already ships multiple bundled provider plugins that do exactly this:

- `extensions/deepgram`
- `extensions/openai`
- `extensions/groq`
- `extensions/mistral`
- `extensions/google`

So external plugin registration for audio transcription is already a supported pattern in the codebase.

### 6. Current ElevenLabs state in OpenClaw

Current bundled ElevenLabs support is speech/TTS-oriented, not media-understanding audio STT.

Relevant files:

- `extensions/elevenlabs/index.ts`
- `extensions/elevenlabs/openclaw.plugin.json`
- `extensions/elevenlabs/speech-provider.ts`

The current plugin:

- registers `registerSpeechProvider(...)`
- declares `contracts.speechProviders = ["elevenlabs"]`
- does not declare `contracts.mediaUnderstandingProviders`
- does not register `registerMediaUnderstandingProvider(...)`

So today there is no normal inbound ElevenLabs STT provider in the `tools.media.audio` path.

### 7. Existing runtime helpers confirm the same architecture

OpenClaw exposes plugin runtime helpers that already transcribe local audio files through the configured media-understanding provider path.

Relevant files:

- `extensions/media-understanding-core/src/runtime.ts`
- `src/plugin-sdk/media-understanding-runtime.ts`
- `src/plugins/runtime/index.ts`

`transcribeAudioFile(...)` eventually calls `runMediaUnderstandingFile({ capability: "audio", ... })`, which uses the same provider registry and `tools.media.audio` config as the normal inbound message path.

This is a strong signal that the media-understanding plugin surface is intended to be reused by external plugins and channels.

## Plugin-vs-Core Decision

## Is plugin-only possible?

Yes, for the target use case described here, plugin-only is realistic.

Why:

- there is already a public media-understanding provider interface for audio
- provider registration is already exposed in the plugin API
- the inbound audio path already resolves providers from plugin registrations
- `tools.media.audio.models` already supports ordered provider selection and fallback
- provider execution already supports auth, base URL, headers, model, timeout, language, prompt, and provider-specific scalar options

In practice, an ElevenLabs STT plugin can be made to work without any OpenClaw core change if we accept:

- explicit config instead of auto-discovery
- auth primarily via `models.providers.elevenlabs` and/or auth profiles
- advanced ElevenLabs-specific options kept modest in the first version

## Required core change?

None for a working first integration.

## Optional minimal core changes worth considering

If we want the cleanest and most upstreamable external-provider story, there are two small generic improvements worth considering.

### Optional Core Change A: structured provider options for media/audio

Current limitation:

- `providerOptions` in `src/config/types.tools.ts` and `src/config/zod-schema.core.ts` is limited to scalar values
- `AudioTranscriptionRequest` in `src/media-understanding/types.ts` exposes those options as `query?: Record<string, string | number | boolean>`

Why this matters for ElevenLabs:

- basic fields such as `diarize`, `tag_audio_events`, `language_code`, or numeric speaker options fit
- richer provider options such as arrays or structured formats do not fit cleanly
- official ElevenLabs STT docs expose a richer API surface than a pure scalar query map

Minimal generic improvement:

- keep current behavior backward-compatible
- add a new raw structured option bag to the audio request, for example:
  - `providerOptions?: Record<string, unknown>`
- pass the merged `tools.media.audio.providerOptions[providerId]` through unflattened
- let each provider decide whether those fields become query params, multipart form fields, or JSON payload fields

This would benefit more than ElevenLabs.

### Optional Core Change B: runtime env-var auth discovery for non-bundled plugins

Current limitation:

- `resolveEnvApiKey(...)` uses `PROVIDER_ENV_API_KEY_CANDIDATES`
- those candidates are built from bundled plugin metadata plus a small core map
- non-bundled external media-only plugins are not automatically covered by that path

Why this matters for ElevenLabs:

- a companion plugin can declare `providerAuthEnvVars`
- generic runtime env auth probing still will not automatically use that metadata unless the provider is bundled or hard-coded

Minimal generic improvement:

- when env auth is being resolved for a provider that is owned by a loaded non-bundled plugin, read `providerAuthEnvVars` from the manifest registry at runtime
- keep the bundled generated fast path as-is

This is a UX improvement, not a functional blocker.

## Betroffene Dateien / Module

## OpenClaw files already involved in the working path

- `src/auto-reply/reply/get-reply.ts`
- `src/media-understanding/apply.ts`
- `src/media-understanding/audio-preflight.ts`
- `src/media-understanding/audio-transcription-runner.ts`
- `src/media-understanding/runner.ts`
- `src/media-understanding/resolve.ts`
- `src/media-understanding/runner.entries.ts`
- `src/media-understanding/types.ts`
- `src/media-understanding/provider-registry.ts`
- `src/plugins/types.ts`
- `src/plugins/registry.ts`
- `src/plugins/capability-provider-runtime.ts`
- `src/plugins/runtime/index.ts`
- `src/plugin-sdk/media-understanding.ts`
- `src/plugin-sdk/media-understanding-runtime.ts`
- `extensions/media-understanding-core/src/runtime.ts`
- `src/config/types.tools.ts`
- `src/config/zod-schema.core.ts`
- `src/config/types.models.ts`
- `src/agents/model-auth.ts`
- `src/agents/model-auth-env.ts`
- `src/secrets/provider-env-vars.ts`

## Existing OpenClaw reference providers

- `extensions/deepgram/index.ts`
- `extensions/deepgram/media-understanding-provider.ts`
- `extensions/deepgram/audio.ts`
- `extensions/openai/media-understanding-provider.ts`
- `extensions/groq/media-understanding-provider.ts`
- `extensions/mistral/media-understanding-provider.ts`
- `extensions/google/media-understanding-provider.ts`

## Existing ElevenLabs files in OpenClaw

- `extensions/elevenlabs/index.ts`
- `extensions/elevenlabs/openclaw.plugin.json`
- `extensions/elevenlabs/speech-provider.ts`

## Proposed companion-repo files

Recommended first implementation layout in this repository:

- `package.json`
- `openclaw.plugin.json`
- `index.ts`
- `media-understanding-provider.ts`
- `media-understanding-provider.test.ts`
- `notes/architecture-analysis.md`
- `README.md`
- `examples/config.elevenlabs-stt.yaml`

Optional extra files if the mapping logic gets non-trivial:

- `provider-options.ts`
- `api.ts`
- `fixtures/`

## Proposed Architecture

## Recommended plugin identity

Use a plugin id that does not collide with the bundled OpenClaw `elevenlabs` plugin.

Recommended:

- plugin id: `elevenlabs-stt` or `openclaw-elevenlabs-stt`
- provider id: `elevenlabs`

Reason:

- OpenClaw already has a bundled plugin with id `elevenlabs`
- reusing the same plugin id in an external repo is risky
- the provider id can still be `elevenlabs`, which is what `tools.media.audio.models[].provider` should reference

## Runtime design

Recommended plugin shape:

1. `index.ts`
   - `definePluginEntry(...)`
   - `api.registerMediaUnderstandingProvider(elevenlabsMediaUnderstandingProvider)`

2. `media-understanding-provider.ts`
   - export `elevenlabsMediaUnderstandingProvider: MediaUnderstandingProvider`
   - implement `transcribeAudio(req)`
   - use public SDK helpers from:
     - `openclaw/plugin-sdk/media-understanding`
     - `openclaw/plugin-sdk/provider-http`

3. Normalize the provider response to OpenClaw's current `AudioTranscriptionResult`
   - return `text`
   - optionally return `model`
   - ignore timestamps / diarization arrays in the first version unless we explicitly decide to surface them later

## Config model

Recommended execution model:

- auth/base URL/headers live under `models.providers.elevenlabs`
- provider selection lives under `tools.media.audio.models`
- fallback is represented by ordered model entries

This matches how OpenClaw already executes provider-backed audio transcription today.

## Config-Vorschlag

## Minimal working config

```yaml
plugins:
  allow:
    - elevenlabs-stt
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

## Why `models.providers.elevenlabs.models: []` appears

Current OpenClaw provider auth/base URL resolution for media providers reuses the shared `models.providers.<id>` config. That schema currently requires a `models` array, even for media-only providers. An empty array works, but it is slightly awkward.

This is not a blocker. It is just the current shape.

## Recommended auth / secret wiring

Preferred first implementation:

- `models.providers.elevenlabs.apiKey: ${ELEVENLABS_API_KEY}`

Also valid:

- explicit SecretRef object:

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

Auth-profile support is also possible because OpenClaw resolves provider auth generically by provider id, but that is a second-step UX improvement rather than the simplest first config.

## Recommended provider options mapping

For a first implementation, keep options small and scalar so they fit the current OpenClaw media config shape cleanly.

Example:

```yaml
tools:
  media:
    audio:
      models:
        - provider: elevenlabs
          model: scribe_v2
          providerOptions:
            elevenlabs:
              diarize: true
              tag_audio_events: false
              num_speakers: 2
```

Avoid array-heavy options in the first pass unless we also make Optional Core Change A.

## Fallback behavior

Fallback is already supported by ordered model entries in `tools.media.audio.models`.

Recommended order:

1. ElevenLabs first
2. current Whisper CLI or another known provider second

If ElevenLabs returns a failure, OpenClaw already records the failed attempt and continues to the next entry.

## Risks / Open Questions

## Confirmed risks

- Auto-selection will not pick ElevenLabs unless OpenClaw core defaults are changed later.
- Non-bundled env-var auth discovery is weaker than bundled-provider auth discovery.
- Media-only providers currently piggyback on `models.providers.<id>` config and therefore inherit the slightly awkward `models: []` requirement.
- `providerOptions` is scalar-only today.

## ElevenLabs API uncertainties to keep explicit

I verified the current official ElevenLabs docs only at the level needed for architecture planning:

- there is a normal Speech-to-Text API
- the docs describe `Scribe v2`
- the API reference exposes a `POST /v1/speech-to-text` style endpoint with `xi-api-key`
- the docs mention richer STT features such as timestamps and diarization

Before implementation, we should still verify the exact current request/response contract we plan to map:

- exact multipart field names
- exact model id
- which options are form fields vs query params
- whether language hint names differ from OpenClaw's generic `language`
- whether any option needs arrays or nested JSON

## OpenClaw-specific UX questions

- Do we want the companion plugin to ship `providerAuthChoices` immediately, or is config-file auth enough for phase 1?
- Do we want to preserve only transcript text, or also retain optional metadata for future hooks?
- If upstream later bundles this, should it extend the existing bundled `elevenlabs` plugin or remain external?

My recommendation:

- first external implementation: config-file auth + provider plugin only
- later upstream discussion: decide whether to merge into bundled `extensions/elevenlabs`

## Upstream Strategy

## What belongs in a core PR

Nothing is strictly required for phase 1.

If we want a generic upstream improvement, split it into a small PR that is provider-agnostic. Best candidates:

1. structured media/audio provider options
2. runtime env-var auth discovery for non-bundled plugin manifests

These are reviewable on their own and useful beyond ElevenLabs.

## What belongs in this companion repo

- the actual ElevenLabs STT media-understanding provider plugin
- request/response normalization
- plugin manifest and installable package shape
- tests for multipart request construction and response mapping
- config examples and fallback examples

## What could later be bundled

If maintainers want first-party vendor support later, the most coherent bundled destination is probably the existing OpenClaw `extensions/elevenlabs` plugin:

- add `contracts.mediaUnderstandingProviders: ["elevenlabs"]`
- register a media-understanding provider in `extensions/elevenlabs/index.ts`
- add STT implementation file(s)
- optionally add provider-auth metadata

That said, bundling should be a follow-up decision. It is not needed to prove the architecture.

## Recommended next steps

1. Implement a standalone companion plugin in this repo with a distinct plugin id and provider id `elevenlabs`.
2. Keep the first version intentionally small:
   - plain transcription
   - explicit config
   - ordered fallback
   - no advanced structured provider options yet
3. Add a narrow test set:
   - request URL
   - auth header
   - multipart form fields
   - transcript text extraction
   - failure handling
4. Validate end-to-end with:
   - Telegram voice note
   - Discord audio attachment
   - direct `transcribeAudioFile(...)` runtime call
5. After the plugin works, decide whether Optional Core Change A and/or B are worth upstreaming.

## Bottom line

The best current decision is:

- plugin-first
- no required core fork
- explicit `tools.media.audio.models` configuration
- optional later generic core cleanup only if we want a more polished provider surface
