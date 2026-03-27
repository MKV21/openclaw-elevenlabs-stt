# V1 Design: ElevenLabs STT Plugin for OpenClaw

## Summary

V1 should be a small, plugin-only integration for OpenClaw's existing inbound media transcription path (`tools.media.audio`).

The design goal is narrow on purpose:

- normal incoming audio files only
- explicit model/provider configuration
- clean fallback to existing entries such as Whisper CLI
- no OpenClaw core change required for the first usable version
- no telephony / `voice-call` streaming work

This keeps the first implementation upstream-friendly and low-risk against OpenClaw updates.

## Recommended V1 Architecture

V1 should be implemented as a standalone OpenClaw plugin in this repository.

The plugin should:

- register exactly one `mediaUnderstandingProvider`
- implement only file-based audio transcription against ElevenLabs STT
- rely on OpenClaw's existing `tools.media.audio.models` ordering for fallback behavior
- read auth/base URL from `models.providers.<providerId>`
- avoid custom OpenClaw patches in V1

Relevant OpenClaw integration points already exist:

- inbound processing entry: `<openclaw-repo>/src/auto-reply/reply/get-reply.ts`
- audio/media application: `<openclaw-repo>/src/media-understanding/apply.ts`
- provider resolution: `<openclaw-repo>/src/media-understanding/resolve.ts`
- provider execution: `<openclaw-repo>/src/media-understanding/runner.ts`
- plugin registration surface: `<openclaw-repo>/src/plugins/types.ts`
- provider registry wiring: `<openclaw-repo>/src/plugins/registry.ts`

## Plugin ID and Provider ID

### Recommended IDs

- plugin ID: `elevenlabs-stt`
- media-understanding provider ID: `elevenlabs`

### Why this split is the best V1 tradeoff

`elevenlabs-stt` is a safe plugin/package identity for this companion repository and avoids colliding with OpenClaw's existing bundled `elevenlabs` plugin, which already covers speech/TTS concerns.

Using provider ID `elevenlabs` is still the better V1 choice because:

- it matches the vendor name users will expect in `tools.media.audio.models`
- it keeps config concise
- it aligns with how other providers are referenced in OpenClaw config

### Collision risk assessment

Current collision risk is acceptable.

Reason:

- OpenClaw's existing bundled `elevenlabs` plugin does not currently register a media-understanding provider
- provider uniqueness is enforced per capability registry, not globally across unrelated capability kinds

That means:

- plugin ID `elevenlabs-stt` does not collide with the bundled plugin ID
- media provider ID `elevenlabs` does not collide today with the current bundled ElevenLabs plugin behavior

### Explicit future risk

There is one real future risk:

- if OpenClaw later bundles its own ElevenLabs media/STT provider under provider ID `elevenlabs`, the external plugin would conflict at registration time

That is not a V1 blocker, but it should be documented. If that happens later, the external plugin can be retired or renamed.

## Files Needed for a Clean V1

These are the files that should exist in this repository for the first implementation slice:

- `package.json`
- `openclaw.plugin.json`
- `index.ts`
- `media-understanding-provider.ts`
- `media-understanding-provider.test.ts`
- optionally `elevenlabs-api.ts` if the request/response mapping becomes large enough to justify a separate module

Design/plan artifacts for this phase:

- `notes/architecture-analysis.md`
- `notes/v1-design.md`
- `notes/config-proposal.md`

### Responsibility of each file

`openclaw.plugin.json`

- declares plugin metadata
- uses plugin ID `elevenlabs-stt`
- points OpenClaw at the plugin entrypoint

`index.ts`

- registers the media-understanding provider with OpenClaw
- keeps the public plugin entry as small as possible

`media-understanding-provider.ts`

- implements the ElevenLabs STT call
- translates OpenClaw provider input into the ElevenLabs request
- normalizes the ElevenLabs response into OpenClaw's transcript result shape

`media-understanding-provider.test.ts`

- verifies request construction
- verifies response normalization
- verifies error propagation behavior needed for fallback

## Installation and Loading in OpenClaw

V1 should be installable as a local plugin from this repository.

Practical install/load options:

- `openclaw plugins install --link <this-repo>`
- `openclaw plugins install <this-repo>`
- or explicit `plugins.load.paths` if the user prefers manual config wiring

Recommended activation shape for docs/examples:

- `plugins.entries.elevenlabs-stt.enabled = true`

Important nuance:

- OpenClaw's current CLI install path auto-persists plugin enablement and also adds an allowlist entry
- that is current tooling behavior, not a V1 config requirement
- for the design and examples in this repository, `plugins.entries.<id>.enabled = true` should remain the primary activation guidance

## ElevenLabs API Mapping for V1

## Endpoint

Use ElevenLabs batch/file STT:

