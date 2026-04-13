import { desktop, For, server, state } from "client";

export default function Home() {
	const prova2 = state(desktop.ping);
	const dbCheck = state<server<"db">>();

	return (
		<>
			<t
				s="text-#ffffff bg-#1a4d8c"
				click={() =>
					void server.db({
						onSuccess: (data) => dbCheck(data),
						onError: (e) => console.error("[db]", e),
					})
				}
			>
				Test Postgres (nessuna tabella)
			</t>
			<t
				s="text-#ffffff bg-#1a6b3a"
				click={() =>
					void desktop.ping({
						onSuccess: (data) => prova2(data),
					})
				}
			>
				Chiama desktop
			</t>
			<div s="col gap-2">
				<For each={dbCheck} pick={(r) => (r ? [r] : [])}>
					{(data) => <t s="text-#cccccc">Postgres: {data.rows.length} riga/e</t>}
				</For>
				<For each={dbCheck} pick={(r) => r?.rows ?? []}>
					{(row, i) => (
						<t key={i} s="text-#009900 bg-#330000 font-mono text-12">
							{JSON.stringify(row)}
						</t>
					)}
				</For>
				<For each={prova2}>{(item) => <t s="text-#990000 bg-#009900">DESKTOP {item.from}</t>}</For>
			</div>
		</>
	);
}
