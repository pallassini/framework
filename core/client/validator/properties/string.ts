import { FIELD_UNIQUE, tagFieldType } from "../field-meta";
import { optionalKeepingFieldMeta } from "../chain";
import { ValidationError, type InputSchema } from "./defs";

function baseParse(raw: unknown): string {
	if (typeof raw !== "string") throw new ValidationError("expected string");
	return raw;
}

/**
 * Schema stringa con catena di controlli (`.min`, `.max`, `.regex`, …).
 * Ogni metodo ritorna un nuovo `StringSchema` con la regola aggiunta al `parse`.
 * `.optional()` rende il valore opzionale preservando eventuali flag (es. `unique`).
 * `.unique()` marca il campo come unico per il catalog DB.
 */
export type StringSchema = InputSchema<string> & {
	optional(): InputSchema<string | undefined>;
	unique(): StringSchemaUnique;
	/** Lunghezza minima (inclusiva). Messaggio custom opzionale. */
	min(n: number, message?: string): StringSchema;
	/** Lunghezza massima (inclusiva). */
	max(n: number, message?: string): StringSchema;
	/** Lunghezza esatta. */
	length(n: number, message?: string): StringSchema;
	/** Deve matchare il pattern. */
	regex(re: RegExp, message?: string): StringSchema;
	/** Non vuota dopo `trim()`. */
	nonempty(message?: string): StringSchema;
	/** Email RFC-lite. */
	email(message?: string): StringSchema;
	/** URL assoluto (`new URL()`). */
	url(message?: string): StringSchema;
	/** UUID v1..v5. */
	uuid(message?: string): StringSchema;
	/** Applica `trim()` prima di validare i successivi step. */
	trim(): StringSchema;
	/** Converte in minuscolo prima di validare. */
	lowercase(): StringSchema;
	/** Converte in maiuscolo prima di validare. */
	uppercase(): StringSchema;
	/** Deve iniziare con il prefisso dato. */
	startsWith(prefix: string, message?: string): StringSchema;
	/** Deve finire con il suffisso dato. */
	endsWith(suffix: string, message?: string): StringSchema;
	/** Valore ammesso solo se incluso in `values`. */
	oneOf<T extends string>(values: readonly T[], message?: string): StringSchema;
};

/** Variante `.unique()`: stesse chain ma preserva il tag `FIELD_UNIQUE`. */
export type StringSchemaUnique = StringSchema & {
	unique(): StringSchemaUnique;
};

/** Regex email pragmatica (RFC 5322 "lite", copre il 99% dei casi reali). */
const EMAIL_RE =
	/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Factory interna: costruisce uno `StringSchema` con un `parse` dato,
 * e ri-espone tutte le chain (ciascuna avvolge `parse` con una regola).
 * `unique` propaga il tag `FIELD_UNIQUE` sull'oggetto risultante.
 */
