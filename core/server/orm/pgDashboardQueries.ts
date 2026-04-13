import type { Sql } from "postgres";
import type { SeedPlan } from "./dashboardTier";
import { DASHBOARD_QUERY_VARIANTS } from "./dashboardQueries";

/** Stesso mix di varianti di `dashboardQueries` (letture + update/delete) su SQL. */
export async function runPgDashboardVariant(sql: Sql, uid: number, variant: number, p: SeedPlan): Promise<number> {
	const mod = DASHBOARD_QUERY_VARIANTS;
	const v = ((variant % mod) + mod) % mod;
	const nu = Math.max(1, p.users);
	const nt = Math.max(1, p.tasks);
	const ni = Math.max(1, p.invoices);
	const ntm = Math.max(1, p.teams);
	const npj = Math.max(1, p.projects);
	const no = Math.max(1, p.orgs);
	const nc = Math.max(1, p.comments);

	if (v === 0) {
		const userId = `u${uid % nu}`;
		const rows = await sql`
			SELECT 1
			FROM fw_dash_tasks t
			JOIN fw_dash_projects pr ON pr.id = t.project_id
			JOIN fw_dash_orgs o ON o.id = pr.org_id
			WHERE t.assignee_user_id = ${userId}
			LIMIT 25
		`;
		return rows.length;
	}
	if (v === 1) {
		const taskId = `tk${(uid * 17) % nt}`;
		const rows = await sql`
			SELECT 1
			FROM fw_dash_comments c
			JOIN fw_dash_users u ON u.id = c.author_user_id
			WHERE c.task_id = ${taskId}
			LIMIT 40
		`;
		return rows.length;
	}
	if (v === 2) {
		const invId = `inv${uid % ni}`;
		const rows = await sql`
			SELECT 1
			FROM fw_dash_line_items li
			JOIN fw_dash_projects pr ON pr.id = li.project_id
			JOIN fw_dash_invoices inv ON inv.id = li.invoice_id
			WHERE li.invoice_id = ${invId}
			LIMIT 30
		`;
		return rows.length;
	}
	if (v === 3) {
		const userId = `u${uid % nu}`;
		const tasks = await sql`
			SELECT id FROM fw_dash_tasks
			WHERE assignee_user_id = ${userId}
			LIMIT 15
		`;
		let n = 0;
		for (const t of tasks) {
			const tid = String(t.id);
			const taggings = await sql`
				SELECT tag_id FROM fw_dash_taggings
				WHERE task_id = ${tid}
				LIMIT 10
			`;
			for (const tg of taggings) {
				const rows = await sql`
					SELECT 1 FROM fw_dash_tags WHERE id = ${String(tg.tag_id)} LIMIT 1
				`;
				if (rows.length) n++;
			}
		}
		return n;
	}
	if (v === 4) {
		const orgId = `o${uid % no}`;
		const metrics = await sql`
			SELECT project_id, value FROM fw_dash_metrics_events
			WHERE org_id = ${orgId}
			LIMIT 500
		`;
		const byProj = new Map<string, number>();
		for (const m of metrics) {
			const pid = String(m.project_id);
			byProj.set(pid, (byProj.get(pid) ?? 0) + Number(m.value));
		}
		return byProj.size;
	}
	if (v === 5) {
		const teamId = `t${uid % ntm}`;
		const rows = await sql`
			SELECT 1
			FROM fw_dash_team_members m
			JOIN fw_dash_users u ON u.id = m.user_id
			JOIN fw_dash_teams tm ON tm.id = m.team_id
			WHERE m.team_id = ${teamId}
			LIMIT 40
		`;
		return rows.length;
	}
	if (v === 6) {
		const projId = `p${(uid * 31) % npj}`;
		const tasks = await sql`
			SELECT id FROM fw_dash_tasks
			WHERE project_id = ${projId}
			LIMIT 20
		`;
		let n = 0;
		for (const t of tasks) {
			const cs = await sql`
				SELECT 1 FROM fw_dash_comments
				WHERE task_id = ${String(t.id)}
				LIMIT 15
			`;
			n += cs.length;
		}
		return n;
	}
	if (v === 7) {
		const userId = `u${uid % nu}`;
		const users = await sql`
			SELECT org_id FROM fw_dash_users WHERE id = ${userId} LIMIT 1
		`;
		const user = users[0];
		if (!user) return 0;
		const orgId = user.org_id;
		const projects = await sql`
			SELECT id FROM fw_dash_projects
			WHERE org_id = ${String(orgId)}
			LIMIT 30
		`;
		let n = 0;
		for (const pr of projects) {
			const tasks = await sql`
				SELECT 1 FROM fw_dash_tasks
				WHERE project_id = ${String(pr.id)} AND done = false
				LIMIT 10
			`;
			n += tasks.length;
		}
		return n;
	}
	if (v === 8) {
		const taskId = `tk${(uid * 19) % nt}`;
		const r = await sql`
			UPDATE fw_dash_tasks
			SET priority = ${(uid % 4) + 1}, done = ${uid % 2 === 0}
			WHERE id = ${taskId}
			RETURNING id
		`;
		return r.length;
	}
	if (v === 9) {
		const cid = `c${(uid * 23) % nc}`;
		const r = await sql`
			DELETE FROM fw_dash_comments WHERE id = ${cid} RETURNING id
		`;
		return r.length;
	}
	const invId = `inv${uid % ni}`;
	const ur = await sql`
		UPDATE fw_dash_invoices
		SET paid = true, total_cents = 12345
		WHERE id = ${invId}
		RETURNING id
	`;
	const lines = await sql`
		SELECT id FROM fw_dash_line_items
		WHERE invoice_id = ${invId}
		LIMIT 5
	`;
	return ur.length + lines.length;
}
