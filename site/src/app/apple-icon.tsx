import { ImageResponse } from "next/og";
import { BURGUNDY, MarkSvg } from "@/lib/brand-image";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The home-screen icon: full bleed, because the system rounds the corners itself (transparent corners turn black). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BURGUNDY }}>
        <div style={{ display: "flex", marginTop: 6 }}>
          <MarkSvg height={124} />
        </div>
      </div>
    ),
    size,
  );
}
