import { C } from "../theme.js";

const W = 448;

/** Линейный график с необязательным вторым рядом в собственном масштабе. */
export default function Line({ points, overlay = [], height = 150 }) {
  if (points.length < 2) {
    return <div style={{ fontSize: 12, color: C.text3, padding: "20px 0" }}>Мало точек для графика</div>;
  }

  const pad = 8;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const x = (i) => pad + (i * (W - pad * 2)) / (points.length - 1);
  const y = (v) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join("");

  let overlayPath = "";
  if (overlay.length > 1) {
    const oys = overlay.map((p) => p.y);
    const omax = Math.max(...oys) || 1;
    const ox = (i) => pad + (i * (W - pad * 2)) / (overlay.length - 1);
    const oy = (v) => pad + (1 - v / omax) * (height - pad * 2);
    overlayPath = overlay.map((p, i) => `${i ? "L" : "M"}${ox(i).toFixed(1)},${oy(p.y).toFixed(1)}`).join("");
  }

  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", height, display: "block" }}>
      {overlayPath && <path d={overlayPath} fill="none" stroke="#22D3EE" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />}
      <path d={path} fill="none" stroke={C.text} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].y)} r="3" fill={C.text} />
    </svg>
  );
}
