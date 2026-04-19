export type Project = {
  title: string;
  /** Desktop / schermi larghi. */
  video: string;
  /** Mobile: stesso taglio visivo, più leggero (VP9, ~480p, 24 fps, senza audio). */
  videoMob: string;
};

/**
 * Percorsi come `new URL("./assets/…", import.meta.url)` letterali — così Vite in produzione
 * include i file in `build/web/assets` con hash. Una wrapper `asset(path)` dinamica non viene
 * risolta in build e i video risultano rotti nelle pagine deployate.
 */
export const PROJECTS: Project[] = [
  {
    title: "Ecommerce Product Stack",
    video: new URL("./assets/ecommerce.webm", import.meta.url).href,
    videoMob: new URL("./assets/ecommerce.mob.webm", import.meta.url).href,
  },
  {
    title: "Flight Assistant UI",
    video: new URL("./assets/realEstate.webm", import.meta.url).href,
    videoMob: new URL("./assets/realEstate.mob.webm", import.meta.url).href,
  },
];
