import { watch } from "../state/effect";
import { createState } from "../state/index";
import type { StateMap } from "../state/utils/store";
import { getStoreSnapshot, setStoreFromSnapshot } from "../state/utils/store";
import { ValidationError, type InferSchema, type InputSchema } from "../validator/properties/defs";
import { v } from "../validator/index";
import { FIELD_OPTIONAL, readFieldType, type FieldTypeDesc } from "../validator/field-meta";

// ── types ─────────────────────────────────────────────────────────────────────
export type FormStorage = "session" | "persist";
export type FieldBinding = { readonly field: string };

/**
 * Stile di default propagato dal `Form` a tutti gli `<Input field={...}>`.
 * Le singole prop dell'`<Input>` hanno sempre la precedenza su questi valori.
 */
export type FormStyle = {
	mode?: "normal" | "dark" | "light" | "auto";
	accentColor?: string;
	restingColor?: string;
	showFocusShadow?: boolean;
	borderWidth?: number | string;
	size?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
	round?: number | string;
};

export type FormFieldController = {
	get(): string;
	set(v: string): void;
	/**
	 * Setter "tipato": accetta qualsiasi valore grezzo (es. `number` da un input
	 * custom) e lo scrive direttamente nella signal **senza stringificarlo**.
	 * Utile per UI dedicate (es. InputNumber custom che lavora in `number`).
	 */
	setRaw(v: unknown): void;
	validate(): void;
	/**
	 * Messaggio d'errore reattivo per questo campo (o `undefined` se valido).
	 * Legge direttamente la state-map `errors` del form, quindi le UI che lo
	 * richiamano si aggiornano automaticamente senza bisogno di passare `error`
	 * esplicitamente all'`<Input>`.
	 */
	error(): string | undefined;
	/**
	 * `true` se lo schema del campo è marcato `.optional()`. Le UI lo usano per
	 * mostrare automaticamente un'etichetta "opzionale" (niente da passare a mano).
	 */
	optional(): boolean;
	/**
	 * Colore di sfondo del contenitore (es. bg del Popmenu/Card che ospita il form),
	 * impostato una volta sola su `Form({...})` e propagato a tutti gli `<Input>`
	 * tramite `field`. Le UI lo usano per "tagliare" il bordo con la label/errore.
	 */
	bg(): string | undefined;
	/**
	 * Metadati del tipo dello schema (catturati dal validator, es. `.min()/.max()/
	 * .int()/.step()`). Le UI degli `<Input>` li usano per derivare automaticamente
	 * i constraint da `v.number().min(1).max(100)` senza dover ripetere le prop.
	 */
	meta(): FieldTypeDesc | undefined;
	/**
	 * Stile di default propagato dal `Form` (mode, colori, bordo, shadow).
	 * Le prop esplicite del singolo `<Input>` sovrascrivono questi valori.
	 */
	style(): FormStyle | undefined;
};

type InferObject<S extends Record<string, InputSchema<unknown>>> = {
	[K in keyof S]: InferSchema<S[K]>;
};

export type FormApi<Shape extends Record<string, InputSchema<unknown>>> = {
	values(): InferObject<Shape>;
	reset(): void;
	errors: StateMap<{ [K in keyof Shape]: string | undefined }>;
	/**
	 * `true` se tutti i campi del form sono validi rispetto ai rispettivi schemi.
	 * Reattiva: legge i signal dei valori e può essere usata direttamente in stili,
	 * `disabled`, `class`, ecc. (es. `disabled={() => !form.valid()}`).
	 */
	valid(): boolean;
	/**
	 * Helper di submit: valida tutti i campi, se OK chiama `handler(values)` (può essere
	 * async) e ritorna la Promise del risultato. Se non valido, aggiorna gli `errors`
	 * e ritorna `undefined` senza chiamare l'handler.
	 */
	submit<R>(handler: (values: InferObject<Shape>) => R | Promise<R>): Promise<R | undefined>;
} & { [K in keyof Shape]: FieldBinding };

// ── internals ─────────────────────────────────────────────────────────────────
const ctlByBinding = new WeakMap<FieldBinding, FormFieldController>();

export function resolveFieldBinding(b: FieldBinding): FormFieldController {
	const c = ctlByBinding.get(b);
	if (!c) throw new Error("[form] unknown field binding");
	return c;
}

/**
 * Default per uno schema al boot del form.
 * - `number` → `undefined` (campo vuoto, così nessun "0" pre-digitato e nessun
 *   errore "expected number" prima che l'utente scriva).
 * - altri → prima candidato che soddisfa lo schema fra `""`, `0`, `false`; se
 *   nessuno passa fallback a `""` (rimane "vuoto" lato UI).
 */
