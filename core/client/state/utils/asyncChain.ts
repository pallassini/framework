/**
 * Incoda una funzione dopo la fine della promessa precedente, **anche se quella è fallita**,
 * così una serie di scritture async (es. IndexedDB) non può completare fuori ordine.
 */
export function enqueueAsyncChain(tail: Promise<void>, fn: () => Promise<void>): Promise<void> {
	return tail.then(fn, fn);
}
