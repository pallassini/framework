import { desktop, For, state } from "client";

export default function Home() {
	const prova2 = state(desktop.ping);

	return (
		<>
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
				<For each={prova2}>{(item) => <t s="text-#990000 bg-#009900">DESKTOP {item.from}</t>}</For>
			</div>
		</>
	);
}
