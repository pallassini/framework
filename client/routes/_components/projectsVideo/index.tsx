import { des, state } from "client";
import { PROJECTS } from "./data";

const CENTER_VIDEO_ID = "projects-video-center";
const PROJECTS_COUNT = PROJECTS.length;

const current = state(0);
const sideLeftHovered = state(false);
const sideRightHovered = state(false);

function idx(i: number): number {
  const n = PROJECTS_COUNT;
  if (!n) return 0;
  return ((i % n) + n) % n;
}

function goPrev(): void {
  const n = PROJECTS_COUNT;
  if (!n) return;
  current((c) => (c - 1 + n) % n);
}

function goNext(): void {
  const n = PROJECTS_COUNT;
  if (!n) return;
  current((c) => (c + 1) % n);
}

function onCenterEnded(): void {
  const n = PROJECTS_COUNT;
  if (!n) return;
  if (n <= 1) return;
  current((c) => (c + 1) % n);
}

const srcDesktopLeft = (): string => PROJECTS[idx(current() - 1)]?.video ?? "";
const srcDesktopCenter = (): string => PROJECTS[idx(current())]?.video ?? "";
const srcDesktopRight = (): string => PROJECTS[idx(current() + 1)]?.video ?? "";
const srcMobile = (): string => PROJECTS[idx(current())]?.videoMob ?? "";

export default function ProjectsVideo() {
  const loopOne = PROJECTS_COUNT <= 1;

  return (
    <>
      <show when={des()}>
        <div s="relative w-100vw overflow-hidden">
          <div s="row relative w-100vw min-h-42.1875vw children-centery">
            <div s="relative minw-0 w-50vw h-33.125vw overflow-hidden round-20px">
              <video
                src={srcDesktopLeft}
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
            <div s="absolute center minw-0 w-75vw h-42.1875vw overflow-hidden round-20px z-2 duration-200ms ease-out hover:(scale-105)">
              <video
                id={CENTER_VIDEO_ID}
                src={srcDesktopCenter}
                width="100%"
                height="100%"
                autoplay
                muted
                playsinline
                loop={loopOne}
                preload="auto"
                disablePictureInPicture
                objectFit="cover"
                s="round-20px"
                speed={1}
                ended={onCenterEnded}
              />
            </div>
            <div s="relative minw-0 w-50vw h-33.125vw overflow-hidden round-20px">
              <video
                src={srcDesktopRight}
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
          <div s="relative w-100vw minw-0 h-35.625vh overflow-hidden round-20px">
            <video
              id={CENTER_VIDEO_ID}
              src={srcMobile}
              width="100%"
              height="100%"
              speed={1}
              autoplay
              muted
              playsinline
              loop={loopOne}
              preload="auto"
              disablePictureInPicture
              objectFit="cover"
              ended={onCenterEnded}
              s="round-20px"
            />
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
