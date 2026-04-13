import { seedPlanForTier, type SeedPlan } from "./dashboardTier";

/** Moduli usano questi limiti dopo ogni seed (join / filtri). */
let plan: SeedPlan = seedPlanForTier("10k");

export function setDashboardSeedPlan(p: SeedPlan): void {
	plan = p;
}

export function getDashboardSeedPlan(): SeedPlan {
	return plan;
}
