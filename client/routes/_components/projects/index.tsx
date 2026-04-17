import { des, For, state } from "client";
import { PROJECTS } from "./data";

export default function Projects() {
  const current = state(0);
  const cardHovered = state(false);
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

  return (
    <>
      <show when={des()}>
        <div s="relative w-100vw">
          <div s="row relative w-100vw" hover={cardHovered}>
            <For each={visible}>
              {(item, index) => {
                const isCenter = index === 1;
                return (
                  <switch>
                    <case when={isCenter}>
                      <img
                        src={item.slides[0].image}
                        alt=""
                        s="round-20px w-60vw absolute center z-2 duration-200ms ease-out hover:(scale-115)"
                      />
                    </case>
                    <case when={index === 0}>
                      <img
                        src={item.slides[0].image}
                        alt=""
                        click={goPrev}
                        s="round-20px w-50vw opacity-30 left duration-150ms ease-out hover:(opacity-40)"
                      />
                    </case>
                    <case when={index === 2}>
                      <img
                        src={item.slides[0].image}
                        alt=""
                        click={goNext}
                        s="round-20px w-50vw opacity-30 right duration-150ms ease-out hover:(opacity-40)"
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
                base: `left duration-200ms ease-out ${cardHovered() ? "scale-130 opacity-100" : "scale-100 opacity-50"}`,
              })}
            />
            <icon
              name="chevronRight"
              size="6vw"
              s={() => ({
                base: `right duration-200ms ease-out ${cardHovered() ? "scale-130 opacity-100" : "scale-100 opacity-50"}`,
              })}
            />
          </div>
        </div>
      </show>
      <show when={!des()}></show>
    </>
  );
}
