import type { Sql } from "postgres";

let ensured = false;

/** DDL idempotente + indici allineati alle query dashboard (FK opzionali per TRUNCATE semplice). */
export async function ensurePgDashboardSchema(sql: Sql): Promise<void> {
	if (ensured) return;

	await sql`
	CREATE TABLE IF NOT EXISTS fw_dash_orgs (
			id text PRIMARY KEY,
			name text NOT NULL,
			plan text NOT NULL
		);
	`;
	await sql`
		CREATE TABLE IF NOT EXISTS fw_dash_users (
			id text PRIMARY KEY,
			org_id text NOT NULL REFERENCES fw_dash_orgs (id) ON DELETE CASCADE,
			email text NOT NULL,
			role text NOT NULL,
			score integer NOT NULL
		);
	`;
	await sql`
		CREATE TABLE IF NOT EXISTS fw_dash_teams (
			id text PRIMARY KEY,
			org_id text NOT NULL REFERENCES fw_dash_orgs (id) ON DELETE CASCADE,
			name text NOT NULL
		);
	`;
	await sql`
		CREATE TABLE IF NOT EXISTS fw_dash_team_members (
			id text PRIMARY KEY,
			team_id text NOT NULL REFERENCES fw_dash_teams (id) ON DELETE CASCADE,
			user_id text NOT NULL REFERENCES fw_dash_users (id) ON DELETE CASCADE,
			role text NOT NULL
		);
	`;
	await sql`
		CREATE TABLE IF NOT EXISTS fw_dash_projects (
			id text PRIMARY KEY,
			org_id text NOT NULL REFERENCES fw_dash_orgs (id) ON DELETE CASCADE,
			owner_user_id text NOT NULL REFERENCES fw_dash_users (id) ON DELETE CASCADE,
			name text NOT NULL,
			status text NOT NULL
		);
	`;
	await sql`
		CREATE TABLE IF NOT EXISTS fw_dash_tasks (
			id text PRIMARY KEY,
			project_id text NOT NULL REFERENCES fw_dash_projects (id) ON DELETE CASCADE,
			assignee_user_id text NOT NULL REFERENCES fw_dash_users (id) ON DELETE CASCADE,
			title text NOT NULL,
			priority integer NOT NULL,
			done boolean NOT NULL
		);
	`;
	await sql`
		CREATE TABLE IF NOT EXISTS fw_dash_comments (
			id text PRIMARY KEY,
			task_id text NOT NULL REFERENCES fw_dash_tasks (id) ON DELETE CASCADE,
			author_user_id text NOT NULL REFERENCES fw_dash_users (id) ON DELETE CASCADE,
			body text NOT NULL
		);
	`;
	await sql`
		CREATE TABLE IF NOT EXISTS fw_dash_tags (
			id text PRIMARY KEY,
			org_id text NOT NULL REFERENCES fw_dash_orgs (id) ON DELETE CASCADE,
			label text NOT NULL
		);
	`;
	await sql`
		CREATE TABLE IF NOT EXISTS fw_dash_taggings (
			id text PRIMARY KEY,
			tag_id text NOT NULL REFERENCES fw_dash_tags (id) ON DELETE CASCADE,
			task_id text NOT NULL REFERENCES fw_dash_tasks (id) ON DELETE CASCADE
		);
	`;
	await sql`
		CREATE TABLE IF NOT EXISTS fw_dash_invoices (
			id text PRIMARY KEY,
			org_id text NOT NULL REFERENCES fw_dash_orgs (id) ON DELETE CASCADE,
			user_id text NOT NULL REFERENCES fw_dash_users (id) ON DELETE CASCADE,
			total_cents integer NOT NULL,
			paid boolean NOT NULL
		);
	`;
	await sql`
		CREATE TABLE IF NOT EXISTS fw_dash_line_items (
			id text PRIMARY KEY,
			invoice_id text NOT NULL REFERENCES fw_dash_invoices (id) ON DELETE CASCADE,
			project_id text NOT NULL REFERENCES fw_dash_projects (id) ON DELETE CASCADE,
			qty integer NOT NULL,
			amount_cents integer NOT NULL
		);
	`;
	await sql`
		CREATE TABLE IF NOT EXISTS fw_dash_metrics_events (
			id text PRIMARY KEY,
			org_id text NOT NULL REFERENCES fw_dash_orgs (id) ON DELETE CASCADE,
			project_id text NOT NULL REFERENCES fw_dash_projects (id) ON DELETE CASCADE,
			bucket integer NOT NULL,
			value integer NOT NULL
		);
	`;

	const idx: string[] = [
		`CREATE INDEX IF NOT EXISTS idx_fw_dash_users_org ON fw_dash_users (org_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fw_dash_teams_org ON fw_dash_teams (org_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fw_dash_tm_team ON fw_dash_team_members (team_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fw_dash_tm_user ON fw_dash_team_members (user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fw_dash_proj_org ON fw_dash_projects (org_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fw_dash_tasks_assignee ON fw_dash_tasks (assignee_user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fw_dash_tasks_project ON fw_dash_tasks (project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fw_dash_comments_task ON fw_dash_comments (task_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fw_dash_tags_org ON fw_dash_tags (org_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fw_dash_taggings_task ON fw_dash_taggings (task_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fw_dash_taggings_tag ON fw_dash_taggings (tag_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fw_dash_inv_org ON fw_dash_invoices (org_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fw_dash_li_inv ON fw_dash_line_items (invoice_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fw_dash_li_proj ON fw_dash_line_items (project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fw_dash_metrics_org ON fw_dash_metrics_events (org_id)`,
		`CREATE INDEX IF NOT EXISTS idx_fw_dash_metrics_proj ON fw_dash_metrics_events (project_id)`,
	];
	for (const q of idx) await sql.unsafe(q);

	ensured = true;
}
