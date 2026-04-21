import { randomUUID } from "node:crypto";
import type { FieldTypeDesc } from "../client/validator/field-meta";
import type { FwColumnMeta } from "./schema/table";

/** Valore iniziale per una cella in base al tipo dichiarato (devtools: nuova riga). */
export function defaultValueForField(fieldType: FieldTypeDesc, optional: boolean): unknown {
	if (optional) return null;
	switch (fieldType.kind) {
		case "string":
			return "";
		case "number":
			return 0;
		case "boolean":
			return false;
		case "datetime":
			return new Date().toISOString();
		case "date": {
			const d = new Date();
			const y = d.getFullYear();
			const m = String(d.getMonth() + 1).padStart(2, "0");
			const day = String(d.getDate()).padStart(2, "0");
			return `${String(y)}-${m}-${day}`;
		}
		case "time":
			return "09:00:00";
		case "enum":
			return fieldType.options[0] ?? "";
		case "fk":
			return "";
		case "array":
			return [];
		case "object":
			return {};
		default:
			return null;
	}
}

/** Costruisce una riga con `id` generato e campi secondo lo schema FW (per `create`). */
export function buildDefaultRowFromColumns(cols: readonly FwColumnMeta[] | undefined): Record<string, unknown> {
	const id = randomUUID();
	const row: Record<string, unknown> = { id };
	if (!cols) return row;
	for (const c of cols) {
		if (c.key === "id") continue;
		row[c.key] = defaultValueForField(c.type, c.optional);
	}
	return row;
}
