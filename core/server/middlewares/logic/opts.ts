export type RateLimitOpts = { window: number; max: number };

export type ConcurrencySameClientOpts = { max: number; buffer?: number };

export type ConcurrencyOpts = {
	max: number;
	buffer?: number;
	sameClient?: ConcurrencySameClientOpts;
};

export type SizeLimitOpts = { in?: number; out?: number };
