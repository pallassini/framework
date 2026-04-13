import { writeServerRoutesGen } from "../../server/routes/generate";

/** Allinea `core/client/server/routes-gen.ts` a `server/routes/**` (anche senza passare da Vite). */
export async function generateServerClientTypes(projectRoot: string): Promise<void> {
	writeServerRoutesGen(projectRoot);
}
