import { useState } from "react";
import { C } from "../theme.js";
import { today } from "../format.js";
import { WORKOUT_TYPES } from "../../data/schema.js";

const EMPTY = {
  type: "running", date: today(), time: "12:00", minutes: "", distanceKm: "",
  kcalActive: "", hrAvg: "", cadenceSpm: "", powerW: "", elevationM: "", effort: "", location: "", note: "",
};

export default function WorkoutForm({ onSave, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const field = {
    padding: "9px 10px", borderRadius: 10, border: "0.5px solid " + C.border,
    background: C.bg, color: C.text, fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box",
  };
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div style={{ background: C.card, border: "0.5px solid " + C.border, borderRadius: 14, padding: 12, marginBottom: 12 }}>
      <select style={{ ...field, marginBottom: 8 }} value={form.type} onChange={set("type")}>
        {Object.entries(WORKOUT_TYPES).map(([key, { ru }]) => <option key={key} value={key}>{ru}</option>)}
      </select>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
        <input style={field} type="date" value={form.date} max={today()} onChange={set("date")} />
        <input style={field} type="time" value={form.time} onChange={set("time")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 6, marginBottom: 8 }}>
        {[["minutes", "Минуты"], ["distanceKm", "Км"], ["kcalActive", "Ккал"],
          ["hrAvg", "Пульс"], ["cadenceSpm", "Каденс"], ["powerW", "Вт"],
          ["elevationM", "Высота, м"], ["effort", "Усилие 1-10"]].map(([key, label]) => (
          <input key={key} style={field} type="number" inputMode="decimal" placeholder={label}
                 value={form[key]} onChange={set(key)} />
        ))}
      </div>

      <input style={{ ...field, marginBottom: 8 }} placeholder="Место" value={form.location} onChange={set("location")} />
      <input style={{ ...field, marginBottom: 10 }} placeholder="Заметка" value={form.note} onChange={set("note")} />

      <div style={{ display: "flex", gap: 8 }}>
        <button
          style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: C.text, color: C.bg, fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}
          disabled={!(Number(form.minutes) > 0)}
          onClick={() => {
            onSave({
              type: form.type,
              start: `${form.date}T${form.time}:00`,
              durationSec: Math.round(Number(form.minutes) * 60),
              distanceKm: form.distanceKm, kcalActive: form.kcalActive, hrAvg: form.hrAvg,
              cadenceSpm: form.cadenceSpm, powerW: form.powerW, elevationM: form.elevationM,
              effort: form.effort, location: form.location, note: form.note,
              source: "manual",
            });
            setForm(EMPTY);
          }}
        >
          Сохранить
        </button>
        <button
          style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "0.5px solid " + C.border, background: C.bg, color: C.text2, fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}
          onClick={onCancel}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
