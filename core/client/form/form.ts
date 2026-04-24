import { watch } from "../state/effect";
import { createState, signal, type Signal } from "../state/index";
import type { StateMap } from "../state/utils/store";
import { getStoreSnapshot, setStoreFromSnapshot } from "../state/utils/store";
import { ValidationError, type InferSchema, type InputSchema } from "../validator/properties/defs";
import { v } from "../validator/index";
import { FIELD_OPTIONAL, readFieldType, type FieldTypeDesc } from "../validator/field-meta";

// ── types ─────────────────────────────────────────────────────────────────────
export type FormStorage = "session" | "persist";
/**
 * Riferimento a un campo di un `Form`: `formId` allinea a `Form({ id })` o al fingerprint
 * (evita conflitti se due form con stessa `shape` → passa `id: "..."` distinti).
 * Usato per `data-fw-form` / `data-fw-field` sull'`<input>` (navigazione Enter).
 */
export type FieldBinding = { readonly field: string; readonly formId: string };

/**
 * Stile di default propagato dal `Form` a tutti gli `<Input field={...}>`.
 * Le singole prop dell'`<Input>` hanno sempre la precedenza su questi valori.
 */
export type FormStyle = {
	/** Solo `"light"` o `"dark"`. Se omesso, gli input usano il preset scuro. */
	mode?: "dark" | "light";
	/** Bordo/ring a focus. Equivale a `focusColor` se non passi l'altro. */
	accentColor?: string;
	/** Bordo a focus; `accentColor` ha priorità se entrambi impostati. */
	focusColor?: string;
	/** Bordo (e label) a riposo, senza focus. */
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
	 * Messaggio d'errore reattivo per questo campo: stringa vuota `""` se valido.
	 * Legge direttamente la state-map `errors` del form, quindi le UI che lo
	 * richiamano si aggiornano automaticamente senza bisogno di passare `error`
	 * esplicitamente all'`<Input>`.
	 */
	error(): string;
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
	errors: StateMap<{ [K in keyof Shape]: string }>;
	/**
	 * Validità come segnale derivato (`true` se tutti i campi passano lo schema).
	 * - Condizioni stile: puoi passare direttamente `form.valid`.
	 * - `show`: puoi passare direttamente `form.valid`.
	 * - Controlli imperativi (`if`): leggi il valore con `form.valid()`.
	 */
	valid: Signal<boolean>;
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

type FormEnterRegistry = {
	keys: readonly string[];
	onEnter?: () => void | Promise<void>;
	/** Stesso criterio di `form.valid()`: se `true`, Enter invia da **qualsiasi** campo. */
	isValid: () => boolean;
};
const formEnterRegistry = new Map<string, FormEnterRegistry>();
let formEnterListenerAttached = false;

/**
 * Preferisce la copia “visiva” del campo: componenti come `Popmenu` montano lo stesso
 * `extended()` anche in un host di misura nascosto (`visibility: hidden`) prima
 * della shell; il **primo** match in ordine di documento è invisibile e sposta il
 * focus in modo inutilizzabile. Scorriamo i candidati **dal fondo** e saltiamo
 * elementi nascosti / `display: none`.
 */
function focusFieldInput(formId: string, fieldName: string): void {
	if (typeof document === "undefined") return;
	const candidates: HTMLElement[] = [];
	for (const el of document.querySelectorAll("[data-fw-form]")) {
		if (!(el instanceof HTMLElement)) continue;
		if (el.getAttribute("data-fw-form") !== formId) continue;
		if (el.getAttribute("data-fw-field") !== fieldName) continue;
		candidates.push(el);
	}
	if (candidates.length === 0) return;
	const visibleEnough = (el: HTMLElement) => {
		const s = getComputedStyle(el);
		if (s.visibility === "hidden" || s.display === "none") return false;
		return true;
	};
	for (let i = candidates.length - 1; i >= 0; i--) {
		const el = candidates[i]!;
		if (!visibleEnough(el)) continue;
		el.focus();
		return;
	}
	/** Estremo: tutte le copie filtrate (non dovrebbe accadere) → focus sull’ultima nel DOM. */
	candidates[candidates.length - 1]!.focus();
}

function onGlobalFormKeydown(e: KeyboardEvent): void {
	if (e.isComposing) return;
	if (e.key !== "Enter" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
	const t = e.target;
	if (!t || !(t instanceof Element)) return;
	if (t.tagName !== "INPUT" && t.tagName !== "TEXTAREA" && t.tagName !== "SELECT") return;
	const formId = t.getAttribute("data-fw-form");
	const field = t.getAttribute("data-fw-field");
	if (formId == null || formId === "" || field == null || field === "") return;
	const reg = formEnterRegistry.get(formId);
	if (!reg) return;
	const { keys, onEnter } = reg;
	const i = keys.indexOf(field);
	if (i < 0) return;
	if (e.key === "Enter") {
		const ok = reg.isValid();
		e.preventDefault();
		if (ok) {
			if (onEnter) void Promise.resolve(onEnter());
			return;
		}
		if (i < keys.length - 1) {
			focusFieldInput(formId, keys[i + 1]!);
			return;
		}
		if (onEnter) void Promise.resolve(onEnter());
		return;
	}
	/** Frecce: solo su `<input>`, per non togliere ↑/↓ a `select` o `textarea` (righe / opzioni). */
	if (t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
	if (e.key === "ArrowDown" && i < keys.length - 1) {
		e.preventDefault();
		focusFieldInput(formId, keys[i + 1]!);
		return;
	}
	if (e.key === "ArrowUp" && i > 0) {
		e.preventDefault();
		focusFieldInput(formId, keys[i - 1]!);
	}
}

function ensureFormEnterListener(): void {
	if (typeof document === "undefined" || formEnterListenerAttached) return;
	formEnterListenerAttached = true;
	document.addEventListener("keydown", onGlobalFormKeydown, true);
}

function isOptionalFieldSchema(s: unknown): boolean {
	return (
		typeof s === "object" && s != null && (s as Record<symbol, unknown>)[FIELD_OPTIONAL] === true
	);
}

/**
 * Dopo un `sub.parse` andato a buon fine: se il campo **non** è `.optional()` e lo schema
 * è trattato come stringa o password, stringa vuota o solo spazi → errore `""` (obbligo senza
 * testo sotto l’`Input`). In `shape` basta `v.string()`; non serve chain `.nonempty("")`.
 * Se invece `parse` lancia (es. `.email()` / `v.password()` / `.nonempty("msg")`) vale quel messaggio.
 */
function parseFieldValueForForm(
	sub: InputSchema<unknown>,
	raw: unknown,
	isOptional: boolean,
):
	| { ok: true; value: unknown }
	| { ok: false; message: string } {
	let parsed: unknown;
	try {
		parsed = sub.parse(raw);
	} catch (e) {
		return { ok: false, message: e instanceof ValidationError ? e.message : "invalid" };
	}
	if (isOptional) return { ok: true, value: parsed };
	const ft = readFieldType(sub);
	if (ft?.kind === "string" || ft?.kind === "password") {
		if (String(parsed as string).trim() === "") return { ok: false, message: "" };
	}
	return { ok: true, value: parsed };
}

// ── Form ───────────────────────────────────────────────────────────────────────
export function Form<Shape extends Record<string, InputSchema<unknown>>>(options: {
	/**
	 * I campi **non** `.optional()` con tipo `string` / `password` nello schema sono
	 * trattati come obbligatori (vuoto o solo spazi → errore `""`) senza aggiungere
	 * `.nonempty("")` a ogni `v.string()`. `valid()`, `values()` e `validateField` usano
	 * la stessa regola.
	 */
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
	focusColor?: string;
	restingColor?: string;
	showFocusShadow?: boolean;
	borderWidth?: number | string;
	size?: FormStyle["size"];
	round?: FormStyle["round"];
	/**
	 * Se `true` (default), **Enter** e **ArrowDown** passano al campo successivo, **ArrowUp**
	 * al precedente (su `<input>` vincolati al form). Con **Enter**: se `form.valid()` è già
	 * `true`, `onEnter` parte da **qualsiasi** campo; se ci sono errori, si va al successivo
	 * o, sull’ultimo, si lancia ugualmente `onEnter` (es. per mostrare errori). `textarea` /
	 * `select` non usano le frecce per navigare. Due form stessa `shape` → `id` distinti.
	 */
	enterNavigate?: boolean;
	/**
	 * Invio via tastiera. Con **Enter**: se la shape è **già** valida, viene chiamata da
	 * qualsiasi campo; altrimenti, invio solo sull’**ultimo** campo o dopo aver compilato tutto.
	 * Esempio: `onEnter: () => { void form.submit(h) }`.
	 */
	onEnter?: () => void | Promise<void>;
}): FormApi<Shape> {
	const { shape, storage = null, bg } = options;
	const formStyle: FormStyle = {
		mode: options.mode,
		accentColor: options.accentColor,
		focusColor: options.focusColor,
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
	const errShape: Record<string, string> = {};
	for (const k of keys) errShape[k] = "";
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
		const isOpt = isOptionalFieldSchema(sub);
		const r = parseFieldValueForForm(sub, raw, isOpt);
		if (!r.ok) errSig(r.message);
		else errSig("");
	}

	function valuesAll(): InferObject<Shape> {
		const obj: Record<string, unknown> = {};
		for (const k of keys) {
			const sub = shape[k as keyof Shape] as InputSchema<unknown>;
			const raw = (values as Record<string, ValueSig>)[k]();
			const isOpt = isOptionalFieldSchema(sub);
			const r = parseFieldValueForForm(sub, raw, isOpt);
			if (!r.ok) throw new ValidationError(r.message);
			obj[k] = r.value;
		}
		return objectSchema.parse(obj) as InferObject<Shape>;
	}

	function reset(): void {
		for (const k of keys) {
			(values as Record<string, ValueSig>)[k](defaults[k]);
			(errors as Record<string, ValueSig>)[k]("");
		}
	}

	/**
	 * Segnale derivato: stessa logica di prima, ma i consumatori (stile, testo, …)
	 * si sottoscrivono tramite `watch` ai signal dei valori.
	 */
	const valid = signal((): boolean => {
		for (const k of keys) {
			const sub = shape[k as keyof Shape] as InputSchema<unknown>;
			const raw = (values as Record<string, ValueSig>)[k]();
			const isOpt = isOptionalFieldSchema(sub);
			const r = parseFieldValueForForm(sub, raw, isOpt);
			if (!r.ok) return false;
		}
		return true;
	});

	if (options.enterNavigate !== false) {
		ensureFormEnterListener();
		formEnterRegistry.set(id, {
			keys,
			onEnter: options.onEnter,
			isValid: () => valid(),
		});
	} else {
		formEnterRegistry.delete(id);
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
		const binding: FieldBinding = { field: k, formId: id };
		/** Verifica se lo schema del campo è marcato `.optional()` (tag Symbol). */
		const subSchema = shape[k] as InputSchema<unknown>;
		const isOptional = isOptionalFieldSchema(subSchema);
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
			error: () => ((errors as Record<string, ValueSig>)[k]() as string | undefined) ?? "",
			optional: () => isOptional,
			bg: () => bg,
			meta: () => readFieldType(subSchema),
			style: () => formStyle,
		});
		out[k] = binding;
	}

	return out as FormApi<Shape>;
}
