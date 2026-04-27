/* Service worker: push in background (PWA / tab chiusa).
 * Safari (incluso iOS): niente push “silenziosi” — bisogna chiamare showNotification nel push handler (Apple). */
self.addEventListener("push", (event) => {
	let data = {};
	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = {};
	}
	const title = typeof data.title === "string" ? data.title : "Flow";
	const body = typeof data.body === "string" ? data.body : "Notifica";
	const iconUrl = new URL("/assets/favicon.png", self.location.origin).href;
	event.waitUntil(
		(async () => {
			try {
				await self.registration.showNotification(title, {
					body,
					icon: iconUrl,
					tag: "flow-push",
				});
			} catch (e) {
				try {
					await self.registration.showNotification(title, { body, tag: "flow-push" });
				} catch (e2) {
					console.error("[sw-push] showNotification:", e, e2);
				}
			}
		})(),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = event.notification.data && event.notification.data.url;
	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
			for (const c of clientList) {
				if (c.url && "focus" in c) return c.focus();
			}
			if (url) return self.clients.openWindow(url);
			return self.clients.openWindow("/");
		}),
	);
});
