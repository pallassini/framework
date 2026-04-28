/**
 * Entry IIFE → `public/booker.js`: importa il default di `routes/booker/index.tsx` e lo monta su `[data-booking-widget]`.
 */
import bookerCss from "../index.css?inline";
import { mount } from "client";
import Booker from "../routes/booker/index";

function injectBaseCss(): void {
	const id = "fw-booker-widget-styles";
	if (document.getElementById(id)) return;
	const style = document.createElement("style");
	style.id = id;
	style.textContent = bookerCss;
	document.head.appendChild(style);
}

function mountWidgets(): void {
	injectBaseCss();
	const nodes = document.querySelectorAll("[data-booking-widget]");
	for (let i = 0; i < nodes.length; i++) {
		const el = nodes[i] as HTMLElement;
		mount(Booker(), el);
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => mountWidgets());
} else {
	mountWidgets();
}
