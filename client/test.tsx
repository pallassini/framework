import { initPushServiceWorker, server, state, watch } from "client";

const LOG_CAP = 120;

/** Testo lungo (errori RPC / URL): va a capo su mobile invece di uscire dalla schermata. */
const breakLongText: Record<string, string> = {
	whiteSpace: "pre-wrap",
	wordBreak: "break-word",
	overflowWrap: "anywhere",
	maxWidth: "100%",
};

/** Stesso schema di flowtable: `ArrayBuffer` dedicato per `applicationServerKey`. */
function urlBase64ToUint8Array(base64String: string): BufferSource {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = atob(base64);
	const buf = new ArrayBuffer(raw.length);
	const out = new Uint8Array(buf);
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}

function isIos(): boolean {
	return (
		/iPad|iPhone|iPod/.test(navigator.userAgent) ||
		(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
	);
}

function isStandaloneDisplay(): boolean {
	const mm = window.matchMedia("(display-mode: standalone)");
	if (mm.matches) return true;
	const nav = navigator as Navigator & { standalone?: boolean };
	return nav.standalone === true;
}

function timeShort(): string {
	return new Date().toISOString().slice(11, 23);
}

async function getFreshVapidAndReg(): Promise<{
	reg: ServiceWorkerRegistration;
	publicKey: string;
	vapidLogLine?: string;
}> {
	const reg = await initPushServiceWorker();
	const vapid = await server.notification.subscribe({ mode: "publicKey" });
	if (!vapid.ok || !("publicKey" in vapid) || typeof vapid.publicKey !== "string" || !vapid.publicKey) {
		throw new Error("Risposta publicKey non valida.");
	}
	const vapidLogLine =
		"logLine" in vapid && typeof (vapid as { logLine?: string }).logLine === "string"
			? (vapid as { logLine: string }).logLine
			: undefined;
	return { reg, publicKey: vapid.publicKey, vapidLogLine };
}

export default function Test() {
	const msg = state("");
	const iosHint = state(false);
	const logLines = state<string[]>([]);

	const appendLog = (line: string): void => {
		const row = `${timeShort()} ${line}`;
		const cur = logLines();
		const next = [...cur, row];
		if (next.length > LOG_CAP) next.splice(0, next.length - LOG_CAP);
		logLines(next);
	};

	const setMsg = (t: string): void => {
		msg(t);
	};

	watch(() => {
		iosHint(isIos() && !isStandaloneDisplay());
	});

	watch(() => {
		void initPushServiceWorker()
			.then((reg) => {
				appendLog(`SW register+ready ok; active=${reg.active?.state ?? "none"} script=${reg.active?.scriptURL ?? "?"}`);
			})
			.catch((e) => {
				appendLog(`prefetch SW fallito: ${e instanceof Error ? e.message : String(e)}`);
			});
	});

	const registerPush = async (): Promise<void> => {
		appendLog("— Registra push —");
		if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
			appendLog("ERRORE: ServiceWorker o PushManager assente");
			setMsg("Push non supportato in questo browser.");
			return;
		}
		const perm = await Notification.requestPermission();
		appendLog(`Notification.permission → ${perm}`);
		if (perm !== "granted") {
			setMsg(`Permesso notifiche: ${perm}`);
			return;
		}
		try {
			appendLog("RPC notification.subscribe (publicKey + register)…");
			const { reg, publicKey, vapidLogLine } = await getFreshVapidAndReg();
			if (vapidLogLine) appendLog(`RPC vapid: ${vapidLogLine}`);
			appendLog(`VAPID public key len=${publicKey.length} (primi 12 char: ${publicKey.slice(0, 12)}…)`);
			const existing = await reg.pushManager.getSubscription();
			if (existing) {
				appendLog("Subscription push già presente: unsubscribe prima di risottoscrivere (altra applicationServerKey).");
				await existing.unsubscribe();
			}
			const sub = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(publicKey),
			});
			const j = sub.toJSON();
			const ep = typeof j.endpoint === "string" ? j.endpoint : "";
			let host = "?";
			try {
				host = new URL(ep).host;
			} catch {
				/* */
			}
			appendLog(`pushManager.subscribe OK endpoint host=${host}`);
			const subRes = await server.notification.subscribe({
				mode: "register",
				subscription: j as never,
			});
			if ("logLine" in subRes && typeof (subRes as { logLine?: string }).logLine === "string") {
				appendLog(`RPC notification.subscribe: ${(subRes as { logLine: string }).logLine}`);
			}
			setMsg("Registrato. Su iPhone usa la PWA dalla Home. Vedi log sotto per debug.");
		} catch (e) {
			const m = e instanceof Error ? e.message : String(e);
			const extra =
				e instanceof Error && e.cause != null
					? `\ncause: ${e.cause instanceof Error ? e.cause.message : String(e.cause)}`
					: "";
			appendLog(`ERRORE register:\n${m}${extra}`);
			setMsg(`${m}${extra.replace("\n", " | ")}`);
		}
	};

	const sendTest = async (): Promise<void> => {
		appendLog("— Invia notifica di test —");
		try {
			const r = await server.notification({
				title: "Test Flow",
				body: `Orario server: ${new Date().toISOString()}`,
			});
			if ("logLine" in r && typeof (r as { logLine?: string }).logLine === "string") {
				appendLog(`RPC notification (send): ${(r as { logLine: string }).logLine}`);
			}
			setMsg(r.ok ? "RPC ok: vedi log sotto (status webpush). Notifica OS = altro passaggio." : `Errore: ${r.error}`);
		} catch (e) {
			const m = e instanceof Error ? e.message : String(e);
			const extra =
				e instanceof Error && e.cause != null
					? ` | cause: ${e.cause instanceof Error ? e.cause.message : String(e.cause)}`
					: "";
			const type = e && typeof e === "object" && "type" in e ? String((e as { type?: unknown }).type) : "";
			const full = type ? `${m}${extra} [type=${type}]` : `${m}${extra}`;
			appendLog(`ERRORE sendTest RPC:\n${full}`);
			setMsg(full);
		}
	};

	const clearLog = (): void => {
		logLines([]);
		appendLog("log pulito");
	};

	const swProbe = async (): Promise<void> => {
		appendLog("— Stato SW —");
		try {
			const reg = await initPushServiceWorker();
			appendLog(`registration.installing=${reg.installing?.state ?? "null"} waiting=${reg.waiting?.state ?? "null"} active=${reg.active?.state ?? "null"}`);
			appendLog(`active.scriptURL=${reg.active?.scriptURL ?? "null"}`);
			const sub = await reg.pushManager.getSubscription();
			appendLog(`getSubscription: ${sub ? "presente" : "null"}`);
			if (sub) {
				const u = sub.toJSON().endpoint ?? "";
				appendLog(`endpoint host try: ${u ? new URL(u).host : "?"}`);
			}
		} catch (e) {
			appendLog(`swProbe errore: ${e instanceof Error ? e.message : String(e)}`);
		}
	};

	return (
		<div s="col gap-base-4 p-base-6 w-100% maxw-120 minw-0">
			<div s="text-6 font-6">Notifiche push (test)</div>
			<show when={() => iosHint()}>
				<div s="text-3 p-base-3 round-3 b-1 b-primary/40 c-fg/90">
					Su <t s="font-6">iOS</t> le Web Push sono affidabili soprattutto con l’app aggiunta alla{" "}
					<t s="font-6">Home</t>. Da tab Safari spesso non compare nulla. Apri dall’icona Home.
				</div>
			</show>
			<div s="text-3 c-fg/70">
				Log in pagina (non console). Se il server rigenera VAPID a ogni avvio, la chiave va riallineata: usa di nuovo{" "}
				<t s="font-6">Registra push</t> dopo ogni restart di <t s="font-6">bun dev</t> o imposta{" "}
				<t s="font-6">VAPID_*</t> in env.
			</div>
			<div s="row gap-base-3 flex-wrap">
				<t s="text-4 p-base-3 round-3 b-1 cursor-pointer" click={() => void registerPush()}>
					Registra push
				</t>
				<t s="text-4 p-base-3 round-3 b-1 cursor-pointer" click={() => void sendTest()}>
					Invia notifica di test
				</t>
				<t s="text-4 p-base-3 round-3 b-1 cursor-pointer" click={() => void swProbe()}>
					Stato SW
				</t>
				<t s="text-4 p-base-3 round-3 b-1 cursor-pointer" click={clearLog}>
					Pulisci log
				</t>
			</div>
			<show when={() => !!msg()}>
				<div s="text-3 p-base-3 round-2 bg-fg/5" style={breakLongText}>
					{() => msg()}
				</div>
			</show>
			<div s="text-4 font-6">Log debug</div>
			<div s="text-2 p-base-3 round-2 bg-fg/5 overflow-y-auto maxh-50vh minw-0" style={breakLongText}>
				{() => {
					const L = logLines();
					return L.length ? L.join("\n") : "— nessun evento —";
				}}
			</div>
		</div>
	);
}
