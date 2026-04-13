import { desktop, For, state } from "client";
import { dbRpc, type DbRpcResult } from "../db";

export default function Home() {
	const prova2 = state(desktop.ping);
	const lastDb = state<DbRpcResult | undefined>();

	const show = (data: DbRpcResult) => lastDb(data);
	const err = (e: unknown) => console.error("[db]", e);

	return (
		<>
			<t s="text-#ffffff bg-#1a4d8c" click={() => void dbRpc.probe({ onSuccess: show, onError: err })}>
				DB: probe (custom)
			</t>
			<t s="text-#ffffff bg-#2d6a4f" click={() => void dbRpc.usersList({ onSuccess: show, onError: err })}>
				DB: lista users
			</t>
			<t
				s="text-#ffffff bg-#6a4f2d"
				click={() =>
					void dbRpc.usersCreate(
						{ email: `u${Date.now()}@test.local`, name: "Utente demo", role: "user" },
						{ onSuccess: show, onError: err },
					)
				}
			>
				DB: crea user demo
			</t>
			<t
				s="text-#ffffff bg-#4f2d6a"
				click={() => {
					const id = typeof prompt === "function" ? prompt("ID user da aggiornare (nome)") : null;
					if (!id?.trim()) return;
					void dbRpc.usersUpdate(
						id.trim(),
						{ name: `Aggiornato ${new Date().toLocaleTimeString()}` },
						{ onSuccess: show, onError: err },
					);
				}}
			>
				DB: aggiorna user (chiede id)
			</t>
			<t
				s="text-#ffffff bg-#6a2d2d"
				click={() => {
					const id = typeof prompt === "function" ? prompt("ID user da eliminare") : null;
					if (!id?.trim()) return;
					void dbRpc.usersDelete(id.trim(), { onSuccess: show, onError: err });
				}}
			>
				DB: elimina user (chiede id)
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
				<For each={lastDb} pick={(r) => (r ? [r] : [])}>
					{(data) => (
						<t s="text-#cccccc font-mono text-11 whitespace-prewrap">
							{JSON.stringify(data, null, 2)}
						</t>
					)}
				</For>
				<For each={prova2}>{(item) => <t s="text-#990000 bg-#009900">DESKTOP {item.from}</t>}</For>
			</div>
		</>
	);
}
