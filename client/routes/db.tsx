import { For, server, state } from "client";

export default function DbRoute() {
	const custom = state<server<"dbCustom">>();

	return (
		<div s="col gap-3 p-4 max-w-2xl">
			<t s="text-18 font-bold text-#fff">dbCustom</t>
			<t s="text-14 text-#aaa">
				Stessa connessione di core/db (DATABASE_URL / fallback). RPC server.dbCustom → smokeTest().
			</t>
			<t
				s="text-#ffffff bg-#4f46e5 px-3 py-2 rounded pointer inline-block"
				click={() =>
					void server.dbCustom({
						onSuccess: (data) => custom(data),
						onError: (e) => console.error("[dbCustom]", e),
					})
				}
			>
				Esegui smoke test
			</t>
			<For each={custom} pick={(r) => (r ? [r] : [])}>
				{(data) => (
					<div s="col gap-2">
						<t s="text-#ccc">
							{data.layer} · {data.connection.host} / {data.connection.database} · {data.connection.user}
						</t>
						<t s="text-#888 text-11 font-mono">{data.postgresVersion}</t>
					</div>
				)}
			</For>
			<For each={custom} pick={(r) => r?.rows ?? []}>
				{(row, i) => (
					<t key={i} s="text-#22c55e bg-#14532d font-mono text-12 p-2 rounded">
						{JSON.stringify(row)}
					</t>
				)}
			</For>
		</div>
	);
}
