import { v } from "../core/client/validator";

export const clientConfig = {
  // STATE
  state: {
    id: v.uuid(),
  },

  // SESSION STATE
  sessionState: {
    id: v.uuid(),
  },

  // PERSIST STATE
  persistState: {
    id: v.uuid(),
    devtools: {
      menu: "db" as "db" | "state",
    },
  },

  // STYLE
  style: {
    /** Stile tipo Lenis (Halo Lab): lerp unico, niente “strisciamento” solo in coda. */
    smoothScroll: true,
    /** Scala ~lineare: 1–7 body/titoli; 8–10 display. `des` più alto e max proporzionati; niente salti enormi verso 8. */
    text: {
      "1": {
        mob: "clamp(0.8125rem, 0.76rem + 0.26vw, 0.9375rem)",
        tab: "clamp(0.875rem, 0.8rem + 0.3vw, 1rem)",
        des: "clamp(1rem, 0.92rem + 0.26vw, 1.125rem)",
      },
      "2": {
        mob: "clamp(0.875rem, 0.81rem + 0.28vw, 1rem)",
        tab: "clamp(0.9375rem, 0.86rem + 0.32vw, 1.0625rem)",
        des: "clamp(1.0625rem, 0.98rem + 0.28vw, 1.1875rem)",
      },
      "3": {
        mob: "clamp(0.9375rem, 0.85rem + 0.3vw, 1.0625rem)",
        tab: "clamp(1rem, 0.92rem + 0.34vw, 1.125rem)",
        des: "clamp(1.125rem, 1.04rem + 0.3vw, 1.25rem)",
      },
      "4": {
        mob: "clamp(1rem, 0.9rem + 0.32vw, 1.125rem)",
        tab: "clamp(1.0625rem, 0.96rem + 0.36vw, 1.1875rem)",
        des: "clamp(1.1875rem, 1.08rem + 0.32vw, 1.3125rem)",
      },
      "5": {
        mob: "clamp(1.0625rem, 0.94rem + 0.35vw, 1.1875rem)",
        tab: "clamp(1.125rem, 1.01rem + 0.38vw, 1.25rem)",
        des: "clamp(1.25rem, 1.13rem + 0.34vw, 1.375rem)",
      },
      "6": {
        mob: "clamp(1.125rem, 0.99rem + 0.38vw, 1.25rem)",
        tab: "clamp(1.1875rem, 1.05rem + 0.42vw, 1.3125rem)",
        des: "clamp(1.3125rem, 1.18rem + 0.36vw, 1.4375rem)",
      },
      "7": {
        mob: "clamp(1.1875rem, 1.04rem + 0.42vw, 1.3125rem)",
        tab: "clamp(1.25rem, 1.1rem + 0.46vw, 1.375rem)",
        des: "clamp(1.375rem, 1.22rem + 0.4vw, 1.5rem)",
      },
      "8": {
        mob: "clamp(1.3125rem, 1.1rem + 0.52vw, 1.5rem)",
        tab: "clamp(1.5rem, 1.24rem + 0.52vw, 1.75rem)",
        des: "clamp(2rem, 1.52rem + 0.65vw, 2.625rem)",
      },
      "9": {
        mob: "clamp(1.5rem, 1.2rem + 0.62vw, 1.75rem)",
        tab: "clamp(1.75rem, 1.38rem + 0.62vw, 2.125rem)",
        des: "clamp(2.5rem, 1.88rem + 0.78vw, 3.25rem)",
      },
      "10": {
        mob: "clamp(1.75rem, 1.32rem + 0.72vw, 2.125rem)",
        tab: "clamp(2.125rem, 1.58rem + 0.72vw, 2.75rem)",
        des: "clamp(3rem, 2.15rem + 0.95vw, 4rem)",
      },
    },
    /** ~1.08× il testo allo stesso step su `des`; mob/tab più generosi (icone leggibili). */
    icon: {
      "1": {
        mob: "clamp(1.0625rem, 0.95rem + 0.44vw, 1.3125rem)",
        tab: "clamp(1.0625rem, 0.95rem + 0.42vw, 1.25rem)",
        des: "clamp(1.125rem, 1.02rem + 0.34vw, 1.375rem)",
      },
      "2": {
        mob: "clamp(1.1813rem, 1.0555rem + 0.46vw, 1.4313rem)",
        tab: "clamp(1.125rem, 1.01rem + 0.44vw, 1.3125rem)",
        des: "clamp(1.25rem, 1.12rem + 0.36vw, 1.5rem)",
      },
      "3": {
        mob: "clamp(1.2986rem, 1.1611rem + 0.5vw, 1.5486rem)",
        tab: "clamp(1.1875rem, 1.06rem + 0.48vw, 1.375rem)",
        des: "clamp(1.375rem, 1.22rem + 0.4vw, 1.625rem)",
      },
      "4": {
        mob: "clamp(1.4167rem, 1.2667rem + 0.55vw, 1.6667rem)",
        tab: "clamp(1.25rem, 1.1rem + 0.52vw, 1.5rem)",
        des: "clamp(1.5rem, 1.32rem + 0.44vw, 1.75rem)",
      },
      "5": {
        mob: "clamp(1.5347rem, 1.3722rem + 0.6vw, 1.8472rem)",
        tab: "clamp(1.375rem, 1.18rem + 0.56vw, 1.625rem)",
        des: "clamp(1.75rem, 1.48rem + 0.48vw, 2rem)",
      },
      "6": {
        mob: "clamp(1.7153rem, 1.5178rem + 0.66vw, 2.0278rem)",
        tab: "clamp(1.5rem, 1.26rem + 0.6vw, 1.75rem)",
        des: "clamp(2rem, 1.65rem + 0.52vw, 2.25rem)",
      },
      "7": {
        mob: "clamp(1.8958rem, 1.6533rem + 0.74vw, 2.2083rem)",
        tab: "clamp(1.625rem, 1.34rem + 0.68vw, 1.875rem)",
        des: "clamp(2.25rem, 1.82rem + 0.56vw, 2.625rem)",
      },
      "8": {
        mob: "clamp(2.0764rem, 1.7889rem + 0.82vw, 2.3889rem)",
        tab: "clamp(1.75rem, 1.42rem + 0.72vw, 2rem)",
        des: "clamp(2.75rem, 2.08rem + 0.7vw, 3.25rem)",
      },
      "9": {
        mob: "clamp(2.2569rem, 1.9244rem + 0.9vw, 2.5694rem)",
        tab: "clamp(2rem, 1.52rem + 0.78vw, 2.375rem)",
        des: "clamp(3.25rem, 2.45rem + 0.82vw, 3.75rem)",
      },
      "10": {
        mob: "clamp(2.4375rem, 2.08rem + 0.98vw, 2.875rem)",
        tab: "clamp(2.25rem, 1.65rem + 0.85vw, 2.875rem)",
        des: "clamp(3.75rem, 2.85rem + 0.95vw, 4.5rem)",
      },
    },
    round: {
      "1": {
        mob: "0.1875rem",
        tab: "0.1875rem",
        des: "0.1875rem",
      },
      "2": {
        mob: "0.3125rem",
        tab: "0.3125rem",
        des: "0.3125rem",
      },
      "3": {
        mob: "0.4375rem",
        tab: "0.4375rem",
        des: "0.4375rem",
      },
      "4": {
        mob: "0.5625rem",
        tab: "0.5625rem",
        des: "0.5625rem",
      },
      "5": {
        mob: "0.75rem",
        tab: "0.75rem",
        des: "0.75rem",
      },
      circle: {
        mob: "50%",
        tab: "50%",
        des: "50%",
      },
    },
  },
};
