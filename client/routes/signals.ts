import { sessionState, type DesktopRouteOut, type ServerRouteOut } from "client";

export const desktop = sessionState<DesktopRouteOut<"ping">>();
export const server = sessionState<ServerRouteOut<"ping.brooo">>();
