import type { Sql } from "postgres";
import type { SeedPlan } from "./dashboardTier";

/** Svuota e ricarica le tabelle `fw_dash_*` con lo stesso schema logico del seed ORM (bulk SQL). */
export async function seedPgDashboard(sql: Sql, plan: SeedPlan): Promise<void> {
	const p = plan;

	await sql`
		TRUNCATE fw_dash_metrics_events,
			fw_dash_line_items,
			fw_dash_taggings,
			fw_dash_comments,
			fw_dash_tasks,
			fw_dash_invoices,
			fw_dash_tags,
			fw_dash_team_members,
			fw_dash_projects,
			fw_dash_teams,
			fw_dash_users,
			fw_dash_orgs
			RESTART IDENTITY CASCADE;
	`;

	await sql.begin(async (tx) => {
		await tx`
			INSERT INTO fw_dash_orgs (id, name, plan)
			SELECT
				'o' || g.i::text,
				'Org ' || g.i::text,
				CASE WHEN g.i % 3 = 0 THEN 'enterprise' ELSE 'pro' END
			FROM generate_series(0, ${p.orgs - 1}) AS g(i);
		`;

		await tx`
			INSERT INTO fw_dash_users (id, org_id, email, role, score)
			SELECT
				'u' || g.i::text,
				'o' || (g.i % ${p.orgs})::text,
				'user' || g.i::text || '@ex.test',
				CASE WHEN g.i % 7 = 0 THEN 'admin' ELSE 'member' END,
				(g.i % 100)::int
			FROM generate_series(0, ${p.users - 1}) AS g(i);
		`;

		await tx`
			INSERT INTO fw_dash_teams (id, org_id, name)
			SELECT
				't' || g.i::text,
				'o' || (g.i % ${p.orgs})::text,
				'Team ' || g.i::text
			FROM generate_series(0, ${p.teams - 1}) AS g(i);
		`;

		await tx`
			INSERT INTO fw_dash_team_members (id, team_id, user_id, role)
			SELECT
				'tm' || g.i::text,
				't' || (g.i % ${p.teams})::text,
				'u' || (g.i % ${p.users})::text,
				CASE WHEN g.i % 2 = 0 THEN 'lead' ELSE 'dev' END
			FROM generate_series(0, ${p.team_members - 1}) AS g(i);
		`;

		await tx`
			INSERT INTO fw_dash_projects (id, org_id, owner_user_id, name, status)
			SELECT
				'p' || g.i::text,
				'o' || (g.i % ${p.orgs})::text,
				'u' || (g.i % ${p.users})::text,
				'Project ' || g.i::text,
				CASE WHEN g.i % 5 = 0 THEN 'archived' ELSE 'active' END
			FROM generate_series(0, ${p.projects - 1}) AS g(i);
		`;

		await tx`
			INSERT INTO fw_dash_tasks (id, project_id, assignee_user_id, title, priority, done)
			SELECT
				'tk' || g.i::text,
				'p' || (g.i % ${p.projects})::text,
				'u' || (g.i % ${p.users})::text,
				'Task ' || g.i::text,
				(g.i % 4)::int,
				(g.i % 11 = 0)
			FROM generate_series(0, ${p.tasks - 1}) AS g(i);
		`;

		await tx`
			INSERT INTO fw_dash_comments (id, task_id, author_user_id, body)
			SELECT
				'c' || g.i::text,
				'tk' || (g.i % ${p.tasks})::text,
				'u' || (g.i % ${p.users})::text,
				'Comment body ' || g.i::text
			FROM generate_series(0, ${p.comments - 1}) AS g(i);
		`;

		await tx`
			INSERT INTO fw_dash_tags (id, org_id, label)
			SELECT
				'g' || g.i::text,
				'o' || (g.i % ${p.orgs})::text,
				'tag-' || g.i::text
			FROM generate_series(0, ${p.tags - 1}) AS g(i);
		`;

		await tx`
			INSERT INTO fw_dash_taggings (id, tag_id, task_id)
			SELECT
				'tg' || g.i::text,
				'g' || (g.i % ${p.tags})::text,
				'tk' || (g.i % ${p.tasks})::text
			FROM generate_series(0, ${p.taggings - 1}) AS g(i);
		`;

		await tx`
			INSERT INTO fw_dash_invoices (id, org_id, user_id, total_cents, paid)
			SELECT
				'inv' || g.i::text,
				'o' || (g.i % ${p.orgs})::text,
				'u' || (g.i % ${p.users})::text,
				((g.i % 5000) * 100)::int,
				(g.i % 4 = 0)
			FROM generate_series(0, ${p.invoices - 1}) AS g(i);
		`;

		await tx`
			INSERT INTO fw_dash_line_items (id, invoice_id, project_id, qty, amount_cents)
			SELECT
				'li' || g.i::text,
				'inv' || (g.i % ${p.invoices})::text,
				'p' || (g.i % ${p.projects})::text,
				((g.i % 9) + 1)::int,
				((g.i % 200) * 50)::int
			FROM generate_series(0, ${p.line_items - 1}) AS g(i);
		`;

		await tx`
			INSERT INTO fw_dash_metrics_events (id, org_id, project_id, bucket, value)
			SELECT
				'm' || g.i::text,
				'o' || (g.i % ${p.orgs})::text,
				'p' || (g.i % ${p.projects})::text,
				(g.i % 96)::int,
				((g.i % 50) + 1)::int
			FROM generate_series(0, ${p.metrics - 1}) AS g(i);
		`;
	});
}
