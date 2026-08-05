import { useState } from "react";
import { C } from "../theme.js";
import { scaleFood } from "../../domain/nutrition.js";
import { toNumber } from "../../data/schema.js";

const MEAL_NAMES = ["Завтрак", "Обед", "Перекус", "Ужин", "Поздний перекус"];
const EMPTY = { name: "", kcal: "", protein: "", fat: "", carbs: "", time: "", note: "" };

export default function MealForm({ foods, onAdd, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [grams, setGrams] = useState("");
  const [foodId, setFoodId] = useState("");

  const field = {
    padding: "9px 10px", borderRadius: 10, border: "0.5px solid " + C.border,
    background: C.bg, color: C.text, fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box",
  };

  function pickFood(id, gramsValue) {
    setFoodId(id);
    const food = foods.find((f) => f.id === id);
    if (!food) return;
    const g = gramsValue || food.portionG || 100;
    setGrams(String(g));
    const scaled = scaleFood(food, g);
    setForm({
      ...form,
      name: food.name,
      kcal: scaled.kcal ?? "",
      protein: scaled.protein ?? "",
      fat: scaled.fat ?? "",
      carbs: scaled.carbs ?? "",
    });
  }

  return (
    <div style={{ background: C.card, border: "0.5px solid " + C.border, borderRadius: 14, padding: 12, marginBottom: 12 }}>
      <select style={{ ...field, marginBottom: 8 }} value={foodId} onChange={(e) => pickFood(e.target.value, null)}>
        <option value="">Свой продукт…</option>
        {foods.map((f) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>

      {foodId && (
        <input
          style={{ ...field, marginBottom: 8 }} type="number" inputMode="decimal" placeholder="Граммовка"
          value={grams} onChange={(e) => { setGrams(e.target.value); pickFood(foodId, e.target.value); }}
        />
      )}

      <input style={{ ...field, marginBottom: 8 }} placeholder="Название" value={form.name}
             onChange={(e) => setForm({ ...form, name: e.target.value })} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 6, marginBottom: 8 }}>
        {[["kcal", "Ккал"], ["protein", "Б"], ["fat", "Ж"], ["carbs", "У"]].map(([key, label]) => (
          <input key={key} style={field} type="number" inputMode="decimal" placeholder={label}
                 value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
        <select style={field} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}>
          <option value="">Приём пищи…</option>
          {MEAL_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <input style={field} placeholder="Заметка" value={form.note}
               onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: C.text, color: C.bg, fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}
          disabled={!form.name}
          onClick={() => {
            // Незаполненный макрос обязан остаться неизвестным, а не пустой строкой:
            // в списке еды пустая строка выводится как «Б » без значения, тогда как
            // отсутствующее значение должно показываться прочерком.
            onAdd({
              id: crypto.randomUUID(),
              name: form.name.trim(),
              kcal: toNumber(form.kcal),
              protein: toNumber(form.protein),
              fat: toNumber(form.fat),
              carbs: toNumber(form.carbs),
              time: form.time,
              note: form.note,
            });
            setForm(EMPTY);
            setFoodId("");
            setGrams("");
          }}
        >
          Добавить
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
