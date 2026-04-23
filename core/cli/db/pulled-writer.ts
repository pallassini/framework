/**
 * Genera `db/pulled.ts` a partire da un `catalog` arricchito (restituito da
 * `catalog.get` del server `/_server/_admin/db/rpc`): `tables[name].columns`
 * contiene `FieldTypeDesc` per ogni colonna.
 *
 * Lo stile del file ricalca `db/index.ts`:
 *   // ──────────────────────────────────────────────────────────────
 *   // NAME TABELLA
 *   // ──────────────────────────────────────────────────────────────
 *   export const name = table({ ... });
 *
 * NB: `id`, `createdAt`, `updatedAt`, `deletedAt` sono auto-iniettati dal
 * framework e quindi NON vengono riportati (come nel `db/index.ts` originale).
 */
import type { FieldTypeDesc } from "../../client/validator/field-meta";

type RemoteIndex = {
	readonly name?: string;
	readonly columns: readonly string[];
	readonly unique?: boolean;
};

type RemoteForeignKey = {
	readonly columns: readonly string[];
	readonly references?: { readonly table?: string };
};

type RemoteColumn = {
	readonly key: string;
	readonly optional: boolean;
	readonly type: FieldTypeDesc;
};

type RemoteTable = {
	readonly pk?: string;
	readonly indexes?: readonly RemoteIndex[];
	readonly foreignKeys?: readonly RemoteForeignKey[];
	readonly columns?: readonly RemoteColumn[];
};

type RemoteCatalog = {
	readonly tables: Record<string, RemoteTable>;
};

/** Lo stesso `SchemaNode` di `core/db/collect.ts`, ripetuto qui per evitare import circolari. */
export type SchemaNode = {
	readonly name: string;
	readonly path: readonly string[];
	readonly tables: readonly string[];
	readonly children: readonly SchemaNode[];
};

const AUTO_COLUMNS = new Set(["id", "createdAt", "updatedAt", "deletedAt"]);

function sep(title: string): string {
	const bar = "─".repeat(79);
	return `// ${bar}\n// ${title.toUpperCase()}\n// ${bar}`;
}

function isUnique(table: RemoteTable, col: string): boolean {
	for (const ix of table.indexes ?? []) {
		if (ix.unique === true && ix.columns.length === 1 && ix.columns[0] === col) {
			return true;
		}
	}
	return false;
}

function fkTarget(table: RemoteTable, col: string): string | undefined {
	for (const f of table.foreignKeys ?? []) {
		if (f.columns.length === 1 && f.columns[0] === col) {
			return f.references?.table;
		}
	}
	return undefined;
}

function encodeString(s: string): string {
	return JSON.stringify(s);
}

function renderType(t: FieldTypeDesc): string {
	switch (t.kind) {
		case "string": {
			let out = "v.string()";
			if (typeof t.min === "number") out += `.min(${String(t.min)})`;
			if (typeof t.max === "number") out += `.max(${String(t.max)})`;
			return out;
		}
		case "number": {
			let out = "v.number()";
			if (t.int === true) out += ".int()";
			if (typeof t.min === "number") out += `.min(${String(t.min)})`;
			if (typeof t.max === "number") out += `.max(${String(t.max)})`;
			if (typeof t.step === "number") out += `.step(${String(t.step)})`;
			return out;
		}
		case "boolean":
			return "v.boolean()";
		case "datetime":
			return "v.datetime()";
		case "date":
			return "v.date()";
		case "time":
			return "v.time()";
		case "enum": {
			const opts = t.options.map(encodeString).join(", ");
			return `v.enum([${opts}])`;
		}
		case "array":
			return `v.array(${renderType(t.of)})`;
		case "object": {
			if (!t.shape || Object.keys(t.shape).length === 0) return "v.object({})";
			const entries = Object.entries(t.shape)
				.map(([k, sub]) => `    ${JSON.stringify(k)}: ${renderType(sub)}`)
				.join(",\n");
			return `v.object({\n${entries},\n  })`;
		}
		case "fk":
			return `v.fk(${encodeString(t.table)})`;
		case "unknown":
		default:
			return "v.unknown()";
	}
}

