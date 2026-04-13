import type { ServerContext } from "../../routes/context";

export type Next<T = unknown> = () => Promise<T>;
export type Middleware<T = unknown> = (ctx: ServerContext, next: Next<T>) => Promise<T>;
