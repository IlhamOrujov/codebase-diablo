import { ImageResponse } from "next/og";
import { BURGUNDY, CREAM, MarkSvg } from "@/lib/brand-image";
import { SHARE_IMAGE, SITE } from "@/lib/site";

export const alt = SHARE_IMAGE.alt;
export const size = { width: SHARE_IMAGE.width, height: SHARE_IMAGE.height };
export const contentType = SHARE_IMAGE.type;

/** The share card for every page: the mark and the line, cream on burgundy. Rendered once, at build time. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "76px 96px 76px 88px",
          background: BURGUNDY,
          color: CREAM,
        }}
      >
        <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 36, letterSpacing: "-0.01em" }}>{SITE.company}</div>
          <div style={{ display: "flex", maxWidth: 660, fontSize: 112, lineHeight: 1, letterSpacing: "-0.045em" }}>
            {SITE.tagline}
          </div>
          <div style={{ display: "flex", fontSize: 28, opacity: 0.72 }}>diablo.pnoia.dev</div>
        </div>
        <MarkSvg height={420} />
      </div>
    ),
    size,
  );
}
