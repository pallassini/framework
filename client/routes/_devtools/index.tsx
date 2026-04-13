import { desktop, For, state } from "client";

/** Route `/_devtools`: editor / strumenti interni (stesso dev server dell’app). */
export default function DevtoolsHome() {
	const pingResult = state<unknown>();

	return (
		<>
			<t s="text-#ffffff bg-#3d2d6a p-2 font-semibold">_devtools</t>
			<t
				s="text-#ffffff bg-#1a4d8c p-2"
				click={() =>
					void desktop._devtools(
						{ path: "/_devtools" },
						{
							onError: (e: unknown) => console.error("[_devtools]", e),
						},
					)
				}
			>
				Apri un’altra finestra (/_devtools)
			</t>
			<t
				s="text-#ffffff bg-#2d6a4f p-2"
				click={() =>
					void desktop.ping({
						onSuccess: (data) => pingResult(data),
					})
				}
			>
				Desktop ping
			</t>
			<For each={pingResult} pick={(r) => (r != null ? [r] : [])}>
				{(data) => (
					<t s="text-#cccccc font-mono text-11 whitespace-prewrap">
						{JSON.stringify(data, null, 2)}
					</t>
				)}
			</For>
		</>
	);
}
