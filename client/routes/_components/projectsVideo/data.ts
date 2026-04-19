export type Project = {
  title: string;
  /** Desktop / schermi larghi. */
  video: string;
  /** Mobile: stesso taglio visivo, più leggero (VP9, ~480p, 24 fps, senza audio). */
  videoMob: string;
};

const asset = (relativePath: string): string => new URL(relativePath, import.meta.url).href;

export const PROJECTS: Project[] = [
  {
    title: "Ecommerce Product Stack",
    video: asset("./assets/ecommerce.webm"),
    videoMob: asset("./assets/ecommerce.mob.webm"),
  },
  {
    title: "Flight Assistant UI",
    video: asset("./assets/realEstate.webm"),
    videoMob: asset("./assets/realEstate.mob.webm"),
  },
];
