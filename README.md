# openclaw-elevenlabs-stt

Experimental companion project for adding ElevenLabs Speech-to-Text support to OpenClaw's inbound audio pipeline.

## Goal

Use ElevenLabs STT for normal inbound voice/audio messages (e.g. Telegram voice notes, Discord voice attachments) via OpenClaw's `tools.media.audio` path, while keeping the implementation maintainable across OpenClaw updates.

## Current intent

- Build as much as possible as a plugin/extension
- Minimize required OpenClaw core changes
- Upstream the necessary core hook/capability work to OpenClaw
- Keep this repo publishable later

## Status

Planning only.
