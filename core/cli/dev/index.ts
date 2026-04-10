import { createServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { printDevBanner } from "./ui";

const dir = path.dirname(fileURLToPath(import.meta.url));
const configFile = path.resolve(dir, "../../client/vite.config.ts");

const server = await createServer({
	configFile,
	server: { port: 3000, strictPort: false },
	logLevel: "warn",
});

await server.listen();

const urls = server.resolvedUrls;
printDevBanner(urls?.local[0] ?? "http://localhost:3000", urls?.network[0]);

const stop = async () => {
	await server.close();
	process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
