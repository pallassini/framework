/** Slide: immagine + testo (per didascalie, alt, didascalie UI). */
export type ProjectSlide = {
  /** Percorso risolto con Vite; il caricamento “solo quando serve” lo gestiamo nel componente (es. `loading`, slide attiva). */
  image: string;
  description: string;
};

export type Project = {
  title: string;
  slides: ProjectSlide[];
};

const asset = (relativePath: string): string => new URL(relativePath, import.meta.url).href;

export const PROJECTS: Project[] = [
  {
    title: "Ecommerce Product Stack",
    slides: [
      {
        image: asset("./assets/ecommerceProduct/07d5fb87-8b68-460c-80de-4cb45ba108ef.png"),
        description: "Home e hero orientato alla conversione.",
      },
      {
        image: asset("./assets/ecommerceProduct/7a6ddb39-820e-4b2d-a65c-8be359075389.png"),
        description: "Catalogo e scoperta prodotti.",
      },
      {
        image: asset("./assets/ecommerceProduct/a3bedbdf-b173-401c-8733-6f03c4faf974.png"),
        description: "Scheda prodotto con dettagli e varianti.",
      },
      {
        image: asset("./assets/ecommerceProduct/cc9ca094-15de-428e-b7a5-da23bb18b6ef.png"),
        description: "Checkout e riepilogo ordine.",
      },
    ],
  },
  {
    title: "Flight Assistant UI",
    slides: [
      {
        image: asset("./assets/plane/generation-0b0d391a-3094-4628-a1d1-356cd5d255e0.png"),
        description: "Ricerca voli e filtri rapidi.",
      },
      {
        image: asset("./assets/plane/generation-3284e71d-d7ef-483b-83c1-24f79814aa64.png"),
        description: "Risultati e confronto prezzi.",
      },
    ],
  },
];
