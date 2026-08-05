import { C } from "../theme.js";
import { WORKOUT_TYPES } from "../../data/schema.js";
import { fmtDuration, fmtPace, paceSecPerKm } from "../../domain/aggregate.js";

const SOURCE_LABEL = {
  "apple-export": "Apple Health",
  tcx: "TCX",
  shortcut: "Быстрая команда",
  chat: "из чата",
  manual: "вручную",
};

const timeOf = (iso) => String(iso).slice(11, 16);

export default function WorkoutCard({ workout: w, expanded, onToggle, onDelete }) {
  const rows = [
    ["Длительность", fmtDuration(w.durationSec)],
    ["Дистанция", w.distanceKm ? `${w.distanceKm.toFixed(2)} км` : "—"],
    ["Средний темп", w.distanceKm ? `${fmtPace(paceSecPerKm(w))}/км` : "—"],
    ["Активные ккал", w.kcalActive ? Math.round(w.kcalActive) : "—"],
    ["Всего ккал", w.kcalTotal ? Math.round(w.kcalTotal) : "—"],
    ["Средний пульс", w.hrAvg ? `${w.hrAvg} уд/мин` : "—"],
    ["Максимальный пульс", w.hrMax ? `${w.hrMax} уд/мин` : "—"],
    ["Каденс", w.cadenceSpm ? `${w.cadenceSpm} ш/мин` : "—"],
    ["Мощность", w.powerW ? `${w.powerW} Вт` : "—"],
    ["Набор высоты", w.elevationM ? `${Math.round(w.elevationM)} м` : "—"],
    ["Усилие", w.effort ? `${w.effort}/10` : "—"],
    ["Место", w.location || "—"],
    ["Источник", SOURCE_LABEL[w.source] || w.source],
  ];

  return (
    <div style={{ background: C.card, border: "0.5px solid " + C.border, borderRadius: 12, padding: 12, marginBottom: 8 }}>
      <div onClick={onToggle} style={{ cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 14 }}>{WORKOUT_TYPES[w.type].ru}</div>
          <div style={{ fontSize: 11, color: C.text3 }}>{timeOf(w.start)}</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 5, fontSize: 12, color: C.text2 }}>
          <span>{fmtDuration(w.durationSec)}</span>
          {w.distanceKm ? <span>{w.distanceKm.toFixed(2)} км</span> : null}
          {w.distanceKm ? <span>{fmtPace(paceSecPerKm(w))}/км</span> : null}
          {w.hrAvg ? <span>{w.hrAvg} уд/мин</span> : null}
          {w.kcalActive ? <span>{Math.round(w.kcalActive)} ккал</span> : null}
          {w.effort ? <span style={{ color: C.text3 }}>усилие {w.effort}/10</span> : null}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, borderTop: "0.5px solid " + C.border, paddingTop: 10 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
              <span style={{ color: C.text3 }}>{label}</span>
              <span style={{ color: C.text2 }}>{value}</span>
            </div>
          ))}
          {w.note && <div style={{ fontSize: 11, color: C.text3, marginTop: 8 }}>{w.note}</div>}
          <button
            style={{ marginTop: 10, padding: "5px 10px", borderRadius: 8, border: "0.5px solid " + C.border, background: C.bg, color: C.text3, fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}
            onClick={onDelete}
          >
            Удалить
          </button>
        </div>
      )}
    </div>
  );
}
