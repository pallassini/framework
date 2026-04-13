import { s } from "server";

/** RPC `ping` → `await server.ping()` */
export default s({
  run() {
    return { ok: true as const };
  },
});

/** RPC `ping.meta` → `await server.ping.meta()` */
export const brooo = s({
  rateLimit: {
    window: 5000,
    max: 3,
  },
  run: async () => {
    return { name: "pingddddwdwdwdw" as const };
  },
});
