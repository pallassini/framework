import { clientConfig } from "../../../client/config";
import { setClientIconScale } from "../runtime/tag/tags/icon/scale";
import { ensureBaseResetCss } from "./base-reset";
import { setClientBaseScale } from "./properties/utils/base-spacing";
import { setClientBorderScale } from "./properties/utils/border-scale";
import { setClientCanvasSize } from "./properties/utils/canvas-size";
import { setClientRoundScale } from "./properties/round";
import { setClientTextScale } from "./properties/text";
import { initSmoothScroll } from "./smooth-scroll";

ensureBaseResetCss();
setClientIconScale(clientConfig.style?.icon);
setClientTextScale(clientConfig.style?.text);
setClientBaseScale(clientConfig.style?.base);
setClientBorderScale(clientConfig.style?.border);
setClientCanvasSize(clientConfig.style?.canvas);
setClientRoundScale(clientConfig.style?.round);
initSmoothScroll(clientConfig.style?.smoothScroll);
