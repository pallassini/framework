/** Suffisso `:root { --nome: ... }` → `var(--nome)` (no `#`, unità, ecc.). */
const THEME_SUFFIX_RE = /^[a-zA-Z_][\w-]*$/;

export function themeCustomPropertyVar(suffix: string): string | null {
	if (!THEME_SUFFIX_RE.test(suffix)) return null;
	return `var(--${suffix})`;
}
