import { getZigApi } from "../../../dbCustom/binding";
import type { Engine } from "./engine";
import { MemoryEngine } from "./engine";
import { shallowWhere, type WhereClause } from "./where";

/**
 * Motore in RAM + copia ogni riga su Zig KV (sessione: al riavvio senza scan non si ricostruisce l’indice).
 * Utile per stress FFI e prototipi; la fonte di verità query è la Map TS.
 */
export class ZigMirrorEngine implements Engine {
	readonly kind = "zig_mirror" as const;
	private readonly mem = new MemoryEngine();
	private zigHandle: number | null = null;

	private ensureZig(): NonNullable<ReturnType<typeof getZigApi>> {
		const api = getZigApi();
		if (!api) throw new Error("[orm] ZigMirrorEngine: libreria Zig non caricata");
		if (!this.zigHandle) {
			const h = api.create();
			if (!h) throw new Error("[orm] ZigMirrorEngine: custom_db_create fallito");
			this.zigHandle = h;
		}
		return api;
	}

	private persistRow(tablePath: string, pkField: string, row: Record<string, unknown>): void {
		const api = this.ensureZig();
		const payload = JSON.stringify({ p: tablePath, r: row[pkField], row });
		const enc = new TextEncoder().encode(payload);
		const id = api.put(this.zigHandle!, enc);
		if (id <= 0n) throw new Error("[orm] ZigMirrorEngine: put fallito");
		void id;
	}

	async insert(tablePath: string, pkField: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
		const out = await this.mem.insert(tablePath, pkField, row);
		this.persistRow(tablePath, pkField, out);
		return out;
	}

	async update(
		tablePath: string,
		pkField: string,
		clause: WhereClause,
		patch: Record<string, unknown>,
	): Promise<number> {
		const victims = await this.mem.findMany(tablePath, { where: clause });
		const pks = victims.map((v) => String(v[pkField]));
		const n = await this.mem.update(tablePath, pkField, clause, patch);
		for (const pk of pks) {
			const row = (
				await this.mem.findMany(tablePath, { where: shallowWhere({ [pkField]: pk }) })
			)[0];
			if (row) this.persistRow(tablePath, pkField, row);
		}
		return n;
	}

	async delete(tablePath: string, pkField: string, clause: WhereClause): Promise<number> {
		return this.mem.delete(tablePath, pkField, clause);
	}

	findMany(
		tablePath: string,
		opts: { where?: WhereClause | undefined; limit?: number; offset?: number },
	): Promise<Record<string, unknown>[]> {
		return this.mem.findMany(tablePath, opts);
	}
}
