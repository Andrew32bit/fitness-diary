import { useEffect, useState } from "react";
import { C } from "../theme.js";
import ImportPanel from "../components/ImportPanel.jsx";

// Все личные цели живут здесь, а не в коде: в репозитории им не место.
const FIELDS = [
  ["goalKg", "Цель, кг"],
  ["startKg", "Старт, кг"],
  ["kcalLimit", "Лимит ккал"],
  ["proteinGoal", "Белок, г"],
  ["fatGoal", "Жиры, г"],
  ["carbsGoal", "Углеводы, г"],
  ["zone2MaxHr", "Порог зоны 2, уд/мин"],
];

export default function Settings({ store, onClose }) {
  const [draft, setDraft] = useState(store.settings);

  // Импорт бэкапа делается с ЭТОГО экрана, поэтому настройки могут измениться,
  // пока он открыт. Без синхронизации поля показывали бы старые значения после
  // восстановления, и пользователь решил бы, что восстановление не сработало.
  //
  // Зависимость — именно отметка времени импорта, а НЕ сам объект настроек.
  // Сохранение поля происходит по потере фокуса и асинхронно обновляет хранилище;
  // если синхронизироваться на любое изменение настроек, то при обычном
  // последовательном заполнении формы — ушёл из одного поля, печатаешь в
  // следующем — доехавшее сохранение первого затрёт набранное во втором.
  // Отметка импорта меняется только при импорте, то есть ровно тогда, когда
  // перечитать значения действительно нужно.
  useEffect(() => {
    setDraft(store.settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.sync.lastImportAt]);

  const field = {
    padding: "9px 10px", borderRadius: 10, border: "0.5px solid " + C.border,
    background: C.bg, color: C.text, fontSize: 13, fontFamily: "inherit", width: 120, textAlign: "right",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 17, fontWeight: 500 }}>Настройки</div>
        <button
          style={{ padding: "7px 13px", borderRadius: 9, border: "0.5px solid " + C.border, background: C.bg, color: C.text2, fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}
          onClick={onClose}
        >
          Закрыть
        </button>
      </div>

      <ImportPanel store={store} />

      <div style={{ background: C.card, border: "0.5px solid " + C.border, borderRadius: 14, padding: 14, marginBottom: 14 }}>
        {FIELDS.map(([key, label]) => (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
            <span style={{ fontSize: 13, color: C.text2 }}>{label}</span>
            <input
              style={field} type="number" inputMode="decimal" value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              onBlur={() => store.actions.saveSettings({ [key]: Number(draft[key]) })}
            />
          </div>
        ))}
      </div>

      <div style={{ background: C.card, border: "0.5px solid " + C.border, borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, color: C.text3, marginBottom: 10 }}>
          Выгрузка содержит всё: тренировки, дни, вес, продукты и настройки. Этот же файл импортируется обратно.
        </div>
        <button
          style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: C.text, color: C.bg, fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}
          onClick={store.actions.download}
        >
          Экспорт всех данных
        </button>
        <div style={{ fontSize: 11, color: C.text3, marginTop: 8 }}>
          Последний бэкап: {store.sync.lastBackupAt ? store.sync.lastBackupAt.slice(0, 10) : "не делался"} ·
          последний импорт: {store.sync.lastImportAt ? store.sync.lastImportAt.slice(0, 10) : "не было"}
        </div>
      </div>
    </div>
  );
}