function defaultForSchema(s: InputSchema<unknown>): unknown {
	const ft = readFieldType(s);
	if (ft?.kind === "number") return undefined;
	for (const cand of ["", 0, false] as const) {
		try {
			return s.parse(cand);
		} catch {
			/* try next */
		}
	}
	return "";
}

/**
 * Coerce a string value coming from a DOM `<input>` into the runtime type
 * expected by the schema. Used by the controller `set(string)` so that schemas
 * like `v.number()` receive a `number` (not `"3"`) and don't fail with
 * "expected number" during validation/submit.
 */
function coerceForSchema(s: InputSchema<unknown>, raw: string): unknown {
	const ft = readFieldType(s);
	if (ft?.kind === "number") {
		if (raw === "") return undefined;
		const n = Number(raw);
		return Number.isFinite(n) ? n : raw;
	}
	if (ft?.kind === "boolean") {
		if (raw === "") return undefined;
		return raw === "true" || raw === "1";
	}
	return raw;
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
	/**
	 * Colore di sfondo del contenitore che ospita il form (es. bg del Popmenu/Card).
	 * Viene propagato automaticamente a tutti gli `<Input field={...}>` per permettere
	 * a label/errore di "tagliare" il bordo del box senza doverlo ripetere su ogni Input.
	 */
	bg?: string;
	/**
	 * Stile di default applicato a tutti gli `<Input field={...}>` del form.
	 * Le singole prop dell'`<Input>` hanno sempre la precedenza.
	 * Comodo per impostare `mode: "light"` una volta sola su un form dentro
	 * un Popmenu bianco, invece di ripeterla su ogni campo.
	 */
	mode?: FormStyle["mode"];
	accentColor?: string;
	restingColor?: string;
	showFocusShadow?: boolean;
	borderWidth?: number | string;
	size?: FormStyle["size"];
	round?: FormStyle["round"];
}): FormApi<Shape> {
	const { shape, storage = null, bg } = options;
	const formStyle: FormStyle = {
		mode: options.mode,
		accentColor: options.accentColor,
		restingColor: options.restingColor,
		showFocusShadow: options.showFocusShadow,
		borderWidth: options.borderWidth,
		size: options.size,
		round: options.round,
	};
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

	/**
	 * Reattiva: tenta di parsare tutti i campi col proprio schema senza scrivere
	 * gli errors (così non causa render loop). Invocando i signal dei valori,
	 * qualsiasi watcher/stile che chiami `valid()` si ri-esegue al cambio valori.
	 */
	function valid(): boolean {
		let ok = true;
		for (const k of keys) {
			const sub = shape[k as keyof Shape] as InputSchema<unknown>;
			const raw = (values as Record<string, ValueSig>)[k]();
			try {
				sub.parse(raw);
			} catch {
				ok = false;
			}
		}
		return ok;
	}

	async function submit<R>(
		handler: (values: InferObject<Shape>) => R | Promise<R>,
	): Promise<R | undefined> {
		for (const k of keys) validateField(k);
		let parsed: InferObject<Shape>;
		try {
			parsed = valuesAll();
		} catch {
			return undefined;
		}
		return await handler(parsed);
	}

	const out: Record<string, unknown> = { values: valuesAll, reset, errors, valid, submit };

	for (const k of keys) {
		const binding: FieldBinding = { field: k };
		/** Verifica se lo schema del campo è marcato `.optional()` (tag Symbol). */
		const sub = shape[k] as unknown as Record<PropertyKey, unknown>;
		const isOptional = sub != null && (sub as Record<symbol, unknown>)[FIELD_OPTIONAL] === true;
		const subSchema = shape[k] as InputSchema<unknown>;
		ctlByBinding.set(binding, {
			get: () => {
				const v0 = (values as Record<string, ValueSig>)[k]();
				return v0 == null ? "" : String(v0);
			},
			set: (s: string) => {
				(values as Record<string, ValueSig>)[k](coerceForSchema(subSchema, s));
				validateField(k);
			},
			setRaw: (raw: unknown) => {
				(values as Record<string, ValueSig>)[k](raw);
				validateField(k);
			},
			validate: () => validateField(k),
			error: () => (errors as Record<string, ValueSig>)[k]() as string | undefined,
			optional: () => isOptional,
			bg: () => bg,
			meta: () => readFieldType(subSchema),
			style: () => formStyle,
		});
		out[k] = binding;
	}

	return out as FormApi<Shape>;
}
