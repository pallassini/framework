import { des, For, state } from "client";
import { PROJECTS } from "./data";

export default function Projects() {
  const current = state(0);
  const slideIndex = state(0);
  const sideLeftHovered = state(false);
  const sideRightHovered = state(false);
  const visible = () => {
    const list = PROJECTS;
    const n = list.length;
    if (!n) return [];
    const c = ((current() % n) + n) % n;
    return [list[(c - 1 + n) % n], list[c], list[(c + 1) % n]];
  };

  const centerSlides = () => visible()[1]?.slides ?? [];

  const slideAt = (slides: { image: string }[], i: number): { image: string } | undefined => {
    const n = slides.length;
    if (!n) return undefined;
    return slides[((i % n) + n) % n];
  };

  const goPrev = (): void => {
    const n = PROJECTS.length;
    if (!n) return;
    slideIndex(0);
    current((i) => (i - 1 + n) % n);
  };

  const goNext = (): void => {
    const n = PROJECTS.length;
    if (!n) return;
    slideIndex(0);
    current((i) => (i + 1) % n);
  };

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
                      <img
                        src={slideAt(item.slides, slideIndex())?.image ?? ""}
                        alt=""
                        s="round-20px w-75vw absolute center z-2 duration-200ms ease-out hover:(scale-105)"
                      />
                    </case>
                    <case when={index === 0}>
                      <img
                        src={item.slides[0].image}
                        alt=""
                        click={goPrev}
                        hover={sideLeftHovered}
                        s="round-20px w-50vw opacity-10 left duration-150ms ease-out hover:(opacity-40)"
                      />
                    </case>
                    <case when={index === 2}>
                      <img
                        src={item.slides[0].image}
                        alt=""
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
      <div s="row children-center mt-8vh gap-2vw">
        <For each={centerSlides}>
          {(slide, i) => {
            const active = () => i === slideIndex();
            return (
              <div click={() => slideIndex(i)}>
                <img
                  src={slide.image}
                  s={() => ({
                    base: `w-10vw round-20px duration-200 cursor-pointer b-2px ${active() ? "scale-110 opacity-100 b-#fff" : "opacity-55 b-transparent hover:(opacity-90 scale-105)"}`,
                  })}
                />
              </div>
            );
          }}
        </For>
      </div>
      </show>
      <show when={!des()}></show>
    </>
  );
}