- `POST https://api.elevenlabs.io/v1/speech-to-text`

Official docs:

- https://elevenlabs.io/docs/overview/capabilities/speech-to-text
- https://elevenlabs.io/docs/api-reference/speech-to-text

## Request fields that V1 should support

Required:

- header `xi-api-key`
- multipart field `file`
- multipart field `model_id`

Optional in V1:

- multipart field `language_code`

### V1 field mapping

OpenClaw input should map to ElevenLabs like this:

- audio file path or blob -> multipart `file`
- configured model from `tools.media.audio.models[].model` -> `model_id`
- configured language from the resolved audio config, when present -> `language_code`

### Fields V1 should intentionally not send yet

Do not add these in the first implementation unless a hard blocker appears:

- `tag_audio_events`
- `diarize`
- `num_speakers`
- `timestamps_granularity`
- `additional_formats`
- `file_format`
- `webhook`
- `temperature`
- `enable_logging`
- `enable_audio_consistency`
- `keyterms`
- multi-channel options

Reason:

- they are not necessary for "plain transcription works reliably"
- they would either enlarge the config surface or run into current OpenClaw `providerOptions` limitations

## Response normalization

For V1, normalize only the minimum fields needed for OpenClaw's transcript result:

- required transcript text from ElevenLabs `text`
- optionally set the resolved model identifier on the result if helpful for diagnostics
- optionally preserve raw response data only if OpenClaw's provider contract already has a place for it

Important:

- do not make timestamps, diarization segments, or structured word metadata part of the V1 contract
- if ElevenLabs omits a usable `text` field, treat that as an error rather than inventing a partial transcript

## Formats, limits, and failure handling

What the implementation should assume for V1:

- ElevenLabs STT supports normal audio upload via multipart form data
- the service supports common audio/video container formats
- very large uploads, rate limits, auth failures, and transient upstream errors must be treated as provider failure so OpenClaw fallback can continue

### Failure behavior

The provider should:

- throw on HTTP auth errors
- throw on rate-limit or upstream failures
- throw on malformed success responses without transcript text
- not swallow those errors internally

That behavior is desirable because OpenClaw already supports ordered fallback across `tools.media.audio.models`.

### Explicit uncertainty

The exact full set of accepted formats, duration behavior, and every vendor-side limit should be revalidated during implementation against the live docs and one or two real sample files. The design does not depend on exotic format support, only on standard multipart file transcription.

## Minimal V1 Scope

## Must be included

- local plugin with plugin ID `elevenlabs-stt`
- one media-understanding provider with provider ID `elevenlabs`
- explicit config through `plugins.entries`, `models.providers`, and `tools.media.audio.models`
- synchronous file transcription via the ElevenLabs STT endpoint
- mapping of transcript text into OpenClaw's expected result shape
- clean error propagation so fallback entries can run after ElevenLabs failure

## Explicitly deferred

- telephony / `voice-call` integration
- realtime STT
- diarization
- timestamps
- keyterm prompting
- audio-event tagging
- multi-channel transcript handling
- custom OpenClaw core patches
- rich provider-specific config surface beyond minimal scalar options

## Test Plan for V1

## Required tests

- provider registration smoke test
- request construction test for URL, auth header, multipart file field, and `model_id`
- language passthrough test when `language_code` is supplied
- response normalization test for a valid ElevenLabs transcript payload
- malformed response test when `text` is missing or empty
- error propagation test for non-2xx responses so OpenClaw fallback remains possible

## Nice-to-have tests

- one integration-style test using a realistic audio fixture with mocked HTTP
- timeout/rate-limit error classification test
- config-edge test for missing `apiKey` or `baseUrl`

## Later Optional Core / Upstream Work

These are useful, but should stay out of the first implementation slice.

### Worth doing later

- allow structured `providerOptions` for media/audio providers instead of scalar-only values
- improve env-based auth discovery for non-bundled external providers
- consider a cleaner config shape for media-only providers so `models.providers.<id>.models: []` is no longer required

### Why they should wait

- none of them are required to make V1 work
- each one broadens the blast radius beyond the narrow plugin-first slice
- delaying them keeps V1 easier to implement, review, and upstream in smaller PRs

## Known limitation

The current repo uses a small local TypeScript shim for the OpenClaw plugin SDK during `tsc` typechecking. This keeps the V1 setup lightweight, but means typecheck can drift from the real host SDK surface. Real plugin load tests on an OpenClaw host are the primary compatibility check.

## Recommended next implementation step

After this design is accepted, the next step should be a narrow implementation slice:

1. scaffold the plugin metadata and entrypoint
2. implement one provider that calls `POST /v1/speech-to-text`
3. wire the minimal config shape
4. add tests for request mapping, response mapping, and fallback-relevant failure behavior
