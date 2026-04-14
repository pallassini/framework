import { clientConfig } from "../../../client/config";
import { setClientIconScale } from "../runtime/tag/tags/icon/scale";
import { setClientTextScale } from "./properties/text";

setClientIconScale(clientConfig.style?.icon);
setClientTextScale(clientConfig.style?.text);
