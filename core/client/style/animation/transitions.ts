export type TransitionConfig = {
	property?: string | string[];
	duration?: number;
	ease?: string;
	delay?: number;
};

/** Allineato a `:root { --duration }` in `client/index.css`. */
const PRESETS: Record<string, string> = {
	all: "all var(--duration) ease",
	colors:
		"color var(--duration) ease, background-color var(--duration) ease, border-color var(--duration) ease, fill var(--duration) ease",
	opacity: "opacity var(--duration) ease",
	transform: "transform var(--duration) ease",
	shadow: "box-shadow var(--duration) ease",
	size: "width var(--duration) ease, height var(--duration) ease",
	none: "none",
};

export function buildTransition(config: string | TransitionConfig): string {
	if (typeof config === "string") {
		return PRESETS[config] ?? config;
	}
	const props = Array.isArray(config.property) ? config.property.join(", ") : (config.property ?? "all");
	const duration = config.duration != null ? `${config.duration}ms` : "var(--duration)";
	const ease = config.ease ?? "ease";
	const delay = config.delay != null ? ` ${config.delay}ms` : "";
	return `${props} ${duration} ${ease}${delay}`;
}
