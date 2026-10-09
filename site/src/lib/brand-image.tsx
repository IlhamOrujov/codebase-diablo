import { MARK_PATHS, MARK_VIEWBOX } from "@/lib/mark-paths";

/** Brand colours for generated images (share cards, the home-screen icon), where CSS variables do not exist. */
export const BURGUNDY = "#57001A";
export const CREAM = "#FCF8EF";

const [, , VW, VH] = MARK_VIEWBOX.split(" ").map(Number);

/** The mark as plain SVG, for next/og. The eyes are cut out of the head with the even-odd rule. */
export function MarkSvg({ height, color = CREAM }: { height: number; color?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} width={(height * VW) / VH} height={height}>
      <path fill={color} fillRule="evenodd" d={`${MARK_PATHS.head} ${MARK_PATHS.eyeL} ${MARK_PATHS.eyeR}`} />
      <path fill={color} d={MARK_PATHS.crescent} />
    </svg>
  );
}
