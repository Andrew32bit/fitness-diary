import { C } from "../theme.js";
import { fmtD, fmtW, shiftDate, today } from "../format.js";

export default function DateNav({ date, onChange }) {
  const btn = {
    width: 32, height: 32, borderRadius: 10, border: "0.5px solid " + C.border,
    background: C.bg, color: C.text2, fontSize: 15, cursor: "pointer", fontFamily: "inherit",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
      <button style={btn} onClick={() => onChange(shiftDate(date, -1))}>‹</button>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 500 }}>{fmtD(date)}</div>
        <div style={{ fontSize: 11, color: C.text3 }}>{fmtW(date)}</div>
      </div>
      <button
        style={{ ...btn, opacity: date >= today() ? 0.35 : 1 }}
        disabled={date >= today()}
        onClick={() => onChange(shiftDate(date, 1))}
      >
        ›
      </button>
    </div>
  );
}
