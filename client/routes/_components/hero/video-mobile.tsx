import { mob } from "client";
import type { MediaBlendLevel } from "../../../../core/client/runtime/tag/tags/media/blend";
import type { VideoEdgeFadeOptions } from "../../../../core/client/runtime/tag/tags/media/video-edge-fade";
import type { VideoProps } from "../../../../core/client/runtime/tag/tags/video";

export type VideoMobileProps = Omit<VideoProps, "blend" | "edgeFade"> & {
	/**
	 * Blend su `mob` (default `"natural"` = screen senza contrasto CSS).
	 */
	mobileBlend?: MediaBlendLevel;
	/** Blend su tab/desktop (default `"natural"`). */
	desktopBlend?: MediaBlendLevel;
	/**
	 * Maschera bordi solo su mobile. Default `false`: la maschera forte oscurava quasi tutto il frame.
	 * Passa `true` (holding) o un oggetto se serve dissolvenza ai bordi.
	 */
	mobileEdgeFade?: boolean | VideoEdgeFadeOptions;
};

/**
 * Video con nero che si fonde nello sfondo (`natural` = screen, senza filter).
 * Default: `object-fit: contain` così il fotogramma resta intero in orizzontale (niente crop come `cover`).
 * Dissolvenza bordi su mobile disattiva di default per evitare “oscurità” sul frame.
 */
export default function VideoMobile(props: VideoMobileProps) {
	const {
		mobileBlend = "natural",
		desktopBlend = "natural",
		mobileEdgeFade = false,
		objectFit = "contain",
		...videoProps
	} = props;

	const edgeFade =
		mobileEdgeFade === false
			? () => false
			: () => {
					if (!mob()) return false;
					if (mobileEdgeFade === true) return true;
					return mobileEdgeFade;
				};

	return (
		<video
			{...videoProps}
			objectFit={objectFit}
			blend={() => (mob() ? mobileBlend : desktopBlend)}
			edgeFade={edgeFade}
		/>
	);
}
