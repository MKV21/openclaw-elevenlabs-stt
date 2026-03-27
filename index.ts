import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { elevenlabsMediaUnderstandingProvider } from "./media-understanding-provider.js";

export default definePluginEntry({
  id: "elevenlabs-stt",
  name: "ElevenLabs STT",
  description: "ElevenLabs batch speech-to-text provider for OpenClaw media understanding",
  register(api) {
    api.registerMediaUnderstandingProvider(elevenlabsMediaUnderstandingProvider);
  },
});
