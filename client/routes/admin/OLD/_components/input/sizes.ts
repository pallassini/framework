import { device } from "client";
import { clientConfig } from "../../../../../config";
import type { InputSize } from "./index";

/**
 * Misure reattive per il componente `<Input>` in funzione di `size` (1..10) e del
 * viewport corrente (`mob`/`tab`/`des`). Legge direttamente da `clientConfig.input`
 * così la scala è centralizzata e coerente su mobile/tablet/desktop.
 *
 * Tutte le funzioni di questo file SONO REATTIVE: chiamano `device()` che è una
 * signal → se usate dentro `watch()`/`style={...}` si riaggiornano al resize.
 */

type InputMetrics = {
  font: string;
  padX: string;
  padY: string;
  radius: string;
  labelFloating: string;
};

/** Restituisce la riga di metriche per `size` nel viewport corrente (reattivo). */
export function inputMetrics(size: InputSize): InputMetrics {
  const vp = device() as "mob" | "tab" | "des";
  const row = (clientConfig.input as Record<string, {
    font: Record<"mob" | "tab" | "des", string>;
    padX: Record<"mob" | "tab" | "des", string>;
    padY: Record<"mob" | "tab" | "des", string>;
    radius: Record<"mob" | "tab" | "des", string>;
    labelFloating: Record<"mob" | "tab" | "des", string>;
  }>)[String(size)];
  return {
    font: row.font[vp],
    padX: row.padX[vp],
    padY: row.padY[vp],
    radius: row.radius[vp],
    labelFloating: row.labelFloating[vp],
  };
}
