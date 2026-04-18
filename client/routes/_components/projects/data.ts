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
        image: asset("./assets/ecommerceProduct/index.webp"),
        description: "Home e hero orientato alla conversione.",
      },
      {
        image: asset("./assets/ecommerceProduct/duration.webp"),
        description: "Catalogo e scoperta prodotti.",
      },
      {
        image: asset("./assets/ecommerceProduct/details.webp"),
        description: "Scheda prodotto con dettagli e varianti.",
      },
      {
        image: asset("./assets/ecommerceProduct/crossSell.webp"),
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
