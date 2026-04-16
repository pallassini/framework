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
    text: {
      "1": {
        mob: "clamp(0.75rem, 0.71rem + 0.2vw, 0.8125rem)",
        tab: "clamp(0.8125rem, 0.76rem + 0.25vw, 0.875rem)",
        des: "clamp(0.875rem, 0.83rem + 0.22vw, 0.9375rem)",
      },
      "2": {
        mob: "clamp(0.8125rem, 0.77rem + 0.25vw, 0.875rem)",
        tab: "clamp(0.875rem, 0.81rem + 0.28vw, 0.9375rem)",
        des: "clamp(0.9375rem, 0.88rem + 0.24vw, 1rem)",
      },
      "3": {
        mob: "clamp(0.875rem, 0.82rem + 0.3vw, 0.9375rem)",
        tab: "clamp(0.9375rem, 0.87rem + 0.32vw, 1rem)",
        des: "clamp(1rem, 0.93rem + 0.26vw, 1.0625rem)",
      },
      "4": {
        mob: "clamp(0.9375rem, 0.87rem + 0.35vw, 1rem)",
        tab: "clamp(1rem, 0.92rem + 0.35vw, 1.0625rem)",
        des: "clamp(1.0625rem, 0.98rem + 0.28vw, 1.125rem)",
      },
      "5": {
        mob: "clamp(1rem, 0.92rem + 0.4vw, 1.0625rem)",
        tab: "clamp(1.0625rem, 0.96rem + 0.38vw, 1.125rem)",
        des: "clamp(1.125rem, 1.03rem + 0.3vw, 1.1875rem)",
      },
      "6": {
        mob: "clamp(1.0625rem, 0.97rem + 0.45vw, 1.125rem)",
        tab: "clamp(1.125rem, 1.01rem + 0.42vw, 1.1875rem)",
        des: "clamp(1.1875rem, 1.08rem + 0.32vw, 1.25rem)",
      },
      "7": {
        mob: "clamp(1.125rem, 1.02rem + 0.5vw, 1.1875rem)",
        tab: "clamp(1.1875rem, 1.06rem + 0.48vw, 1.25rem)",
        des: "clamp(1.25rem, 1.12rem + 0.36vw, 1.375rem)",
      },
      "8": {
        mob: "clamp(1.1875rem, 1.06rem + 0.6vw, 1.25rem)",
        tab: "clamp(1.25rem, 1.1rem + 0.54vw, 1.375rem)",
        des: "clamp(2.75rem, 2rem + 0.82vw, 3.25rem)",
      },
      "9": {
        mob: "clamp(1.25rem, 1.1rem + 0.72vw, 1.375rem)",
        tab: "clamp(1.375rem, 1.17rem + 0.62vw, 1.5rem)",
        des: "clamp(3rem, 2.15rem + 0.9vw, 3.5rem)",
      },
      "10": {
        mob: "clamp(1.375rem, 1.2rem + 0.85vw, 1.5rem)",
        tab: "clamp(1.5rem, 1.24rem + 0.75vw, 1.75rem)",
        des: "clamp(3.25rem, 2.35rem + 1vw, 4rem)",
      },
    },
    icon: {
      "1": {
        mob: "clamp(0.875rem, 0.81rem + 0.3vw, 1rem)",
        tab: "clamp(1rem, 0.91rem + 0.35vw, 1.125rem)",
        des: "clamp(1.125rem, 1rem + 0.28vw, 1.25rem)",
      },
      "2": {
        mob: "clamp(1rem, 0.92rem + 0.35vw, 1.125rem)",
        tab: "clamp(1.125rem, 1.01rem + 0.4vw, 1.25rem)",
        des: "clamp(1.25rem, 1.1rem + 0.32vw, 1.375rem)",
      },
      "3": {
        mob: "clamp(1.125rem, 1.01rem + 0.42vw, 1.25rem)",
        tab: "clamp(1.25rem, 1.1rem + 0.5vw, 1.5rem)",
        des: "clamp(1.5rem, 1.3rem + 0.38vw, 1.75rem)",
      },
      "4": {
        mob: "clamp(1.25rem, 1.1rem + 0.55vw, 1.5rem)",
        tab: "clamp(1.5rem, 1.24rem + 0.65vw, 1.75rem)",
        des: "clamp(1.75rem, 1.45rem + 0.5vw, 2rem)",
      },
      "5": {
        mob: "clamp(1.5rem, 1.28rem + 0.78vw, 1.75rem)",
        tab: "clamp(1.75rem, 1.45rem + 0.8vw, 2rem)",
        des: "clamp(2rem, 1.62rem + 0.65vw, 2.5rem)",
      },
      "6": {
        mob: "clamp(1.625rem, 1.35rem + 0.85vw, 1.875rem)",
        tab: "clamp(1.875rem, 1.52rem + 0.85vw, 2.125rem)",
        des: "clamp(2.25rem, 1.75rem + 0.7vw, 2.75rem)",
      },
      "7": {
        mob: "clamp(1.75rem, 1.42rem + 0.95vw, 2rem)",
        tab: "clamp(2rem, 1.58rem + 0.9vw, 2.375rem)",
        des: "clamp(2.5rem, 1.88rem + 0.75vw, 3rem)",
      },
      "8": {
        mob: "clamp(1.875rem, 1.48rem + 1.05vw, 2.125rem)",
        tab: "clamp(2.125rem, 1.65rem + 1vw, 2.625rem)",
        des: "clamp(2.75rem, 2rem + 0.82vw, 3.25rem)",
      },
      "9": {
        mob: "clamp(2rem, 1.55rem + 1.15vw, 2.25rem)",
        tab: "clamp(2.25rem, 1.72rem + 1.1vw, 2.875rem)",
        des: "clamp(3rem, 2.15rem + 0.9vw, 3.5rem)",
      },
      "10": {
        mob: "clamp(2.125rem, 1.62rem + 1.25vw, 2.5rem)",
        tab: "clamp(2.5rem, 1.82rem + 1.2vw, 3.25rem)",
        des: "clamp(3.25rem, 2.35rem + 1vw, 4rem)",
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
