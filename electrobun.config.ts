
import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "APP",
    identifier: "com.example.app",
    version: "0.0.1",
  },
  build: {
    buildFolder: "build/desktop/bundle",
    artifactFolder: "build/desktop/dist",
  //  watchIgnore: ["client/**", "core/client/**"],
    bun: {
      entrypoint: "core/desktop/index.ts",
      naming: {
        entry: "index.js",
        chunk: "[name]-[hash].js",
        asset: "[name]-[hash][ext]",
      },
    },
    copy: {
      "build/web/index.html": "views/main/index.html",
      "build/web/assets": "views/main/assets",
    },
    mac: {
      bundleCEF: false,
    },
    linux: {
      bundleCEF: false,
    },
    win: {
      bundleCEF: false,
    },
  },
} satisfies ElectrobunConfig;