import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "linear-gradient(135deg, #123c2c 0%, #1f4d37 55%, #dce8dc 100%)",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 28, letterSpacing: 4, opacity: 0.85 }}>SRI LANKA TOURS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 900 }}>
          Discover Sri Lanka with a local team
        </div>
        <div style={{ fontSize: 26, opacity: 0.85 }}>
          Tailor-made journeys · Direct booking · Local knowledge
        </div>
      </div>
      <div style={{ fontSize: 22, opacity: 0.7 }}>Local journeys, planned directly</div>
    </div>,
    size,
  );
}
