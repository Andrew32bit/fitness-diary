import { C } from "../theme.js";

const W = 448;

/** Точки «пульс × темп». Цвет от светлого к тёмному показывает движение во времени. */
export default function Scatter({ points, height = 180 }) {
  if (points.length < 3) return <div style={{ fontSize: 12, color: C.text3, padding: "16px 0" }}>Мало пробежек для графика</div>;

  const pad = 26;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const sx = (v) => pad + ((v - xMin) / (xMax - xMin || 1)) * (W - pad * 2);
  const sy = (v) => pad + (1 - (v - yMin) / (yMax - yMin || 1)) * (height - pad * 2);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", height, display: "block" }}>
      <line x1={pad} y1={height - pad} x2={W - pad} y2={height - pad} stroke={C.border} strokeWidth="1" />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke={C.border} strokeWidth="1" />
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="4" fill={C.text} opacity={0.2 + 0.75 * p.t} />
      ))}
      <text x={W - pad} y={height - 8} textAnchor="end" fontSize="9" fill={C.text3}>пульс →</text>
      <text x={4} y={pad - 10} fontSize="9" fill={C.text3}>темп быстрее ↑</text>
    </svg>
  );
}
