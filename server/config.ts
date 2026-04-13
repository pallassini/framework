export type LogConfig = {
	enabled: boolean;
	/** `minimal`: solo tag, route, durata · `full`: dimensioni in/out + contributi middleware */
	detail: "minimal" | "full";
};

export interface ServerConfig {
	cors: "same-origin" | "all" | readonly `${"http" | "https"}://${string}`[];
	log: LogConfig;
}

export const serverConfig: ServerConfig = {
	cors: "same-origin",
	log: {
		enabled: true,
		detail: "full",
	},
};
