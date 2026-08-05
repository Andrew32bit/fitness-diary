import { useState } from "react";
import { C } from "./theme.js";
import { useStore } from "./store.js";
import Diary from "./tabs/Diary.jsx";
import Weight from "./tabs/Weight.jsx";
import Workouts from "./tabs/Workouts.jsx";
import Stats from "./tabs/Stats.jsx";
import Settings from "./tabs/Settings.jsx";
import BackupBanner from "./components/BackupBanner.jsx";

const TABS = ["diary", "weight", "workouts", "stats"];
const TL = { diary: "Дневник", weight: "Вес", workouts: "Тренировки", stats: "Статистика" };

export default function App() {
  const [tab, setTab] = useState("diary");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const store = useStore();

  if (!store.ready) {
    return <div style={{ padding: 40, textAlign: "center", color: C.text3, fontSize: 13 }}>Загружаю…</div>;
  }

  const empty = !store.workouts.length && !store.days.length && !store.weights.length;

  return (
    <div style={{
      maxWidth: 480, margin: "0 auto", padding: "max(16px, env(safe-area-inset-top)) 16px 32px",
      background: C.bg, color: C.text, minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
    }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button
          style={{ padding: "6px 11px", borderRadius: 9, border: "0.5px solid " + C.border, background: C.bg, color: C.text3, fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}
          onClick={() => setSettingsOpen(true)}
        >
          Настройки
        </button>
      </div>

      {settingsOpen ? (
        <Settings store={store} onClose={() => setSettingsOpen(false)} />
      ) : (
        <>
          <div style={{ display: "flex", background: C.sub, borderRadius: 14, padding: 3, marginBottom: 20 }}>
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: "10px 0", border: "none", borderRadius: 12, fontSize: 13,
                  fontWeight: tab === t ? 500 : 400, cursor: "pointer", fontFamily: "inherit",
                  background: tab === t ? C.bg : "transparent",
                  color: tab === t ? C.text : C.text3,
                  boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {TL[t]}
              </button>
            ))}
          </div>

          {!empty && <BackupBanner sync={store.sync} onBackup={store.actions.download} />}

          {empty && (
            <div style={{ background: C.card, border: "0.5px solid " + C.border, borderRadius: 14, padding: 16, marginBottom: 16, fontSize: 13, color: C.text2 }}>
              Данных пока нет. Нажми «Настройки» и импортируй файл.
            </div>
          )}

          {tab === "diary" && <Diary store={store} />}
          {tab === "weight" && <Weight store={store} />}
          {tab === "workouts" && <Workouts store={store} />}
          {tab === "stats" && <Stats store={store} />}
        </>
      )}
    </div>
  );
}
