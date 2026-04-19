import { des, For, state, watch } from "client";
import { PROJECTS } from "./data";

export default function ProjectsVideo() {
  const current = state(0);
  const sideLeftHovered = state(false);
  const sideRightHovered = state(false);

  const visible = () => {
    const list = PROJECTS;
    const n = list.length;
    if (!n) return [];
    const c = ((current() % n) + n) % n;
    return [list[(c - 1 + n) % n], list[c], list[(c + 1) % n]];
  };

  const goPrev = (): void => {
    const n = PROJECTS.length;
    if (!n) return;
    current((i) => (i - 1 + n) % n);
  };

  const goNext = (): void => {
    const n = PROJECTS.length;
    if (!n) return;
    current((i) => (i + 1) % n);
  };

  watch(
    () => {
      if (!des()) return;
      current();
      let el: HTMLVideoElement | null = null;
      let cancelled = false;

      const onEnded = (): void => {
        if (cancelled) return;
        const n = PROJECTS.length;
        if (n <= 1) {
          const v = el;
          if (v) {
            v.currentTime = 0;
            void v.play();
          }
          return;
        }
        current((i) => (i + 1) % n);
      };

      const tid = window.setTimeout(() => {
        if (cancelled) return;
        el = document.getElementById("projects-video-center") as HTMLVideoElement | null;
        if (!el) return;
        el.addEventListener("ended", onEnded);
      }, 0);

      return () => {
        cancelled = true;
        clearTimeout(tid);
        if (el) el.removeEventListener("ended", onEnded);
      };
    },
    { watch: [des, current] },
  );

  return (
    <>
      <show when={des()}>
        <div s="relative w-100vw">
          <div s="row relative w-100vw">
            <For each={visible}>
              {(item, index) => {
                const isCenter = index === 1;
                return (
                  <switch>
                    <case when={isCenter}>
                      <video
                        id="projects-video-center"
                        key={current()}
                        src={item.video}
                        autoplay
                        muted
                        playsinline
                        loop={false}
                        preload="auto"
                        disablePictureInPicture
                        objectFit="cover"
                        s="round-20px w-75vw absolute center z-2 duration-200ms ease-out hover:(scale-105)"
                      />
                    </case>
                    <case when={index === 0}>
                      <video
                        src={item.video}
                        muted
                        playsinline
                        preload="metadata"
                        loop={false}
                        disablePictureInPicture
                        objectFit="cover"
                        click={goPrev}
                        hover={sideLeftHovered}
                        s="round-20px w-50vw opacity-10 left duration-150ms ease-out hover:(opacity-40)"
                      />
                    </case>
                    <case when={index === 2}>
                      <video
                        src={item.video}
                        muted
                        playsinline
                        preload="metadata"
                        loop={false}
                        disablePictureInPicture
                        objectFit="cover"
                        click={goNext}
                        hover={sideRightHovered}
                        s="round-20px w-50vw opacity-10 right duration-150ms ease-out hover:(opacity-40)"
                      />
                    </case>
                  </switch>
                );
              }}
            </For>
          </div>
          <div s="absolute row z-3 center w-100vw px-3vw no-events">
            <icon
              name="chevronLeft"
              size="6vw"
              s={() => ({
                base: `left duration-200ms ease-out ${sideLeftHovered() ? "scale-130 opacity-100" : "scale-100 opacity-50"}`,
              })}
            />
            <icon
              name="chevronRight"
              size="6vw"
              s={() => ({
                base: `right duration-200ms ease-out ${sideRightHovered() ? "scale-130 opacity-100" : "scale-100 opacity-50"}`,
              })}
            />
          </div>
        </div>
      </show>
      <show when={!des()}></show>
    </>
  );
}
