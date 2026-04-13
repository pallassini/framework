const injected = new Set<string>();

export function ensureInjected(id: string, css: string): void {
	if (injected.has(id) || !css) return;
	injected.add(id);
	if (typeof document === "undefined") return;
	const el = document.createElement("style");
	el.setAttribute("data-fw", id);
	el.textContent = css;
	document.head.appendChild(el);
}

export function injectRule(id: string, rule: string): void {
	if (typeof document === "undefined") return;
	let el = document.querySelector<HTMLStyleElement>(`style[data-fw="${id}"]`);
	if (!el) {
		el = document.createElement("style");
		el.setAttribute("data-fw", id);
		document.head.appendChild(el);
	}
	const sheet = el.sheet;
	if (!sheet) return;
	try {
		sheet.insertRule(rule, sheet.cssRules.length);
	} catch {
		/* noop */
	}
}
