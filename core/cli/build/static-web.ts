import { existsSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";

const INDEX = "index.html";

function webRoot(projectRoot: string): string {
	return resolve(join(projectRoot, "build", "web"));
}

function underWebRoot(abs: string, root: string): boolean {
	return abs === root || abs.startsWith(root + sep);
}

/** GET/HEAD: file in `build/web` se presente; altrimenti `index.html` (SPA). */
export async function tryServeBuiltWeb(req: Request, projectRoot: string): Promise<Response | null> {
	if (req.method !== "GET" && req.method !== "HEAD") return null;

	const root = webRoot(projectRoot);
	const indexPath = join(root, INDEX);
	if (!existsSync(indexPath)) return null;

	const url = new URL(req.url);
	let pathname = url.pathname;
	try {
		pathname = decodeURIComponent(pathname);
	} catch {
		return null;
	}
	if (pathname.includes("\0")) return null;

	const rel = pathname.replace(/^\/+/, "");
	const fsPath = rel === "" ? indexPath : resolve(root, rel);
	if (!underWebRoot(fsPath, root)) return null;

	let pathToServe: string;
	if (!existsSync(fsPath)) {
		pathToServe = indexPath;
	} else {
		try {
			const st = statSync(fsPath);
			if (st.isDirectory()) {
				const idx = join(fsPath, INDEX);
				pathToServe = existsSync(idx) ? idx : indexPath;
			} else {
				pathToServe = fsPath;
			}
		} catch {
			pathToServe = indexPath;
		}
	}

	const file = Bun.file(pathToServe);
	if (!(await file.exists())) return null;
	const body = req.method === "HEAD" ? null : file;
	const h = new Headers();
	const type = file.type;
	if (type) h.set("Content-Type", type);
	return new Response(body, { headers: h });
}
