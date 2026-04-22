/**
 * Log diagnostici per tema Input / Popmenu. Rimuovi o disattiva `INPUT_DEBUG`
 * quando non serve più.
 */
export const INPUT_DEBUG = true;

const lastByKey = new Map<string, string>();

export function logInputDebug(key: string, data: unknown): void {
  if (!INPUT_DEBUG) return;
  try {
    const s = JSON.stringify(data);
    if (lastByKey.get(key) === s) return;
    lastByKey.set(key, s);
  } catch {
    if (lastByKey.get(key) === String(data)) return;
    lastByKey.set(key, String(data));
  }
  console.log(key, data);
}
