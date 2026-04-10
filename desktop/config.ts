interface clientConfig {
  state: any;
  sessionState: any;
  persistState: any;
}
export const clientConfig: clientConfig = {
  // STATE
  state: {
    id: 20,
    role: "",
  },

  // SESSION STATE
  sessionState: {
    id: 0,
    name: "",
  },

  // PERSIST STATE
  persistState: {
    id: 0,
    email: "",
  },
};
