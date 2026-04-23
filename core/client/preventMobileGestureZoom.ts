/**
 * Blocca pinch-zoom (eventi `gesture*` su iOS Safari) e il doppio tap che zooma la pagina.
 * Chiamare una volta all'avvio dell'app (entry client).
 */
let lastTouchEnd = 0;

function preventGestureZoom(event: Event): void {
	event.preventDefault();
}

function preventDoubleTapZoom(event: TouchEvent): void {
	const now = Date.now();
	if (now - lastTouchEnd <= 300) {
		event.preventDefault();
	}
	lastTouchEnd = now;
}

export function installPreventMobileGestureZoom(root: Document = document): void {
	root.addEventListener("gesturestart", preventGestureZoom, { passive: false });
	root.addEventListener("gesturechange", preventGestureZoom, { passive: false });
	root.addEventListener("gestureend", preventGestureZoom, { passive: false });
	root.addEventListener("touchend", preventDoubleTapZoom, { passive: false });
}
