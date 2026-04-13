import type { WhereClause } from "./where";

export type OrmDocInput =
	| {
			op: "insert";
			relPath: string;
			pkField?: string;
			row: Record<string, unknown>;
 }
	| {
			op: "update";
			relPath: string;
			pkField?: string;
			where: WhereClause;
			patch: Record<string, unknown>;
	  }
	| {
			op: "delete";
			relPath: string;
			pkField?: string;
			where: WhereClause;
	  }
	| {
			op: "findMany";
			relPath: string;
			where?: WhereClause | undefined;
			limit?: number;
			offset?: number;
	  };

export type OrmDocOutput =
	| { op: "insert"; row: Record<string, unknown> }
	| { op: "update"; affected: number }
	| { op: "delete"; affected: number }
	| { op: "findMany"; rows: Record<string, unknown>[] };
