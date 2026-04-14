import { desktop, For, state } from "client";

export default function Home() {
	// Cartella `desktop/routes/prova/index.ts` + `export const users` → RPC `desktop.prova.users`
	const prova2 = state(desktop.prova.users);

	return (
		<>
			<t
				s="text-#ffffff bg-#1a6b3a"
				click={() =>
					void desktop.prova.users({
						onSuccess: (data) => prova2(data),
						onError: (e) => console.error("[desktop.prova.users]", e),
					})
				}
			>
				Chiama desktop
			</t>
			<div s="col gap-2">
				<For each={prova2}>{(item) => <t s="text-#990000 bg-#009900">DESKTOP {item.from}</t>}</For>
			</div>
		</>
	);
}
