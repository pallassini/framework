import type { DomProps, UiNode } from "../tag/props";

export type TagFn = (props: DomProps) => UiNode;

const tagFns = new Map<string, TagFn>();

/** Barrel `tag/index.ts`: ogni export funzione → `<nome />`. */
export function ingestTagModule(ns: Record<string, unknown>): void {
	for (const [k, v] of Object.entries(ns)) {
		if (k.startsWith("__")) continue;
		if (typeof v === "function") tagFns.set(k, v as TagFn);
	}
}

export function resolveTagFn(name: string): TagFn | undefined {
	return tagFns.get(name);
}
