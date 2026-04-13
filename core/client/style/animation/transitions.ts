export type TransitionConfig = {
	property?: string | string[];
	duration?: number;
	ease?: string;
	delay?: number;
};

const PRESETS: Record<string, string> = {
	all: "all 200ms ease",
	colors: "color 200ms ease, background-color 200ms ease, border-color 200ms ease, fill 200ms ease",
	opacity: "opacity 200ms ease",
	transform: "transform 200ms ease",
	shadow: "box-shadow 200ms ease",
	size: "width 200ms ease, height 200ms ease",
	none: "none",
};

export function buildTransition(config: string | TransitionConfig): string {
	if (typeof config === "string") {
		return PRESETS[config] ?? config;
	}
	const props = Array.isArray(config.property) ? config.property.join(", ") : (config.property ?? "all");
	const duration = config.duration ?? 200;
	const ease = config.ease ?? "ease";
	const delay = config.delay != null ? ` ${config.delay}ms` : "";
	return `${props} ${duration}ms ${ease}${delay}`;
}
