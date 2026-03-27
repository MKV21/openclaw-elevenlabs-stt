import path from "node:path";
import { defineConfig } from "vitest/config";

const openClawSrcRoot = path.resolve(import.meta.dirname, "../openclaw/src");

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^openclaw\/(.*)$/,
        replacement: `${openClawSrcRoot}/$1`,
      },
    ],
  },
  test: {
    environment: "node",
  },
});
