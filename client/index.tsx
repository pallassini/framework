import { App, url } from "client";
import "./index.css";
import Menu from "./components/menu";

let lastTouchEnd = 0;
const preventGestureZoom = (event: Event): void => {
	event.preventDefault();
};
const preventDoubleTapZoom = (event: TouchEvent): void => {
	const now = Date.now();
	if (now - lastTouchEnd <= 300) {
		event.preventDefault();
	}
	lastTouchEnd = now;
};

document.addEventListener("gesturestart", preventGestureZoom, { passive: false });
document.addEventListener("gesturechange", preventGestureZoom, { passive: false });
document.addEventListener("gestureend", preventGestureZoom, { passive: false });
document.addEventListener("touchend", preventDoubleTapZoom, { passive: false });

App((Page) => (
  <>
    <show when={url.segment(0) != "admin"}>
      <Menu />
    </show>
    <Page />
  </>
));
