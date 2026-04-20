import type { DbRow } from "./types";

/**
 * Azione inversa registrata durante la transazione.
 * Viene eseguita in ordine inverso se qualcosa fallisce.
 */
type InverseOp = () => Promise<void> | void;

type TxApi = {
	/** Registra un'operazione inversa (usata internamente da `txWrap`). */
	onRollback(op: InverseOp): void;
};

/**
 * Best-effort transaction: esegue `fn`. Se lancia, prova a invertire in ordine LIFO
 * le mutazioni registrate. Non è ACID — il motore Zig persiste immediatamente —
 * ma copre i casi comuni (crea/aggiorna/cancella su più tabelle).
 */
export async function runTx<T>(
	fn: (tx: TxApi) => Promise<T>,
	opts?: { onRollbackError?: (e: unknown) => void },
): Promise<T> {
	const inverse: InverseOp[] = [];
	const tx: TxApi = {
		onRollback(op) {
			inverse.push(op);
		},
	};
	try {
		return await fn(tx);
	} catch (err) {
		for (let i = inverse.length - 1; i >= 0; i--) {
			const op = inverse[i]!;
			try {
				await op();
			} catch (e) {
				if (opts?.onRollbackError) opts.onRollbackError(e);
				else console.error("[fwdb/tx] rollback op failed:", e);
			}
		}
		throw err;
	}
}

/**
 * Wrapper leggero su un accessor tabellare che registra rollback automaticamente.
 * (Usato internamente: opzionale per l'utente, che può usare `tx.onRollback` manualmente.)
 */
export function recordCreate<T extends DbRow>(
	tx: TxApi,
	del: (id: string) => Promise<unknown>,
	rows: readonly T[],
): void {
	const ids = rows.map((r) => r.id);
	tx.onRollback(async () => {
		for (const id of ids) await del(id).catch(() => undefined);
	});
}

export function recordUpdate<T extends DbRow>(
	tx: TxApi,
	restore: (row: T) => Promise<unknown>,
	previous: readonly T[],
): void {
	const snap = previous.map((r) => ({ ...r } as T));
	tx.onRollback(async () => {
		for (const r of snap) await restore(r).catch(() => undefined);
	});
}

export function recordDelete<T extends DbRow>(
	tx: TxApi,
	recreate: (row: T) => Promise<unknown>,
	previous: readonly T[],
): void {
	const snap = previous.map((r) => ({ ...r } as T));
	tx.onRollback(async () => {
		for (const r of snap) await recreate(r).catch(() => undefined);
	});
}

export type { TxApi };
