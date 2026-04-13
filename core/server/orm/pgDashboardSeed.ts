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
				'o' || (g.generate_series - 1)::text,
				'Org ' || (g.generate_series - 1)::text,
				CASE WHEN (g.generate_series - 1) % 3 = 0 THEN 'enterprise' ELSE 'pro' END
			FROM generate_series(1, ${p.orgs}) AS g;
		`;

		await tx`
			INSERT INTO fw_dash_users (id, org_id, email, role, score)
			SELECT
				'u' || (g.generate_series - 1)::text,
				'o' || ((g.generate_series - 1) % ${p.orgs})::text,
				'user' || (g.generate_series - 1)::text || '@ex.test',
				CASE WHEN (g.generate_series - 1) % 7 = 0 THEN 'admin' ELSE 'member' END,
				((g.generate_series - 1) % 100)::int
			FROM generate_series(1, ${p.users}) AS g;
		`;

		await tx`
			INSERT INTO fw_dash_teams (id, org_id, name)
			SELECT
				't' || (g.generate_series - 1)::text,
				'o' || ((g.generate_series - 1) % ${p.orgs})::text,
				'Team ' || (g.generate_series - 1)::text
			FROM generate_series(1, ${p.teams}) AS g;
		`;

		await tx`
			INSERT INTO fw_dash_team_members (id, team_id, user_id, role)
			SELECT
				'tm' || (g.generate_series - 1)::text,
				't' || ((g.generate_series - 1) % ${p.teams})::text,
				'u' || ((g.generate_series - 1) % ${p.users})::text,
				CASE WHEN (g.generate_series - 1) % 2 = 0 THEN 'lead' ELSE 'dev' END
			FROM generate_series(1, ${p.team_members}) AS g;
		`;

		await tx`
			INSERT INTO fw_dash_projects (id, org_id, owner_user_id, name, status)
			SELECT
				'p' || (g.generate_series - 1)::text,
				'o' || ((g.generate_series - 1) % ${p.orgs})::text,
				'u' || ((g.generate_series - 1) % ${p.users})::text,
				'Project ' || (g.generate_series - 1)::text,
				CASE WHEN (g.generate_series - 1) % 5 = 0 THEN 'archived' ELSE 'active' END
			FROM generate_series(1, ${p.projects}) AS g;
		`;

		await tx`
			INSERT INTO fw_dash_tasks (id, project_id, assignee_user_id, title, priority, done)
			SELECT
				'tk' || (g.generate_series - 1)::text,
				'p' || ((g.generate_series - 1) % ${p.projects})::text,
				'u' || ((g.generate_series - 1) % ${p.users})::text,
				'Task ' || (g.generate_series - 1)::text,
				((g.generate_series - 1) % 4)::int,
				((g.generate_series - 1) % 11 = 0)
			FROM generate_series(1, ${p.tasks}) AS g;
		`;

		await tx`
			INSERT INTO fw_dash_comments (id, task_id, author_user_id, body)
			SELECT
				'c' || (g.generate_series - 1)::text,
				'tk' || ((g.generate_series - 1) % ${p.tasks})::text,
				'u' || ((g.generate_series - 1) % ${p.users})::text,
				'Comment body ' || (g.generate_series - 1)::text
			FROM generate_series(1, ${p.comments}) AS g;
		`;

		await tx`
			INSERT INTO fw_dash_tags (id, org_id, label)
			SELECT
				'g' || (g.generate_series - 1)::text,
				'o' || ((g.generate_series - 1) % ${p.orgs})::text,
				'tag-' || (g.generate_series - 1)::text
			FROM generate_series(1, ${p.tags}) AS g;
		`;

		await tx`
			INSERT INTO fw_dash_taggings (id, tag_id, task_id)
			SELECT
				'tg' || (g.generate_series - 1)::text,
				'g' || ((g.generate_series - 1) % ${p.tags})::text,
				'tk' || ((g.generate_series - 1) % ${p.tasks})::text
			FROM generate_series(1, ${p.taggings}) AS g;
		`;

		await tx`
			INSERT INTO fw_dash_invoices (id, org_id, user_id, total_cents, paid)
			SELECT
				'inv' || (g.generate_series - 1)::text,
				'o' || ((g.generate_series - 1) % ${p.orgs})::text,
				'u' || ((g.generate_series - 1) % ${p.users})::text,
				(((g.generate_series - 1) % 5000) * 100)::int,
				((g.generate_series - 1) % 4 = 0)
			FROM generate_series(1, ${p.invoices}) AS g;
		`;

		await tx`
			INSERT INTO fw_dash_line_items (id, invoice_id, project_id, qty, amount_cents)
			SELECT
				'li' || (g.generate_series - 1)::text,
				'inv' || ((g.generate_series - 1) % ${p.invoices})::text,
				'p' || ((g.generate_series - 1) % ${p.projects})::text,
				(((g.generate_series - 1) % 9) + 1)::int,
				(((g.generate_series - 1) % 200) * 50)::int
			FROM generate_series(1, ${p.line_items}) AS g;
		`;

		await tx`
			INSERT INTO fw_dash_metrics_events (id, org_id, project_id, bucket, value)
			SELECT
				'm' || (g.generate_series - 1)::text,
				'o' || ((g.generate_series - 1) % ${p.orgs})::text,
				'p' || ((g.generate_series - 1) % ${p.projects})::text,
				((g.generate_series - 1) % 96)::int,
				(((g.generate_series - 1) % 50) + 1)::int
			FROM generate_series(1, ${p.metrics}) AS g;
		`;
	});
}
