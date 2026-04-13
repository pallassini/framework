import { watch } from "../state/effect";
import { createState } from "../state/index";
import type { StateMap } from "../state/utils/store";
import { getStoreSnapshot, setStoreFromSnapshot } from "../state/utils/store";
import { ValidationError, type InferSchema, type InputSchema } from "../validator/properties/defs";
import { v } from "../validator/index";

// ── types ─────────────────────────────────────────────────────────────────────
export type FormStorage = "session" | "persist";
export type FieldBinding = { readonly field: string };

export type FormFieldController = {
	get(): string;
	set(v: string): void;
	validate(): void;
};

type InferObject<S extends Record<string, InputSchema<unknown>>> = {
	[K in keyof S]: InferSchema<S[K]>;
};

export type FormApi<Shape extends Record<string, InputSchema<unknown>>> = {
	values(): InferObject<Shape>;
	reset(): void;
	errors: StateMap<{ [K in keyof Shape]: string | undefined }>;
} & { [K in keyof Shape]: FieldBinding };

// ── internals ─────────────────────────────────────────────────────────────────
const ctlByBinding = new WeakMap<FieldBinding, FormFieldController>();

export function resolveFieldBinding(b: FieldBinding): FormFieldController {
	const c = ctlByBinding.get(b);
	if (!c) throw new Error("[form] unknown field binding");
	return c;
}

function defaultForSchema(s: InputSchema<unknown>): unknown {
	for (const cand of ["", 0, false] as const) {
		try {
			return s.parse(cand);
		} catch {
			/* try next */
		}
	}
	return "";
}

// ── fingerprint + storage keys ────────────────────────────────────────────────
function schemaFingerprint(
	shape: Record<string, InputSchema<unknown>>,
	defaults: Record<string, unknown>,
): string {
	return Object.keys(shape)
		.sort()
		.map((k) => `${k}:${typeof defaults[k]}`)
		.join("|");
}

const persistKey = (id: string) => `form:${id}`;
const sessionKey = (id: string) => `local.form:${id}`;

const META_LS_KEY = "__fw_form_meta";
type FormMeta = { storage: FormStorage | null; clean: boolean };

function readMeta(id: string): FormMeta | null {
	try {
		if (typeof localStorage === "undefined") return null;
		const all = JSON.parse(localStorage.getItem(META_LS_KEY) ?? "{}") as Record<string, FormMeta>;
		return all[id] ?? null;
	} catch {
		return null;
	}
}

function writeMeta(id: string, meta: FormMeta): void {
	try {
		if (typeof localStorage === "undefined") return;
		const all = JSON.parse(localStorage.getItem(META_LS_KEY) ?? "{}") as Record<string, FormMeta>;
		all[id] = meta;
		localStorage.setItem(META_LS_KEY, JSON.stringify(all));
	} catch {
		/* ignore */
	}
}

function clearStorageKey(storage: Storage, key: string): void {
	try {
		storage.removeItem(key);
	} catch {
		/* ignore */
	}
}

const DEBOUNCE_MS = 300;

function bindJsonStorage(store: Record<string, unknown>, key: string, storage: Storage): void {
	try {
		const raw = storage.getItem(key);
		if (raw) {
			const snap = JSON.parse(raw) as Record<string, unknown>;
			if (snap && typeof snap === "object") setStoreFromSnapshot(store, snap);
		}
	} catch {
		/* ignore */
	}

	let tid: ReturnType<typeof setTimeout> | null = null;
	const flush = (): void => {
		if (tid != null) clearTimeout(tid);
		tid = null;
		try {
			storage.setItem(key, JSON.stringify(getStoreSnapshot(store)));
		} catch {
			/* quota */
		}
	};

	watch(() => {
		getStoreSnapshot(store);
		if (tid != null) clearTimeout(tid);
		tid = setTimeout(flush, DEBOUNCE_MS);
	});

	if (typeof window !== "undefined") {
		window.addEventListener("beforeunload", flush);
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") flush();
		});
	}
}

type ValueSig = { (): unknown; (v: unknown): void };

// ── Form ───────────────────────────────────────────────────────────────────────
export function Form<Shape extends Record<string, InputSchema<unknown>>>(options: {
	shape: Shape;
	storage?: FormStorage | null;
	/**
	 * ID esplicita per disambiguare due form con shape identica (es. login vs register
	 * entrambi con `{email, password}`). Opzionale: se omessa usa il fingerprint automatico.
	 */
	id?: string;
}): FormApi<Shape> {
	const { shape, storage = null } = options;
	const keys = Object.keys(shape) as (keyof Shape & string)[];

	const defaults: Record<string, unknown> = {};
	for (const k of keys) defaults[k] = defaultForSchema(shape[k] as InputSchema<unknown>);

	const values = createState(defaults as Record<string, unknown>);
	const errShape: Record<string, string | undefined> = {};
	for (const k of keys) errShape[k] = undefined;
	const errors = createState(errShape);

	const objectSchema = v.object(shape);
	const id = options.id ?? schemaFingerprint(shape as Record<string, InputSchema<unknown>>, defaults);
	const meta = readMeta(id);

	const needsClean = meta !== null && (meta.clean || meta.storage !== storage);

	writeMeta(id, { storage, clean: needsClean });

	const store = values as unknown as Record<string, unknown>;

	const doInit = needsClean
		? Promise.resolve().then(() => {
				if (typeof localStorage !== "undefined") clearStorageKey(localStorage, persistKey(id));
				if (typeof sessionStorage !== "undefined") clearStorageKey(sessionStorage, sessionKey(id));
				writeMeta(id, { storage, clean: false });
			})
		: Promise.resolve();

	doInit.then(() => {
		if (storage === "persist" && typeof localStorage !== "undefined") {
			bindJsonStorage(store, persistKey(id), localStorage);
		}
		if (storage === "session" && typeof sessionStorage !== "undefined") {
			bindJsonStorage(store, sessionKey(id), sessionStorage);
		}
	});

	function validateField(key: string): void {
		const sub = shape[key as keyof Shape] as InputSchema<unknown>;
		const raw = (values as Record<string, ValueSig>)[key]();
		const errSig = (errors as Record<string, ValueSig>)[key];
		try {
			sub.parse(raw);
			errSig(undefined);
		} catch (e) {
			errSig(e instanceof ValidationError ? e.message : "invalid");
		}
	}

	function valuesAll(): InferObject<Shape> {
		const obj: Record<string, unknown> = {};
		for (const k of keys) obj[k] = (values as Record<string, ValueSig>)[k]();
		return objectSchema.parse(obj) as InferObject<Shape>;
	}

	function reset(): void {
		for (const k of keys) {
			(values as Record<string, ValueSig>)[k](defaults[k]);
			(errors as Record<string, ValueSig>)[k](undefined);
		}
	}

	const out: Record<string, unknown> = { values: valuesAll, reset, errors };

	for (const k of keys) {
		const binding: FieldBinding = { field: k };
		ctlByBinding.set(binding, {
			get: () => {
				const v0 = (values as Record<string, ValueSig>)[k]();
				return v0 == null ? "" : String(v0);
			},
			set: (s: string) => {
				(values as Record<string, ValueSig>)[k](s);
				validateField(k);
			},
			validate: () => validateField(k),
		});
		out[k] = binding;
	}

	return out as FormApi<Shape>;
}
