import { ensureInjected } from "./animation/inject";

/**
 * Default globale: qualunque cambio di proprietà CSS su qualunque elemento passa da una `transition`
 * con durata = `var(--duration)` (definita in `client/index.css` `:root`).
 *
 * Override per elemento via `s`:
 * - `duration-0` / `duration-500` → sovrascrive la sola `transition-duration`.
 * - `linear` / `ease-out` / `ease-in` / `ease-in-out` → sovrascrive la `transition-timing-function`.
 */
const FW_BASE_RESET_CSS = `
*, *::before, *::after {
  transition-property: all;
  transition-duration: var(--duration, 300ms);
  transition-timing-function: ease;
}
`;

export function ensureBaseResetCss(): void {
	ensureInjected("fw-base-reset", FW_BASE_RESET_CSS);
}
