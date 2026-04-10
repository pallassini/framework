/// <reference types="vite/client" />
import type { Shell } from "./types";
import { primeRuntimeAndHot, resumeAfterClientHmr, setupRendererAndNav } from "./host";

export type { Component, Shell } from "./types";

export function App(shell: Shell): void {
	// 1. HMR del modulo `client`: riusa `__fwAppRuntime`, nuova shell, ridisegna.
	if (resumeAfterClientHmr(shell)) return;

	// 2. `#root` obbligatorio per montare.
	const root = document.getElementById("root");
	if (!root) return;

	// 3. Pipeline di navigazione + prima URL (`setupRendererAndNav` → `bind` + `render`).
	const bridge = setupRendererAndNav(shell, root);

	// 4. Handle globale e Vite `hot` (solo patch JS).
	primeRuntimeAndHot(bridge);
}
