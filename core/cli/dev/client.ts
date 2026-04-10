import { networkInterfaces } from "node:os";
import path from "node:path";
import { createServer } from "vite";
import type { ViteDevServer } from "vite";

export async function startClient(root: string): Promise<{ client: ViteClient }> {
  const server = await createServer({
    configFile: path.join(root, "core/client/vite.config.ts"),
    root: root,
  });
  await server.listen();
  const cfg = Number(server.config.server.port) || 3000;
  const base = server.resolvedUrls?.local?.[0] ?? `https://localhost:${cfg}/`;
  const url = base.endsWith("/") ? base : `${base}/`;
  const port = Number(new URL(url).port) || cfg;
  const client = Object.assign(server, {
    url,
    port,
    network: networkUrl(url, server.resolvedUrls?.network?.[0]),
  }) as ViteClient;
  ui(client);
  return { client };
}
//______________________________________________________________________________________________________________
// UTILS
export type ViteClient = ViteDevServer & { url: string; port: number; network: string };

function networkUrl(url: string, fromVite?: string): string {
  if (fromVite) return fromVite;
  const u = new URL(url.endsWith("/") ? url : `${url}/`);
  const port = u.port;
  for (const list of Object.values(networkInterfaces() ?? {})) {
    if (!list) continue;
    for (const i of list) {
      if (i.family === "IPv4" && !i.internal) {
        return `https://${i.address}:${port}/`;
      }
    }
  }
  return url;
}

const R = "\x1b[0m";
const M = "\x1b[38;2;255;0;135m";
const B = "\x1b[1;38;2;255;0;135m";
const W = 40;
const P = 2;
const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
const fill = (s: string, n: number) => s + " ".repeat(Math.max(0, n - strip(s).length));
const row = (t: string) => M + "\u2502" + R + " ".repeat(P) + fill(t, W - P) + M + "\u2502" + R;

function ui(c: ViteClient): void {
  const d = M + "\u25c6" + R;
  const title = " " + B + "dev" + R + " ";
  const tw = strip(title).length;
  const L = Math.floor((W - tw) / 2);
  const top =
    M + "\u256d" + "\u2500".repeat(L) + title + M + "\u2500".repeat(W - L - tw) + "\u256e" + R;
  const blank = M + "\u2502" + R + " ".repeat(W) + M + "\u2502" + R;
  process.stdout.write(
    "\n" +
      top +
      "\n" +
      blank +
      "\n" +
      row(`${d} local  ${M}${c.url}${R}`) +
      "\n" +
      row(`${d} lan    ${M}${c.network}${R}`) +
      "\n" +
      blank +
      "\n" +
      M +
      "\u2570" +
      "\u2500".repeat(W) +
      "\u256f" +
      R +
      "\n" +
      ` ${B}[d]${R} Desktop\n\n`,
  );
}
