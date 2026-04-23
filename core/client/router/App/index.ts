/// <reference types="vite/client" />
import { auth } from "../../auth";
import { installPreventMobileGestureZoom } from "../../preventMobileGestureZoom";
import type { Shell } from "./types";
import { primeRuntimeAndHot, resumeAfterClientHmr, setupRendererAndNav } from "./host";

export type { Component, Shell } from "./types";

export function App(shell: Shell): void {
	if (resumeAfterClientHmr(shell)) {
		void auth.refresh(); // → server.auth.me, aggiorna auth.me.*
		return;
	}
	installPreventMobileGestureZoom();
	void auth.refresh(); // → server.auth.me, aggiorna auth.me.*
	const root = document.getElementById("root");
	if (!root) return;
	const bridge = setupRendererAndNav(shell, root);
	primeRuntimeAndHot(bridge);
}

if (import.meta.hot) import.meta.hot.accept();
