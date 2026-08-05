import { useState } from "react";
import { C, MACRO_COLORS } from "../theme.js";
import { today } from "../format.js";
import Ring from "../components/Ring.jsx";
import DateNav from "../components/DateNav.jsx";
import MealForm from "../components/MealForm.jsx";
import { dayTotals, burned } from "../../domain/nutrition.js";
import { fmtDuration, fmtPace, paceSecPerKm } from "../../domain/aggregate.js";
import { WORKOUT_TYPES } from "../../data/schema.js";

const SYMPTOMS = ["Голод", "Головокружение", "Раздражительность", "Усталость", "Всё ок"];
const EMPTY_DAY = { meals: [], symptoms: [], water: 0, note: "" };

export default function Diary({ store }) {
  const [date, setDate] = useState(today());
  const [adding, setAdding] = useState(false);

  const day = store.days.find((d) => d.date === date) || { ...EMPTY_DAY, date };
  const dayWorkouts = store.workouts.filter((w) => w.date === date);
  const totals = dayTotals(day);
  const burn = burned(dayWorkouts);
  const limit = store.settings.kcalLimit;

  const save = (patch) => store.actions.saveDay({ ...day, ...patch });

  const chip = (active) => ({
    padding: "6px 11px", borderRadius: 999, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
    border: "0.5px solid " + (active ? C.text : C.border),
    background: active ? C.text : C.bg, color: active ? C.bg : C.text2,
  });

  return (
    <div>
      <DateNav date={date} onChange={setDate} />

      <div style={{ background: C.card, border: "0.5px solid " + C.border, borderRadius: 16, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: burn > 0 ? 14 : 0 }}>
          <Ring value={totals.kcal} max={limit} size={92} stroke={9} color={totals.kcal > limit ? "#EF4444" : C.text}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 19, fontWeight: 500 }}>{Math.round(totals.kcal)}</div>
              <div style={{ fontSize: 10, color: C.text3 }}>из {limit}</div>
            </div>
          </Ring>
          <div style={{ flex: 1 }}>
            {[["Белок", totals.protein, store.settings.proteinGoal, MACRO_COLORS.protein],
              ["Жиры", totals.fat, store.settings.fatGoal, MACRO_COLORS.fat],
              ["Углеводы", totals.carbs, store.settings.carbsGoal, MACRO_COLORS.carbs]].map(([label, value, goal, color]) => (
              <div key={label} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.text2, marginBottom: 3 }}>
                  <span>{label}</span><span>{Math.round(value)} / {goal}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: C.border, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min((value / goal) * 100, 100)}%`, height: "100%", background: color, transition: "width 0.4s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {burn > 0 && (
          <div style={{ display: "flex", gap: 8, borderTop: "0.5px solid " + C.border, paddingTop: 12, fontSize: 12, color: C.text2 }}>
            <span>Расход {Math.round(burn)} ккал</span>
            <span style={{ color: C.text3 }}>·</span>
            <span>Баланс {Math.round(totals.kcal - burn)} ккал</span>
          </div>
        )}
      </div>

      {/* key строго по id: у приёмов пищи он выдаётся при записи в базу.
          Подстановка названия давала повторяющиеся ключи и рассыпающийся список. */}
      {day.meals.map((meal) => (
        <div key={meal.id} style={{ background: C.card, border: "0.5px solid " + C.border, borderRadius: 12, padding: 12, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 14 }}>{meal.name}</div>
            <div style={{ fontSize: 14, color: C.text2, whiteSpace: "nowrap" }}>{Math.round(meal.kcal || 0)} ккал</div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 11, color: C.text3 }}>
            {meal.time && <span>{meal.time}</span>}
            <span>Б {meal.protein ?? "—"}</span>
            <span>Ж {meal.fat ?? "—"}</span>
            <span>У {meal.carbs ?? "—"}</span>
          </div>
          {meal.note && <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>{meal.note}</div>}
          <button
            style={{ marginTop: 8, padding: "4px 9px", borderRadius: 8, border: "0.5px solid " + C.border, background: C.bg, color: C.text3, fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}
            onClick={() => save({ meals: day.meals.filter((m) => m.id !== meal.id) })}
          >
            Удалить
          </button>
        </div>
      ))}

      {adding
        ? <MealForm foods={store.foods} onCancel={() => setAdding(false)} onAdd={(meal) => save({ meals: [...day.meals, meal] })} />
        : (
          <button
            style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "0.5px dashed " + C.border, background: C.bg, color: C.text2, fontSize: 13, fontFamily: "inherit", cursor: "pointer", marginBottom: 14 }}
            onClick={() => setAdding(true)}
          >
            + Добавить еду
          </button>
        )}

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: C.text3, marginBottom: 8 }}>Самочувствие</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SYMPTOMS.map((s) => {
            const active = day.symptoms.includes(s);
            return (
              <button key={s} style={chip(active)}
                      onClick={() => save({ symptoms: active ? day.symptoms.filter((x) => x !== s) : [...day.symptoms, s] })}>
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: C.text3, marginBottom: 8 }}>Вода: {day.water} мл</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[250, 500, 750].map((ml) => (
            <button key={ml} style={chip(false)} onClick={() => save({ water: (day.water || 0) + ml })}>+{ml}</button>
          ))}
          {day.water > 0 && <button style={chip(false)} onClick={() => save({ water: 0 })}>Сброс</button>}
        </div>
      </div>

      {dayWorkouts.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: C.text3, marginBottom: 8 }}>Тренировки</div>
          {dayWorkouts.map((w) => (
            <div key={w.id} style={{ background: C.card, border: "0.5px solid " + C.border, borderRadius: 12, padding: 12, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span>{WORKOUT_TYPES[w.type].ru}</span>
                <span style={{ color: C.text2 }}>{w.kcalActive ? `${Math.round(w.kcalActive)} ккал` : "—"}</span>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 11, color: C.text3 }}>
                <span>{fmtDuration(w.durationSec)}</span>
                {w.distanceKm && <span>{w.distanceKm.toFixed(2)} км</span>}
                {w.distanceKm && <span>{fmtPace(paceSecPerKm(w))}/км</span>}
                {w.hrAvg && <span>{w.hrAvg} уд/мин</span>}
              </div>
              {w.note && <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>{w.note}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
