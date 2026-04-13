import type { DesktopContext } from "../../routes/context";

export type Next<T = unknown> = () => Promise<T>;
export type DesktopMiddleware<T = unknown> = (ctx: DesktopContext, next: Next<T>) => Promise<T>;
