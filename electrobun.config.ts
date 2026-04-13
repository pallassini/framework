import type { ElectrobunConfig } from "electrobun";
import { electrobunPathAliasesPlugin } from "./core/desktop/electrobun-path-aliases.plugin";

/**
 * `dev` → `bun dev` / `electrodun dev` / `bun run build desktop dev`
 * `prod` → `bun run build desktop` (default stable/canary), output release
 */
const desktopBuildRoot =
	process.env.FRAMEWORK_DESKTOP_OUT?.trim().toLowerCase() === "prod"
		? "build/desktop/prod"
		: "build/desktop/dev";

export default {
  app: {
    name: "APP",
    identifier: "com.example.app",
    version: "0.0.1",
  },
  build: {
    buildFolder: desktopBuildRoot,
    /**
     * Sotto `prod` ma non uguale a `buildFolder` come path: Electrobun svuota solo questa sottocartella
     * prima di spostare zip/tar.zst/update.json (se fosse uguale a `build/desktop/prod` cancellerebbe tutto).
     */
    artifactFolder: "build/desktop/prod/packages",
    watchIgnore: [
      "client/**",
      "core/client/**",
      "build/web/**",
    ],
    bun: {
      entrypoint: "core/desktop/index.ts",
      tsconfig: "./tsconfig.json",
      plugins: [electrobunPathAliasesPlugin()],
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
    /** Con `--env=dev` salta codesign / notarization (tipico di `build desktop dev`). */
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
