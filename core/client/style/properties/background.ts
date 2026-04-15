import type { Properties } from "csstype";
import { buildLinearGradientFromSpec, buildRadialGradientFromStops } from "./radial-gradient-stops";
import { resolveColorToken } from "./utils/color";

function gradientLayerProps(image: string): Properties {
	return {
		backgroundColor: "transparent",
		backgroundImage: image,
		backgroundRepeat: "no-repeat",
		backgroundPosition: "center",
		backgroundSize: "100% 100%",
	};
}

export function backgroundColor(suffix: string): Properties | undefined {
	if (!suffix) return undefined;
	if (/^gradient\s*\(/i.test(suffix)) {
		const inner = suffix.replace(/^gradient\s*/i, "").trim();
		const linear = buildLinearGradientFromSpec(inner);
		if (linear) return gradientLayerProps(linear);
		const radial = buildRadialGradientFromStops(inner);
		return radial ? gradientLayerProps(radial) : undefined;
	}
	const c = resolveColorToken(suffix);
	return c ? { backgroundColor: c } : undefined;
}
