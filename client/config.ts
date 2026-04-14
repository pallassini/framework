import { v } from "../core/client/validator";

export const clientConfig = {
	state: {
		id: v.uuid(),
	},

	sessionState: {
		id: v.uuid(),
	},

	persistState: {
		id: v.uuid(),
		email: "",
		devtools: {
			menu: "db" as "db" | "state",
		},
	},
};
