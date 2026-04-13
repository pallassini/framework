import { For, server, state } from "client";

export default function DbCustomRoute() {
	const res = state<server<"db.custom">>();

	return (
		<div s="col gap-3 p-4 max-w-2xl">
			<t s="text-18 font-bold text-#fff">dbCustom (Zig engine)</t>
			<t s="text-14 text-#aaa">
				Con `zig build` in `core/dbCustom/zig` carica la DLL/.so; altrimenti fallback in-memory. RPC: server.db.custom → POST /_server/db/custom.
			</t>
			<t
				s="text-#ffffff bg-#7c3aed px-3 py-2 rounded pointer inline-block"
				click={() =>
					void server.db.custom({
						onSuccess: (data) => res(data),
						onError: (e) => console.error("[dbCustom]", e),
					})
				}
			>
				Smoke test (ping42 + put/get)
			</t>
			<For each={res} pick={(r) => (r ? [r] : [])}>
				{(data) => (
					<div s="col gap-1">
						<t s="text-#ccc">
							engine={data.engine} ping={data.ping} id={data.putId}
						</t>
						<t s="text-#86efac font-mono text-12">{data.roundtrip}</t>
					</div>
				)}
			</For>
		</div>
	);
}
