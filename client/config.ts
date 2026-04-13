export const clientConfig = {
	state: {
		id: 20,
		role: "",
	},

	sessionState: {
		id: 0,
		name: "",
	},

	persistState: {
		id: 0,
		email: "",
	},
} as const satisfies {
	state: Record<string, unknown>;
	sessionState: Record<string, unknown>;
	persistState: Record<string, unknown>;
};
