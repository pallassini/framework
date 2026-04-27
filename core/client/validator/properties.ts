import { array } from "./properties/array";
import { oneOrArray } from "./properties/oneOrArray";
import { date, datetime } from "./properties/date";
import { time } from "./properties/time";
import { nullable } from "./properties/nullable";
import { optional } from "./properties/optional";
import { object } from "./properties/object";
import { boolean } from "./properties/boolean";
import { empty } from "./properties/empty";
import { literal } from "./properties/literal";
import { literals } from "./properties/literals";
import { number } from "./properties/number";
import {
	string,
	email,
	password,
	passwordField,
	noPasswordError,
} from "./properties/string";
import { unknown } from "./properties/unknown";
import { uuid } from "./properties/uuid";
import { fk } from "./fk";
import { select } from "./properties/select";

export const v = {
	uuid,
	string,
	email,
	password,
	passwordField,
	/** Uso: `v.password(v.noPasswordError)` o `v.password("noError")` (login, no policy). */
	noPasswordError,
	number,
	date,
	datetime,
	time,
	boolean,
	empty,
	unknown,
	literal,
	/** Stringa in un insieme finito; in tipo: `satisfies v.Enum<["a","b"]>`. */
	enum: literals,
	optional,
	nullable,
	array,
	/** Stesso schema per un solo elemento o per un array (create batch o singola). */
	oneOrArray,
	object,
	/** FK verso `tableName.id` (stesso comportamento di `fk()` da `core/db/schema/table`). */
	fk,
	/**
	 * Stringa con `<Input type` implicito `select` — le opzioni si passano con `options={...}`
	 * (dati a runtime; non c’è chiusura statica in tipo).
	 */
	select,
} as const;

export { noPasswordError } from "./properties/string";
