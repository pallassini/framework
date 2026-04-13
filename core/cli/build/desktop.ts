import type { ElectrobunBuildEnv } from "./targets";
import { writeDesktopBundledLoad } from "../../desktop/routes/write-bundled-load";

/** Build Electrobun (`electrobun.config.ts`). Richiede `build/web`. */
export async function buildElectrobun(projectRoot: string, env: ElectrobunBuildEnv): Promise<void> {
	writeDesktopBundledLoad(projectRoot);
	const out = env === "dev" ? "dev" : "prod";
	const proc = Bun.spawn({
		cmd: ["bun", "x", "electrobun", "build", `--env=${env}`],
		cwd: projectRoot,
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
		env: {
			...process.env,
			FRAMEWORK_PROJECT_ROOT: projectRoot,
			FRAMEWORK_DESKTOP_OUT: out,
		},
	});
	const code = await proc.exited;
	if (code !== 0) throw new Error(`electrobun build (--env=${env}) terminato con codice ${code ?? "n/d"}`);
}
