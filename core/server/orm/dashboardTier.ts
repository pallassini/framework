export type DashTier = "10k" | "100k" | "1m";

export type SeedPlan = {
	readonly orgs: number;
	readonly users: number;
	readonly teams: number;
	readonly team_members: number;
	readonly projects: number;
	readonly tasks: number;
	readonly comments: number;
	readonly tags: number;
	readonly taggings: number;
	readonly invoices: number;
	readonly line_items: number;
	readonly metrics: number;
};

/** Riferimento ~52k righe (proporzioni dashboard). */
const REF: SeedPlan = {
	orgs: 25,
	users: 400,
	teams: 80,
	team_members: 1200,
	projects: 800,
	tasks: 4000,
	comments: 10000,
	tags: 150,
	taggings: 5000,
	invoices: 280,
	line_items: 2400,
	metrics: 20000,
};

function sumPlan(p: SeedPlan): number {
	return (
		p.orgs +
		p.users +
		p.teams +
		p.team_members +
		p.projects +
		p.tasks +
		p.comments +
		p.tags +
		p.taggings +
		p.invoices +
		p.line_items +
		p.metrics
	);
}

function scaleRef(f: number): SeedPlan {
	const scale = (n: number) => Math.max(1, Math.round(n * f));
	return {
		orgs: scale(REF.orgs),
		users: scale(REF.users),
		teams: scale(REF.teams),
		team_members: scale(REF.team_members),
		projects: scale(REF.projects),
		tasks: scale(REF.tasks),
		comments: scale(REF.comments),
		tags: scale(REF.tags),
		taggings: scale(REF.taggings),
		invoices: scale(REF.invoices),
		line_items: scale(REF.line_items),
		metrics: scale(REF.metrics),
	};
}

/** Piano dati per tier (~10k / ~100k / ~1M righe totali). */
export function seedPlanForTier(tier: DashTier): SeedPlan {
	const refSum = sumPlan(REF);
	if (tier === "10k") {
		return scaleRef(10_000 / refSum);
	}
	if (tier === "100k") {
		return scaleRef(100_000 / refSum);
	}
	/*1m: parte relazionale ~come 100k, metrics riempie fino a ~1M. */
	const rel = scaleRef(100_000 / refSum);
	const nonM =
		rel.orgs +
		rel.users +
		rel.teams +
		rel.team_members +
		rel.projects +
		rel.tasks +
		rel.comments +
		rel.tags +
		rel.taggings +
		rel.invoices +
		rel.line_items;
	const metrics = Math.max(100_000, 1_000_000 - nonM);
	return { ...rel, metrics };
}
