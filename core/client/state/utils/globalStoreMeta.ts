/**
 * Meta per `persistState` / `sessionState`: fingerprint della shape, cleanup su cambio storage.
 */
import { bindPersistIdb } from "../persist/storage";
import { deletePersistState } from "../persist/idb";
import { bindSessionIdb } from "../session/storage";
import { deleteSessionState } from "../session/idb";

export type GlobalStoreStorageKind = "persist" | "session";

/** `id` è escluso: può essere rigenerato (es. `v.uuid()`) senza cambiare la chiave IDB. */
export function storeFingerprint(shape: Record<string, unknown>): string {
	return Object.keys(shape)
		.sort()
		.filter((k) => k !== "id")
		.map((k) => `${k}:${JSON.stringify(shape[k])}`)
		.join("|");
}

const pk = (fp: string) => `gs:${fp}`;
const sk = (fp: string) => `local.gs:${fp}`;

const META_LS_KEY = "__fw_state_meta";
type Meta = { storage: GlobalStoreStorageKind; clean: boolean };

function readMeta(fp: string): Meta | null {
	try {
		if (typeof localStorage === "undefined") return null;
		const all = JSON.parse(localStorage.getItem(META_LS_KEY) ?? "{}") as Record<string, Meta>;
		return all[fp] ?? null;
	} catch {
		return null;
	}
}

function writeMeta(fp: string, meta: Meta): void {
	try {
		if (typeof localStorage === "undefined") return;
		const all = JSON.parse(localStorage.getItem(META_LS_KEY) ?? "{}") as Record<string, Meta>;
		all[fp] = meta;
		localStorage.setItem(META_LS_KEY, JSON.stringify(all));
	} catch {
		/* */
	}
}

export function bindManagedStore(
	store: Record<string, unknown>,
	shape: Record<string, unknown>,
	storage: GlobalStoreStorageKind,
): void {
	const fp = storeFingerprint(shape);
	const meta = readMeta(fp);

	const needsClean = meta !== null && (meta.clean || meta.storage !== storage);
	writeMeta(fp, { storage, clean: needsClean });

	const doInit = needsClean
		? Promise.all([deletePersistState(pk(fp)).catch(() => {}), deleteSessionState(sk(fp)).catch(() => {})]).then(
				() => writeMeta(fp, { storage, clean: false }),
			)
		: Promise.resolve();

	void doInit.then(() => {
		if (storage === "persist") bindPersistIdb(store, pk(fp));
		if (storage === "session") bindSessionIdb(store, sk(fp));
	});
}
