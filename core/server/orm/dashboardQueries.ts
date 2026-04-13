import type { Engine } from "../../client/db/orm/engine";
import { f, w } from "../../client/db/orm/where";
import { T } from "./dashboardSeed";
import { getDashboardSeedPlan } from "./dashboardCtx";

/** Join logici multi-tabella (no SQL): usano indici eq dove possibile. */

export async function q_tasksWithProjectAndOrg(engine: Engine, uid: number): Promise<number> {
	const p = getDashboardSeedPlan();
	const userId = `u${uid % Math.max(1, p.users)}`;
	const tasks = await engine.findMany(T.tasks, {
		where: w(f("assignee_user_id").eq(userId)),
		limit: 25,
	});
	let n = 0;
	for (const t of tasks) {
		const [pr] = await engine.findMany(T.projects, {
			where: w(f("id").eq(t.project_id)),
			limit: 1,
		});
		if (!pr) continue;
		const [o] = await engine.findMany(T.orgs, {
			where: w(f("id").eq(pr.org_id)),
			limit: 1,
		});
		if (o) n++;
	}
	return n;
}

export async function q_commentsThreadForTask(engine: Engine, uid: number): Promise<number> {
	const p = getDashboardSeedPlan();
	const taskId = `tk${(uid * 17) % Math.max(1, p.tasks)}`;
	const comments = await engine.findMany(T.comments, {
		where: w(f("task_id").eq(taskId)),
		limit: 40,
	});
	let n = 0;
	for (const c of comments) {
		const [u] = await engine.findMany(T.users, {
			where: w(f("id").eq(c.author_user_id)),
			limit: 1,
		});
		if (u) n++;
	}
	return n;
}

export async function q_invoiceLinesWithProjects(engine: Engine, uid: number): Promise<number> {
	const p = getDashboardSeedPlan();
	const invId = `inv${uid % Math.max(1, p.invoices)}`;
	const lines = await engine.findMany(T.line_items, {
		where: w(f("invoice_id").eq(invId)),
		limit: 30,
	});
	let n = 0;
	for (const li of lines) {
		const [pr] = await engine.findMany(T.projects, {
			where: w(f("id").eq(li.project_id)),
			limit: 1,
		});
		const [inv] = await engine.findMany(T.invoices, {
			where: w(f("id").eq(li.invoice_id)),
			limit: 1,
		});
		if (pr && inv) n++;
	}
	return n;
}

export async function q_tagsForTasksOfUser(engine: Engine, uid: number): Promise<number> {
	const p = getDashboardSeedPlan();
	const userId = `u${uid % Math.max(1, p.users)}`;
	const tasks = await engine.findMany(T.tasks, {
		where: w(f("assignee_user_id").eq(userId)),
		limit: 15,
	});
	let n = 0;
	for (const t of tasks) {
		const taggings = await engine.findMany(T.taggings, {
			where: w(f("task_id").eq(t.id)),
			limit: 10,
		});
		for (const tg of taggings) {
			const [tag] = await engine.findMany(T.tags, {
				where: w(f("id").eq(tg.tag_id)),
				limit: 1,
			});
			if (tag) n++;
		}
	}
	return n;
}

export async function q_metricsRollupByOrg(engine: Engine, uid: number): Promise<number> {
	const p = getDashboardSeedPlan();
	const orgId = `o${uid % Math.max(1, p.orgs)}`;
	const metrics = await engine.findMany(T.metrics_events, {
		where: w(f("org_id").eq(orgId)),
		limit: 500,
	});
	const byProj = new Map<string, number>();
	for (const m of metrics) {
		const pid = String(m.project_id);
		byProj.set(pid, (byProj.get(pid) ?? 0) + Number(m.value));
	}
	return byProj.size;
}

export async function q_teamRoster(engine: Engine, uid: number): Promise<number> {
	const p = getDashboardSeedPlan();
	const teamId = `t${uid % Math.max(1, p.teams)}`;
	const members = await engine.findMany(T.team_members, {
		where: w(f("team_id").eq(teamId)),
		limit: 40,
	});
	let n = 0;
	for (const m of members) {
		const [u] = await engine.findMany(T.users, {
			where: w(f("id").eq(m.user_id)),
			limit: 1,
		});
		const [team] = await engine.findMany(T.teams, {
			where: w(f("id").eq(m.team_id)),
			limit: 1,
		});
		if (u && team) n++;
	}
	return n;
}

export async function q_projectTaskCommentDepth(engine: Engine, uid: number): Promise<number> {
	const p = getDashboardSeedPlan();
	const projId = `p${(uid * 31) % Math.max(1, p.projects)}`;
	const tasks = await engine.findMany(T.tasks, {
		where: w(f("project_id").eq(projId)),
		limit: 20,
	});
	let n = 0;
	for (const t of tasks) {
		const cs = await engine.findMany(T.comments, {
			where: w(f("task_id").eq(t.id)),
			limit: 15,
		});
		n += cs.length;
	}
	return n;
}

export async function q_crossOrgUserProjects(engine: Engine, uid: number): Promise<number> {
	const p = getDashboardSeedPlan();
	const userId = `u${uid % Math.max(1, p.users)}`;
	const [user] = await engine.findMany(T.users, {
		where: w(f("id").eq(userId)),
		limit: 1,
	});
	if (!user) return 0;
	const orgId = user.org_id;
	const projects = await engine.findMany(T.projects, {
		where: w(f("org_id").eq(orgId)),
		limit: 30,
	});
	let n = 0;
	for (const pr of projects) {
		const tasks = await engine.findMany(T.tasks, {
			where: w(f("project_id").eq(pr.id), f("done").eq(false)),
			limit: 10,
		});
		n += tasks.length;
	}
	return n;
}

export async function q_write_updateTask(engine: Engine, uid: number): Promise<number> {
	const p = getDashboardSeedPlan();
	const taskId = `tk${(uid * 19) % Math.max(1, p.tasks)}`;
	return engine.update(T.tasks, "id", w(f("id").eq(taskId)), {
		priority: (uid % 4) + 1,
		done: uid % 2 === 0,
	});
}

export async function q_write_deleteComment(engine: Engine, uid: number): Promise<number> {
	const p = getDashboardSeedPlan();
	const cid = `c${(uid * 23) % Math.max(1, p.comments)}`;
	return engine.delete(T.comments, "id", w(f("id").eq(cid)));
}

export async function q_write_invoiceToggle(engine: Engine, uid: number): Promise<number> {
	const p = getDashboardSeedPlan();
	const invId = `inv${uid % Math.max(1, p.invoices)}`;
	let n = await engine.update(T.invoices, "id", w(f("id").eq(invId)), {
		paid: true,
		total_cents: 12345,
	});
	const lines = await engine.findMany(T.line_items, {
		where: w(f("invoice_id").eq(invId)),
		limit: 5,
	});
	n += lines.length;
	return n;
}

const RUNNERS = [
	q_tasksWithProjectAndOrg,
	q_commentsThreadForTask,
	q_invoiceLinesWithProjects,
	q_tagsForTasksOfUser,
	q_metricsRollupByOrg,
	q_teamRoster,
	q_projectTaskCommentDepth,
	q_crossOrgUserProjects,
	q_write_updateTask,
	q_write_deleteComment,
	q_write_invoiceToggle,
] as const;

export const DASHBOARD_QUERY_VARIANTS = RUNNERS.length;

export async function runDashboardQueryVariant(engine: Engine, uid: number, variant: number): Promise<number> {
	const fn = RUNNERS[variant % RUNNERS.length]!;
	return fn(engine, uid);
}
