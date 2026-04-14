import { isSignal, type Signal } from "../state/state/signal";

const STYLE_EQ = Symbol.for("fw.styleEq");

export type StyleEqDescriptor = {
	readonly [STYLE_EQ]: true;
	readonly signal: Signal<unknown>;
	readonly rhs: unknown;
};

/** `rhs` è confrontato con `Object.is(signal(), rhs)` ad ogni ricalcolo (niente `() =>` sull’intero `s`). */
export function styleEq(signal: unknown, rhs: unknown): StyleEqDescriptor {
	if (!isSignal(signal)) throw new TypeError("styleEq: primo argomento deve essere un Signal");
	return { [STYLE_EQ]: true, signal, rhs };
}

export function isStyleEqDescriptor(v: unknown): v is StyleEqDescriptor {
	return (
		typeof v === "object" &&
		v !== null &&
		(v as StyleEqDescriptor)[STYLE_EQ] === true &&
		"signal" in v &&
		isSignal((v as StyleEqDescriptor).signal)
	);
}
