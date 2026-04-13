import type { Engine } from "../../client/db/orm/engine";

/** Prefisso isolato dalla demo ORM client (`/app/customdb/…`). */
export const DASH_PREFIX = "/app/dash";

export const T = {
	orgs: `${DASH_PREFIX}/orgs`,
	users: `${DASH_PREFIX}/users`,
	teams: `${DASH_PREFIX}/teams`,
	team_members: `${DASH_PREFIX}/team_members`,
	projects: `${DASH_PREFIX}/projects`,
	tasks: `${DASH_PREFIX}/tasks`,
	comments: `${DASH_PREFIX}/comments`,
	tags: `${DASH_PREFIX}/tags`,
	taggings: `${DASH_PREFIX}/taggings`,
	invoices: `${DASH_PREFIX}/invoices`,
	line_items: `${DASH_PREFIX}/line_items`,
	metrics_events: `${DASH_PREFIX}/metrics_events`,
} as const;

export type SeedStats = { table: string; rows: number }[];

export async function seedDashboard(engine: Engine): Promise<SeedStats> {
	const stats: SeedStats = [];
	const nOrg = 25;
	const nUser = 400;
	const nTeam = 80;
	const nMember = 1200;
	const nProject = 800;
	const nTask = 4000;
	const nComment = 10000;
	const nTag = 150;
	const nTagging = 5000;
	const nInvoice = 280;
	const nLine = 2400;
	const nMetric = 20000;

	for (let i = 0; i < nOrg; i++) {
		await engine.insert(T.orgs, "id", {
			id: `o${i}`,
			name: `Org ${i}`,
			plan: i % 3 === 0 ? "enterprise" : "pro",
		});
	}
	stats.push({ table: "orgs", rows: nOrg });

	for (let i = 0; i < nUser; i++) {
		const orgId = `o${i % nOrg}`;
		await engine.insert(T.users, "id", {
			id: `u${i}`,
			org_id: orgId,
			email: `user${i}@ex.test`,
			role: i % 7 === 0 ? "admin" : "member",
			score: i % 100,
		});
	}
	stats.push({ table: "users", rows: nUser });

	for (let j = 0; j < nTeam; j++) {
		const orgId = `o${j % nOrg}`;
		await engine.insert(T.teams, "id", {
			id: `t${j}`,
			org_id: orgId,
			name: `Team ${j}`,
		});
	}
	stats.push({ table: "teams", rows: nTeam });

	for (let k = 0; k < nMember; k++) {
		const teamId = `t${k % nTeam}`;
		const userId = `u${k % nUser}`;
		await engine.insert(T.team_members, "id", {
			id: `tm${k}`,
			team_id: teamId,
			user_id: userId,
			role: k % 2 === 0 ? "lead" : "dev",
		});
	}
	stats.push({ table: "team_members", rows: nMember });

	for (let p = 0; p < nProject; p++) {
		const orgId = `o${p % nOrg}`;
		await engine.insert(T.projects, "id", {
			id: `p${p}`,
			org_id: orgId,
			owner_user_id: `u${p % nUser}`,
			name: `Project ${p}`,
			status: p % 5 === 0 ? "archived" : "active",
		});
	}
	stats.push({ table: "projects", rows: nProject });

	for (let t = 0; t < nTask; t++) {
		const projId = `p${t % nProject}`;
		await engine.insert(T.tasks, "id", {
			id: `tk${t}`,
			project_id: projId,
			assignee_user_id: `u${t % nUser}`,
			title: `Task ${t}`,
			priority: t % 4,
			done: t % 11 === 0,
		});
	}
	stats.push({ table: "tasks", rows: nTask });

	for (let c = 0; c < nComment; c++) {
		const taskId = `tk${c % nTask}`;
		await engine.insert(T.comments, "id", {
			id: `c${c}`,
			task_id: taskId,
			author_user_id: `u${c % nUser}`,
			body: `Comment body ${c}`,
		});
	}
	stats.push({ table: "comments", rows: nComment });

	for (let g = 0; g < nTag; g++) {
		await engine.insert(T.tags, "id", {
			id: `g${g}`,
			org_id: `o${g % nOrg}`,
			label: `tag-${g}`,
		});
	}
	stats.push({ table: "tags", rows: nTag });

	for (let x = 0; x < nTagging; x++) {
		await engine.insert(T.taggings, "id", {
			id: `tg${x}`,
			tag_id: `g${x % nTag}`,
			task_id: `tk${x % nTask}`,
		});
	}
	stats.push({ table: "taggings", rows: nTagging });

	for (let inv = 0; inv < nInvoice; inv++) {
		await engine.insert(T.invoices, "id", {
			id: `inv${inv}`,
			org_id: `o${inv % nOrg}`,
			user_id: `u${inv % nUser}`,
			total_cents: (inv % 5000) * 100,
			paid: inv % 4 === 0,
		});
	}
	stats.push({ table: "invoices", rows: nInvoice });

	for (let li = 0; li < nLine; li++) {
		await engine.insert(T.line_items, "id", {
			id: `li${li}`,
			invoice_id: `inv${li % nInvoice}`,
			project_id: `p${li % nProject}`,
			qty: (li % 9) + 1,
			amount_cents: (li % 200) * 50,
		});
	}
	stats.push({ table: "line_items", rows: nLine });

	for (let m = 0; m < nMetric; m++) {
		await engine.insert(T.metrics_events, "id", {
			id: `m${m}`,
			org_id: `o${m % nOrg}`,
			project_id: `p${m % nProject}`,
			bucket: m % 96,
			value: (m % 50) + 1,
		});
	}
	stats.push({ table: "metrics_events", rows: nMetric });

	return stats;
}
