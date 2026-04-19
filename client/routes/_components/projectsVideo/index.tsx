import { des, state } from "client";
import { PROJECTS } from "./data";

const CENTER_VIDEO_ID = "projects-video-center";
const PROJECTS_COUNT = PROJECTS.length;

/**
 * `state(x)` sul root client crea un nuovo signal a ogni chiamata: stato locale del componente
 * va tenuto fuori dalla funzione (modulo) o in uno store con shape, altrimenti ogni re-run resetta.
 */
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
  current((c) => (c + 1) % n);
}

/** Identità di funzione stabile: il tag `video` non deve ricevere `() => …` nuovo a ogni render. */
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
          <div s="row relative w-100vw children-centery">
            <div s="relative minw-0 w-50vw h-33.125vw overflow-hidden round-20px">
              <video
                src={srcDesktopLeft}
                width="100%"
                height="100%"
                muted
                playsinline
                preload="none"
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
                preload="none"
                loop={false}
                disablePictureInPicture
                objectFit="cover"
                click={goNext}
                hover={sideRightHovered}
                s="opacity-10 duration-150ms ease-out hover:(opacity-60) round-20px"
              />
            </div>
          </div>
          <div s="absolute row z-3 center w-100vw px-3vw events-none">
            <icon
              name="chevronLeft"
              size="6vw"
              click={goPrev}
              s="left events-auto cursor-pointer opacity-70 duration-200ms ease-out hover:(opacity-100 scale-110)"
            />
            <icon
              name="chevronRight"
              size="6vw"
              click={goNext}
              s="right events-auto cursor-pointer opacity-70 duration-200ms ease-out hover:(opacity-100 scale-110)"
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
