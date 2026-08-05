import { C } from "../theme.js";

const W = 448;

/** Столбцы с необязательной линией скользящего среднего в том же масштабе. */
export default function Bars({ items, valueOf, labelOf, line = null, height = 130 }) {
  if (!items.length) return <div style={{ fontSize: 12, color: C.text3, padding: "16px 0" }}>Нет данных</div>;

  const values = items.map(valueOf);
  const max = Math.max(...values, ...(line || []).filter((v) => v !== null)) || 1;
  const slot = W / items.length;
  const barW = Math.min(slot * 0.6, 34);
  const scale = (v) => (v / max) * (height - 18);

  const linePath = line
    ? line
        .map((v, i) => (v === null ? null : `${slot * i + slot / 2},${height - 18 - scale(v)}`))
        .filter(Boolean)
        .map((p, i) => `${i ? "L" : "M"}${p}`)
        .join("")
    : "";

  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", height, display: "block" }}>
      {items.map((item, i) => {
        const h = scale(valueOf(item));
        return (
          <g key={i}>
            <rect x={slot * i + (slot - barW) / 2} y={height - 18 - h} width={barW} height={Math.max(h, 1)} rx="3" fill={C.text} opacity="0.85" />
            <text x={slot * i + slot / 2} y={height - 5} textAnchor="middle" fontSize="9" fill={C.text3}>
              {labelOf(item)}
            </text>
          </g>
        );
      })}
      {linePath && <path d={linePath} fill="none" stroke="#22D3EE" strokeWidth="1.6" strokeLinejoin="round" />}
    </svg>
  );
}
