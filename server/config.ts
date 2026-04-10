export interface ServerConfig {
  cors: "same-origin" | "all" | readonly `${"http" | "https"}://${string}`[];
}

export const serverConfig: ServerConfig = {
  cors: "same-origin",
};
