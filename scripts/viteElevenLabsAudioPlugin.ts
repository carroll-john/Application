import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

// Serves the ElevenLabs voice AudioWorklet modules from this origin so the CSP
// can keep script-src 'self' (no blob:, data: or cdn.jsdelivr.net). Files are
// copied from the installed packages, so they always match the SDK version.
export const ELEVENLABS_AUDIO_BASE = "/elevenlabs-audio";

function resolveAudioFiles(): Record<string, string> {
  const modules = path.resolve(process.cwd(), "node_modules");
  const clientDir = path.join(modules, "@elevenlabs/client");
  const samplerateDir = path.join(modules, "@alexanderolsen/libsamplerate-js");
  const files = {
    "rawAudioProcessor.js": path.join(clientDir, "worklets/rawAudioProcessor.js"),
    "audioConcatProcessor.js": path.join(clientDir, "worklets/audioConcatProcessor.js"),
    "libsamplerate.worklet.js": path.join(samplerateDir, "dist/libsamplerate.worklet.js"),
  };
  for (const source of Object.values(files)) {
    if (!fs.existsSync(source)) {
      throw new Error(`ElevenLabs voice worklet not found: ${source}. Run npm install.`);
    }
  }
  return files;
}

export function viteElevenLabsAudioPlugin(): Plugin {
  const files = resolveAudioFiles();

  return {
    name: "elevenlabs-audio-worklets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const prefix = `${ELEVENLABS_AUDIO_BASE}/`;
        if (!req.url?.startsWith(prefix)) return next();
        const source = files[req.url.slice(prefix.length).split("?")[0]];
        if (!source) return next();
        res.setHeader("content-type", "application/javascript");
        res.end(fs.readFileSync(source));
      });
    },
    generateBundle() {
      for (const [name, source] of Object.entries(files)) {
        this.emitFile({
          type: "asset",
          fileName: `${ELEVENLABS_AUDIO_BASE.slice(1)}/${name}`,
          source: fs.readFileSync(source),
        });
      }
    },
  };
}
