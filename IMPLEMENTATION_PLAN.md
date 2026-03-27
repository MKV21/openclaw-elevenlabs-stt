# Implementation Plan — ElevenLabs STT for OpenClaw

## Problem statement

OpenClaw currently supports inbound audio transcription for normal voice/audio messages through `tools.media.audio` using providers like OpenAI, Groq, Deepgram, Google, Mistral, and local CLI fallbacks such as Whisper. In our setup, inbound voice notes currently use local `whisper` CLI on a small VPS, which is cost-efficient but likely suboptimal in latency and CPU usage.

We want to evaluate and implement support for ElevenLabs Speech-to-Text (STT) for inbound audio messages while:

- avoiding a long-lived fork of OpenClaw
- minimizing breakage across OpenClaw updates
- making the implementation suitable for upstream contribution
- keeping a plugin-first architecture where possible

## Desired user-facing outcome

For Telegram/Discord voice notes and other inbound audio handled by `tools.media.audio`:

- OpenClaw can use ElevenLabs STT as a transcription provider
- configuration is explicit and ergonomic
- fallback to existing providers / local Whisper remains possible
- the feature can be packaged and maintained cleanly

## Non-goals

- Replacing the existing `voice-call` streaming STT path (`openai-realtime`) for telephony calls
- Reworking TTS / speech synthesis behavior
- Shipping a private one-off hack that cannot plausibly be upstreamed

## What we believe today

### Existing OpenClaw paths

1. **Voice-call telephony path**
   - Config path: `plugins.entries.voice-call.config.streaming.*`
   - Current STT provider schema appears limited to `openai-realtime`
   - This is separate from normal inbound audio/voice note transcription

2. **Inbound audio / voice note path**
   - Config path: `tools.media.audio`
   - Current setup uses local `whisper` CLI
   - This is the path we want to extend

3. **ElevenLabs today**
   - Already relevant in OpenClaw for TTS / speech
   - Not currently exposed as a standard inbound audio transcription provider in the docs/config paths we checked

## Architectural hypothesis

### Best-case outcome

We can implement ElevenLabs STT mostly as a plugin/provider that registers a media-understanding audio provider, with either:

- no OpenClaw core changes, or
- only a small core change to expose the right provider registration hook / config plumbing

### Likely outcome

A **small OpenClaw core change** will probably be required if the current media-understanding provider surface does not yet expose everything needed for an external/plugin-based STT provider in the inbound audio pipeline.

That would still be acceptable if:

- the core change is generic
- the ElevenLabs-specific implementation lives outside core or in a self-contained extension
- the core change is upstreamable on its own merits

## Open questions to answer before coding

1. **ElevenLabs API details**
   - Which STT endpoints exist today?
   - Sync vs async?
   - Realtime vs batch?
   - Input size limits and supported formats?
   - Language handling, timestamps, diarization, keyterm prompting?
   - Pricing/credits implications on Starter plan?

2. **OpenClaw extension points**
   - How exactly does `tools.media.audio` choose providers?
   - Which plugin capability / provider registration path is used for audio transcription?
   - Can an external plugin register an audio transcription provider today?
   - If not, what minimal core hook is missing?

3. **Config UX**
   - Should users configure ElevenLabs STT under `tools.media.audio.models` as a provider model entry?
   - Or under `tools.media.audio.providerOptions.elevenlabs`?
   - How should auth be wired (SecretRefs, `ELEVENLABS_API_KEY`, plugin config, or all of the above)?

4. **Fallback behavior**
   - Should ElevenLabs be first, with Whisper fallback?
   - How should errors/timeouts/rate limits degrade?

5. **Upstream strategy**
   - What is the smallest reviewable OpenClaw PR?
   - Which parts belong upstream vs in this companion repo?

## Proposed work phases

### Phase 0 — Discovery / design

Deliverables:
- confirm ElevenLabs STT API surface
- map current OpenClaw inbound audio pipeline
- identify whether plugin-only is possible
- define minimal upstreamable abstraction if not

Outputs:
- architecture note
- decision: plugin-only vs plugin+core patch
- list of affected OpenClaw files/modules

### Phase 1 — Minimal technical spike

Goal:
- prove we can send an audio file to ElevenLabs STT and normalize the response into OpenClaw's expected transcript shape

Deliverables:
- standalone script or tiny adapter
- transcript response mapping
- format/size/error handling notes

### Phase 2 — OpenClaw integration design

Two possible tracks:

#### Track A — plugin-only
- build/install extension plugin
- register ElevenLabs STT provider
- configure `tools.media.audio` to use it

#### Track B — small OpenClaw core patch + plugin
- add generic provider hook/capability for inbound audio transcription
- keep ElevenLabs logic in extension/plugin
- validate no regressions for existing providers

### Phase 3 — working local integration

Deliverables:
- local end-to-end transcription via ElevenLabs for inbound audio messages
- fallback path retained
- config examples
- tests where feasible

### Phase 4 — upstream preparation

Deliverables:
- split generic OpenClaw core changes from ElevenLabs-specific implementation
- write rationale + docs
- prepare PR(s)

Recommended split:
1. **OpenClaw PR**: generic audio-provider extension point / config plumbing
2. **Companion implementation**: ElevenLabs STT provider plugin (or follow-up PR if OpenClaw maintainers want it bundled)

## Proposed repository structure

```text
openclaw-elevenlabs-stt/
  README.md
  IMPLEMENTATION_PLAN.md
  notes/
    architecture.md
    elevenlabs-api-notes.md
    openclaw-audio-pipeline.md
  spikes/
    elevenlabs-stt-smoke-test/
  docs/
    upstream-pr-strategy.md
```

## Recommendation before first Codex prompt

Before asking Codex to code anything substantial, we should align on:

1. repo naming / scope
2. plugin-only ambition vs acceptable small core patch
3. desired upstream strategy
4. success criteria for the first spike

## My current recommendation

- Aim for **plugin-first**
- Be willing to make a **small generic OpenClaw core change** if the current provider surface is insufficient
- Avoid a broad/private fork
- Treat upstreamability as a hard design constraint from day one

## Suggested first Codex task later

Not yet to implement the whole feature.
First ask Codex to:

1. inspect OpenClaw's inbound audio transcription architecture
2. identify extension/provider registration points
3. determine whether ElevenLabs STT can be added as a plugin today
4. produce a precise file-level implementation proposal

That gives us a design artifact before we touch runtime behavior.
