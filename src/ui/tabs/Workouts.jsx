import { useState } from "react";
import { C } from "../theme.js";
import { MONTH_LABELS } from "../format.js";
import { WORKOUT_TYPES } from "../../data/schema.js";
import WorkoutCard from "../components/WorkoutCard.jsx";
import WorkoutForm from "../components/WorkoutForm.jsx";

function monthTitle(month) {
  const [year, m] = month.split("-");
  return `${MONTH_LABELS[Number(m) - 1]} ${year}`;
}

export default function Workouts({ store }) {
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [adding, setAdding] = useState(false);

  const visible = filter === "all" ? store.workouts : store.workouts.filter((w) => w.type === filter);
  const presentTypes = [...new Set(store.workouts.map((w) => w.type))];

  const groups = new Map();
  for (const w of visible) {
    const month = w.date.slice(0, 7);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(w);
  }

  const chip = (active) => ({
    padding: "6px 11px", borderRadius: 999, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
    border: "0.5px solid " + (active ? C.text : C.border),
    background: active ? C.text : C.bg, color: active ? C.bg : C.text2, whiteSpace: "nowrap",
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, marginBottom: 12 }}>
        <button style={chip(filter === "all")} onClick={() => setFilter("all")}>Все</button>
        {presentTypes.map((t) => (
          <button key={t} style={chip(filter === t)} onClick={() => setFilter(t)}>{WORKOUT_TYPES[t].ru}</button>
        ))}
      </div>

      {adding
        ? <WorkoutForm onCancel={() => setAdding(false)} onSave={async (raw) => { await store.actions.saveWorkout(raw); setAdding(false); }} />
        : (
          <button
            style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "0.5px dashed " + C.border, background: C.bg, color: C.text2, fontSize: 13, fontFamily: "inherit", cursor: "pointer", marginBottom: 14 }}
            onClick={() => setAdding(true)}
          >
            + Добавить тренировку
          </button>
        )}

      {groups.size === 0 && <div style={{ fontSize: 13, color: C.text3 }}>Тренировок нет. Импортируй файл в настройках.</div>}

      {[...groups.entries()].map(([month, list]) => {
        const km = list.reduce((sum, w) => sum + (w.distanceKm || 0), 0);
        return (
          <div key={month} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{monthTitle(month)}</div>
              <div style={{ fontSize: 11, color: C.text3 }}>
                {km > 0 ? `${km.toFixed(1)} км · ` : ""}{list.length} шт
              </div>
            </div>
            {list.map((w) => (
              <WorkoutCard
                key={w.id}
                workout={w}
                expanded={expanded === w.id}
                onToggle={() => setExpanded(expanded === w.id ? null : w.id)}
                onDelete={() => store.actions.deleteWorkout(w.id)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
