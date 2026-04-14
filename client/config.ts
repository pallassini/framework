import { v } from "client";

export const clientConfig = {
	state: {
		id: 20,
		role: {
			admin: false,
		},
	},

	sessionState: {
		id: 0,
		name: "",
	},

	persistState: {
		id: 0,
		email: "",
		devtools: {
			menu: "db" as "db" | "state",
		},
	},
};