function makeStringSchema(
	parseImpl: (raw: unknown) => string,
	unique: boolean,
): StringSchema {
	/** Helper: deriva una nuova chain applicando un check dopo `parseImpl`. */
	const derive = (next: (s: string) => string): StringSchema =>
		makeStringSchema((raw) => next(parseImpl(raw)), unique);

	const base: InputSchema<string> = { parse: parseImpl };
	const out = Object.assign(base, {
		optional() {
			return optionalKeepingFieldMeta(base);
		},
		unique(): StringSchemaUnique {
			return makeStringSchema(parseImpl, true) as StringSchemaUnique;
		},

		min(n: number, message?: string) {
			return derive((s) => {
				if (s.length < n) {
					throw new ValidationError(
						message ?? `string must be at least ${n} characters`,
					);
				}
				return s;
			});
		},
		max(n: number, message?: string) {
			return derive((s) => {
				if (s.length > n) {
					throw new ValidationError(
						message ?? `string must be at most ${n} characters`,
					);
				}
				return s;
			});
		},
		length(n: number, message?: string) {
			return derive((s) => {
				if (s.length !== n) {
					throw new ValidationError(
						message ?? `string must be exactly ${n} characters`,
					);
				}
				return s;
			});
		},
		regex(re: RegExp, message?: string) {
			return derive((s) => {
				if (!re.test(s)) {
					throw new ValidationError(message ?? `invalid format`);
				}
				return s;
			});
		},
		nonempty(message?: string) {
			return derive((s) => {
				if (s.trim().length === 0) {
					throw new ValidationError(message ?? `must not be empty`);
				}
				return s;
			});
		},
		email(message?: string) {
			return derive((s) => {
				if (!EMAIL_RE.test(s)) {
					throw new ValidationError(
						message ?? "Inserisci un indirizzo email valido",
					);
				}
				return s;
			});
		},
		url(message?: string) {
			return derive((s) => {
				try {
					new URL(s);
				} catch {
					throw new ValidationError(message ?? `invalid url`);
				}
				return s;
			});
		},
		uuid(message?: string) {
			return derive((s) => {
				if (!UUID_RE.test(s)) {
					throw new ValidationError(message ?? `invalid uuid`);
				}
				return s;
			});
		},
		/** Trasformazione: applica `trim()` sul valore prima dei successivi check. */
		trim() {
			return derive((s) => s.trim());
		},
		lowercase() {
			return derive((s) => s.toLowerCase());
		},
		uppercase() {
			return derive((s) => s.toUpperCase());
		},
		startsWith(prefix: string, message?: string) {
			return derive((s) => {
				if (!s.startsWith(prefix)) {
					throw new ValidationError(
						message ?? `must start with "${prefix}"`,
					);
				}
				return s;
			});
		},
		endsWith(suffix: string, message?: string) {
			return derive((s) => {
				if (!s.endsWith(suffix)) {
					throw new ValidationError(message ?? `must end with "${suffix}"`);
				}
				return s;
			});
		},
		oneOf<T extends string>(values: readonly T[], message?: string) {
			return derive((s) => {
				if (!(values as readonly string[]).includes(s)) {
					throw new ValidationError(
						message ?? `must be one of: ${values.join(", ")}`,
					);
				}
				return s;
			});
		},
	}) as StringSchema;

	if (unique) {
		(out as unknown as Record<PropertyKey, unknown>)[FIELD_UNIQUE] = true;
	}
	tagFieldType(out, { kind: "string" });
	return out;
}

export function string(): StringSchema {
	return makeStringSchema(baseParse, false);
}

/** Scorciatoia per `v.string().email()` (formato email RFC‑lite, messaggio predefinito in italiano). */
export function email(message?: string): StringSchema {
	return string().email(message);
}

const PASSWORD_MIN = 8;

const NO_PASSWORD_ERROR = "noError";

function isNoPasswordErrorToken(msg: string | undefined): boolean {
	if (msg === undefined) return false;
	return msg.trim().toLowerCase() === "noerror";
}

/**
 * Campo password (stessa UI) **senza** vincolo di lunghezza — solo non vuoto.
 * Preferisci `v.password("noError")` per il login.
 */
export function passwordField(emptyMessage?: string): StringSchema {
	const out = string().nonempty(emptyMessage ?? "Inserisci la password");
	tagFieldType(out, { kind: "password" });
	return out;
}

/**
 * - `v.password()` — min 8, messaggio default (registrazione, cambio password, …).
 * - `v.password("testo custom")` — min 8 con messaggio per errore sotto al min.
 * - `v.password("noError")` — **nessun min** (solo non vuoto), niente indizi sulla
 *   policy; stesso di `v.passwordField()`. `noerror` / `NOERROR` accettati.
 */
export function password(message?: string): StringSchema {
	if (isNoPasswordErrorToken(message)) {
		return passwordField();
	}
	const out = string().min(
		PASSWORD_MIN,
		message ?? "Password troppo corta",
	);
	tagFieldType(out, { kind: "password", min: PASSWORD_MIN });
	return out;
}

/** Letterale per `v.password(noPasswordError)` con autocomplete. */
export const noPasswordError = NO_PASSWORD_ERROR;