function renderColumn(
	tableName: string,
	table: RemoteTable,
	col: RemoteColumn,
): string | null {
	if (AUTO_COLUMNS.has(col.key)) return null;

	// FK one-column → forma breve: `userId: "users"` (come in db/index.ts).
	const fkTbl = fkTarget(table, col.key);
	if (fkTbl && col.type.kind === "fk" && col.type.table === fkTbl && !col.optional) {
		return `  ${col.key}: ${encodeString(fkTbl)},`;
	}

	let expr = renderType(col.type);
	if (isUnique(table, col.key)) expr += ".unique()";
	if (col.optional) expr += ".optional()";
	return `  ${col.key}: ${expr},`;
}

function renderTable(name: string, table: RemoteTable): string {
	const lines: string[] = [];
	lines.push(sep(name));
	if (!table.columns || table.columns.length === 0) {
		lines.push(
			`// ⚠ Il server non ha restituito i tipi delle colonne per "${name}".`,
		);
		lines.push(`export const ${name} = table({});`);
		return lines.join("\n");
	}
	lines.push(`export const ${name} = table({`);
	for (const c of table.columns) {
		const rendered = renderColumn(name, table, c);
		if (rendered != null) lines.push(rendered);
	}
	lines.push("});");
	return lines.join("\n");
}

/**
 * Restituisce `[node, ...]` in **post-order** (figli prima del genitore) senza
 * duplicati. Serve a garantire che un `schema([a, b])` sia emesso DOPO
 * che `a` e `b` sono già dichiarati — altrimenti TS dà errore di use-before-declaration.
 */
function flattenSchemasPostOrder(tree: readonly SchemaNode[]): SchemaNode[] {
	const out: SchemaNode[] = [];
	const seen = new Set<string>();
	const visit = (n: SchemaNode): void => {
		const key = n.path.join("/");
		if (seen.has(key)) return;
		for (const c of n.children) visit(c);
		seen.add(key);
		out.push(n);
	};
	for (const root of tree) visit(root);
	return out;
}

/** `export const auth = schema([users, sessions]);` — elenca tabelle + children. */
function renderSchemaNode(n: SchemaNode): string {
	const members: string[] = [];
	for (const t of n.tables) members.push(t);
	for (const c of n.children) members.push(c.name);
	if (members.length === 0) {
		return `export const ${n.name} = schema([]);`;
	}
	if (members.length <= 4) {
		return `export const ${n.name} = schema([${members.join(", ")}]);`;
	}
	// Tante voci → a capo per leggibilità.
	return `export const ${n.name} = schema([\n  ${members.join(",\n  ")},\n]);`;
}

export function renderPulledTs(
	catalog: RemoteCatalog,
	tableOrder: readonly string[] | undefined,
	remoteAlias: string,
	remoteUrl: string,
	schemaTree?: readonly SchemaNode[],
): string {
	const names =
		tableOrder && tableOrder.length > 0
			? tableOrder
			: Object.keys(catalog.tables).sort();
	const flatSchemas = schemaTree ? flattenSchemasPostOrder(schemaTree) : [];
	const hasSchemas = flatSchemas.length > 0;

	const parts: string[] = [];
	parts.push(
		`/**`,
		` * Generato automaticamente da:  bun db pull --from ${remoteAlias}`,
		` * Sorgente remoto:              ${remoteUrl}`,
		` * Istante:                      ${new Date().toISOString()}`,
		` *`,
		` * Questo file NON è importato da nessuna parte: serve solo come reference`,
		` * per rigenerare a mano/copia-incollare le tabelle in \`db/index.ts\`.`,
		` * "id", "createdAt", "updatedAt", "deletedAt" sono auto-iniettati dal`,
		` * framework e non vanno dichiarati.`,
		` */`,
		`import { v } from "../core/client/validator";`,
		`import { table } from "../core/db/schema/table";`,
	);
	if (hasSchemas) {
		parts.push(`import { schema } from "../core/db/schema/namespace";`);
	}
	parts.push(``);
	for (const name of names) {
		const tbl = catalog.tables[name];
		if (!tbl) continue;
		parts.push(renderTable(name, tbl));
		parts.push("");
	}

	if (hasSchemas) {
		parts.push(
			`// ${"─".repeat(79)}`,
			`// SCHEMAS (namespaces)`,
			`// ${"─".repeat(79)}`,
		);
		for (const n of flatSchemas) {
			parts.push(renderSchemaNode(n));
		}
		parts.push("");
	}

	return parts.join("\n");
}
