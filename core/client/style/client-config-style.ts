import { clientConfig } from "../../../client/config";
import { setClientIconScale } from "../runtime/tag/tags/icon/scale";
import { setClientRoundScale } from "./properties/round";
import { setClientTextScale } from "./properties/text";

setClientIconScale(clientConfig.style?.icon);
setClientTextScale(clientConfig.style?.text);
setClientRoundScale(clientConfig.style?.round);
