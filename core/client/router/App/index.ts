/// <reference types="vite/client" />
import type { Shell } from "./types";
import { primeRuntimeAndHot, resumeAfterClientHmr, setupRendererAndNav } from "./host";

export type { Component, Shell } from "./types";

export function App(shell: Shell): void {
	if (resumeAfterClientHmr(shell)) return;
	const root = document.getElementById("root");
	if (!root) return;
	const bridge = setupRendererAndNav(shell, root);
	primeRuntimeAndHot(bridge);
}

if (import.meta.hot) import.meta.hot.accept();
