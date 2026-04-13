import { BrowserWindow } from "electrobun/bun";


export const mainWindow = new BrowserWindow({
  title: "App",
  titleBarStyle: "default",
  url: process.env.CLIENT_DEV_SERVER_URL || "views://main/index.html"
});
