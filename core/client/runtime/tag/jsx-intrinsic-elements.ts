/**
 * Elenco dei tag framework in JSX. TypeScript non può inferirlo dal barrel `tag/index.ts`
 * senza script di codegen: quando aggiungi un tag, aggiungi qui una riga e l’export nel barrel.
 */
import type { SharedProps } from "./props";
import type { DivProps } from "./tags/div";
import type { TProps } from "./tags/t";
import type { ShowProps } from "./tags/show";
import type { SwitchProps } from "./tags/switch";
import type { CaseProps } from "./tags/switch/case";
import type { ImgProps } from "./tags/img";
import type { VideoProps } from "./tags/video";
import type { InputProps } from "./tags/input";
import type { IconProps } from "./tags/icon";

export interface FrameworkIntrinsicElements {
	div: DivProps;
	t: TProps;
	table: SharedProps;
	thead: SharedProps;
	tbody: SharedProps;
	tr: SharedProps;
	th: SharedProps;
	td: SharedProps;
	/** Sottolineato HTML nativo (`createElement("u")`). */
	u: SharedProps;
	show: ShowProps;
	switch: SwitchProps;
	case: CaseProps;
	icon: IconProps;
	img: ImgProps;
	video: VideoProps;
	input: InputProps;
}
