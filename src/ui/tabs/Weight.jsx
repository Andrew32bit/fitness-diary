import { useState } from "react";
import { C } from "../theme.js";
import { today, fmtD } from "../format.js";
import Line from "../components/Line.jsx";
import { weeklyVolume, isoWeek } from "../../domain/aggregate.js";

export default function Weight({ store }) {
  const [value, setValue] = useState("");
  const [date, setDate] = useState(today());
  const { weights, settings } = store;

  const last = weights[weights.length - 1];
  const first = weights[0];
  const delta = last && first ? last.kg - settings.startKg : null;
  const toGoal = last ? last.kg - settings.goalKg : null;

  // Недельный объём бега приводится к тем же неделям, что и точки веса.
  const volumeByWeek = new Map(weeklyVolume(store.workouts, "running").map((w) => [w.week, w.km]));
  const overlay = weights.map((w) => ({ x: w.date, y: volumeByWeek.get(isoWeek(w.date)) || 0 }));

  const card = { background: C.card, border: "0.5px solid " + C.border, borderRadius: 14, padding: 14 };
  const field = {
    padding: "9px 10px", borderRadius: 10, border: "0.5px solid " + C.border,
    background: C.bg, color: C.text, fontSize: 13, fontFamily: "inherit", flex: 1, boxSizing: "border-box",
  };

  return (
    <div>
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 500 }}>{last ? last.kg.toFixed(1) : "—"}</div>
            <div style={{ fontSize: 11, color: C.text3 }}>{last ? fmtD(last.date) : "нет замеров"}</div>
          </div>
          {delta !== null && (
            <div style={{ textAlign: "right", fontSize: 12, color: C.text2 }}>
              <div>{delta > 0 ? "+" : ""}{delta.toFixed(1)} кг от старта</div>
              <div style={{ color: C.text3 }}>до цели {toGoal.toFixed(1)} кг</div>
            </div>
          )}
        </div>
        <Line points={weights.map((w) => ({ x: w.date, y: w.kg }))} overlay={overlay} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.text3 }}>
          <span>{first ? fmtD(first.date) : ""}</span>
          <span style={{ color: "#22D3EE" }}>пунктир — объём бега за неделю</span>
          <span>{last ? fmtD(last.date) : ""}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={card}>
          <div style={{ fontSize: 11, color: C.text3 }}>Старт</div>
          <div style={{ fontSize: 18 }}>{settings.startKg.toFixed(1)}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, color: C.text3 }}>Цель</div>
          <div style={{ fontSize: 18 }}>{settings.goalKg.toFixed(1)}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input style={field} type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        <input style={field} type="number" inputMode="decimal" step="0.1" placeholder="кг"
               value={value} onChange={(e) => setValue(e.target.value)} />
        <button
          style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: C.text, color: C.bg, fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}
          disabled={!value}
          onClick={async () => { await store.actions.saveWeight(date, value); setValue(""); }}
        >
          Записать
        </button>
      </div>

      {[...weights].reverse().slice(0, 30).map((w) => (
        <div key={w.date} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "0.5px solid " + C.border, fontSize: 13 }}>
          <span style={{ color: C.text2 }}>{fmtD(w.date)}</span>
          <span>{w.kg.toFixed(1)} кг</span>
        </div>
      ))}
    </div>
  );
}
