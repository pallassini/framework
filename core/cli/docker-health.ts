/** Usato da `HEALTHCHECK` nel Dockerfile (RPC `ping`). */
const p = process.env.PORT ?? "3000";
const r = await fetch(`http://127.0.0.1:${p}/_server/ping`, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: "{}",
});
process.exit(r.ok ? 0 : 1);
