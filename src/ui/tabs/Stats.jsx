import { C } from "../theme.js";
import { MONTH_LABELS } from "../format.js";
import Bars from "../components/Bars.jsx";
import Scatter from "../components/Scatter.jsx";
import {
  monthlyVolume, weeklyVolume, movingAverage, zone2ShareByMonth,
  efficiencyByMonth, paceSecPerKm, fmtPace,
} from "../../domain/aggregate.js";
import { records } from "../../domain/records.js";
import { dayTotals } from "../../domain/nutrition.js";

const monthLabel = (month) => MONTH_LABELS[Number(month.split("-")[1]) - 1];
const weekLabel = (week) => week.split("-W")[1];

export default function Stats({ store }) {
  const { workouts, days, settings } = store;
  const months = monthlyVolume(workouts, "running");
  const weeks = weeklyVolume(workouts, "running").slice(-16);
  const avg4 = movingAverage(weeks.map((w) => w.km), 4);
  const rec = records(workouts);
  const zone2 = zone2ShareByMonth(workouts, settings.zone2MaxHr);
  const eff = efficiencyByMonth(workouts);

  const runs = workouts.filter((w) => w.type === "running" && w.hrAvg && w.distanceKm >= 5).slice().reverse();
  const scatter = runs.map((w, i) => ({
    x: w.hrAvg,
    y: -paceSecPerKm(w), // выше на графике = быстрее
    t: runs.length > 1 ? i / (runs.length - 1) : 1,
  }));

  const daysWithFood = days.filter((d) => (d.meals || []).length);
  const avgKcal = daysWithFood.length
    ? Math.round(daysWithFood.reduce((sum, d) => sum + dayTotals(d).kcal, 0) / daysWithFood.length)
    : null;
  const overLimit = daysWithFood.filter((d) => dayTotals(d).kcal > settings.kcalLimit).length;

  const card = { background: C.card, border: "0.5px solid " + C.border, borderRadius: 14, padding: 14, marginBottom: 14 };
  const title = { fontSize: 12, color: C.text3, marginBottom: 10 };
  const tile = { background: C.card, border: "0.5px solid " + C.border, borderRadius: 12, padding: 12 };

  return (
    <div>
      <div style={card}>
        <div style={title}>Беговой объём по месяцам</div>
        <Bars items={months} valueOf={(m) => m.km} labelOf={(m) => monthLabel(m.month)} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.text3, marginTop: 6 }}>
          {months.map((m) => <span key={m.month}>{m.km.toFixed(0)}</span>)}
        </div>
      </div>

      <div style={card}>
        <div style={title}>По неделям, голубая линия — среднее за 4 недели</div>
        <Bars items={weeks} valueOf={(w) => w.km} labelOf={(w) => weekLabel(w.week)} line={avg4} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div style={tile}>
          <div style={{ fontSize: 10, color: C.text3 }}>Макс. дистанция</div>
          <div style={{ fontSize: 16 }}>{rec.maxDistanceKm ? `${rec.maxDistanceKm.toFixed(2)} км` : "—"}</div>
        </div>
        <div style={tile}>
          <div style={{ fontSize: 10, color: C.text3 }}>Макс. расход</div>
          <div style={{ fontSize: 16 }}>{rec.maxKcal ? `${Math.round(rec.maxKcal)}` : "—"}</div>
        </div>
        <div style={tile}>
          <div style={{ fontSize: 10, color: C.text3 }}>Тренировок</div>
          <div style={{ fontSize: 16 }}>{workouts.length}</div>
        </div>
      </div>

      <div style={card}>
        <div style={title}>Лучший темп</div>
        {[5, 8, 10].map((km) => (
          <div key={km} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
            <span style={{ color: C.text2 }}>на {km} км и больше</span>
            <span>{rec.bestPace[km] ? `${fmtPace(rec.bestPace[km])}/км` : "—"}</span>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={title}>Дрейф формы: пульс против темпа, тёмные точки — свежие</div>
        <Scatter points={scatter} />
      </div>

      <div style={card}>
        <div style={title}>Эффективность: метров на удар пульса</div>
        <Bars items={eff} valueOf={(m) => m.value} labelOf={(m) => monthLabel(m.month)} height={110} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.text3, marginTop: 6 }}>
          {eff.map((m) => <span key={m.month}>{m.value.toFixed(2)}</span>)}
        </div>
      </div>

      <div style={card}>
        <div style={title}>Доля пробежек в зоне 2 (пульс ниже {settings.zone2MaxHr})</div>
        {zone2.length === 0 && <div style={{ fontSize: 12, color: C.text3 }}>Нет пробежек с записанным пульсом</div>}
        {zone2.map((m) => (
          <div key={m.month} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.text2, marginBottom: 3 }}>
              <span>{monthLabel(m.month)}</span>
              <span>{Math.round(m.share * 100)}% из {m.total}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: C.border, overflow: "hidden" }}>
              <div style={{ width: `${m.share * 100}%`, height: "100%", background: "#22D3EE" }} />
            </div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={title}>Питание</div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
          <span style={{ color: C.text2 }}>Средние ккал за день</span>
          <span>{avgKcal ?? "—"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
          <span style={{ color: C.text2 }}>Дней выше лимита {settings.kcalLimit}</span>
          <span>{overLimit} из {daysWithFood.length}</span>
        </div>
      </div>
    </div>
  );
}
