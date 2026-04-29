import { signal } from "../state";

const TARGET_USER_KEY = "fw_target_user_id";

function readTargetUserId(): string | null {
	if (typeof window === "undefined") return null;
	const v = window.localStorage.getItem(TARGET_USER_KEY);
	if (!v) return null;
	const t = v.trim();
	return t.length > 0 ? t : null;
}

const targetUserIdSignal = signal<string | null>(readTargetUserId());

if (typeof window !== "undefined") {
	window.addEventListener("storage", (ev) => {
		if (ev.key !== TARGET_USER_KEY) return;
		targetUserIdSignal(readTargetUserId());
	});
}

export function setTargetUserId(userId: string | null | undefined): void {
	if (typeof window === "undefined") return;
	const v = (userId ?? "").trim();
	if (!v) {
		window.localStorage.removeItem(TARGET_USER_KEY);
		targetUserIdSignal(null);
		return;
	}
	window.localStorage.setItem(TARGET_USER_KEY, v);
	targetUserIdSignal(v);
}

export function getTargetUserId(): string | null {
	return targetUserIdSignal();
}
