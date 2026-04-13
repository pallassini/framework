import { s } from "server";
import { smokeTest } from "../../core/dbCustom";

export default s({
	run: async () => smokeTest(),
});
