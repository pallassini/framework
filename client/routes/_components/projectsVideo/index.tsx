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

  /** Solo slide centrale (mobile: niente laterali). */
  const centerItemOnly = () => {
    const v = visible();
    const m = v[1];
    return m != null ? [m] : [];
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
      des();
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
        <div s="relative w-100vw overflow-hidden">
          <div s="row relative w-100vw children-centery">
            <For each={visible}>
              {(item, index) => {
                const isCenter = index === 1;
                return (
                  <switch>
                    <case when={isCenter}>
                      <div s="absolute center minw-0 w-75vw h-42.1875vw overflow-hidden round-20px z-2 duration-200ms ease-out hover:(scale-105)">
                        <video
                          id="projects-video-center"
                          key={current()}
                          src={item.video}
                          width="100%"
                          height="100%"
                          autoplay
                          muted
                          playsinline
                          loop={false}
                          preload="auto"
                          disablePictureInPicture
                          objectFit="cover"
                          s="round-20px"
                          speed={1}
                        />
                      </div>
                    </case>
                    <case when={index === 0}>
                      <div s="relative minw-0 w-50vw h-33.125vw overflow-hidden round-20px">
                        <video
                          src={item.video}
                          width="100%"
                          height="100%"
                          muted
                          playsinline
                          preload="metadata"
                          loop={false}
                          disablePictureInPicture
                          objectFit="cover"
                          click={goPrev}
                          hover={sideLeftHovered}
                          s="opacity-10 duration-150ms ease-out hover:(opacity-60) round-20px"
                        />
                      </div>
                    </case>
                    <case when={index === 2}>
                      <div s="relative minw-0 w-50vw h-33.125vw overflow-hidden round-20px">
                        <video
                          src={item.video}
                          width="100%"
                          height="100%"
                          muted
                          playsinline
                          preload="metadata"
                          loop={false}
                          disablePictureInPicture
                          objectFit="cover"
                          click={goNext}
                          hover={sideRightHovered}
                          s="opacity-10 duration-150ms ease-out hover:(opacity-60) round-20px" 
                        />
                      </div>
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
      <show when={!des()}>
        <div s="col relative w-100vw items-center pb-4 pt-2">
          <div s="relative w-100vw  h-35.625vh  round-20px">
            <For each={centerItemOnly}>
              {(item) => (
                <video
                  id="projects-video-center"
                  key={current()}
                  src={item.video}
                  width="100%"
                  speed={1}
                  autoplay
                  muted
                  playsinline
                  loop={false}
                  preload="auto"
                  disablePictureInPicture
                  objectFit="cover"
                  s="round-20px"
                />
              )}
            </For>
          </div>
          <div s="row children-center gapx-2vw mt-3vw">
            <icon name="chevronLeft" size="10vw" click={goPrev} s="opacity-70" />
            <icon name="chevronRight" size="10vw" click={goNext} s="opacity-70" />
          </div>
        </div>
      </show>
    </>
  );
}
