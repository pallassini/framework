export type Project = {
  title: string;
  video: string;
};

const asset = (relativePath: string): string => new URL(relativePath, import.meta.url).href;

export const PROJECTS: Project[] = [
  {
    title: "Ecommerce Product Stack",
    video: asset("./assets/Ecommerce.webm"),
  },
  {
    title: "Flight Assistant UI",
    video: asset("./assets/realEstate.webm"),
  },
];
