import { useRef, useState } from "react";
import { C } from "../theme.js";

const SECTION_LABEL = { workouts: "Тренировки", days: "Дни", weights: "Вес", foods: "Продукты" };

export default function ImportPanel({ store }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const button = {
    flex: 1, padding: "11px 0", borderRadius: 10, border: "0.5px solid " + C.border,
    background: C.bg, color: C.text, fontSize: 13, fontFamily: "inherit", cursor: "pointer",
  };

  const sum = (reports) =>
    reports.reduce((acc, r) => {
      for (const key of Object.keys(SECTION_LABEL)) {
        acc[key] = acc[key] || { added: 0, updated: 0, unchanged: 0, conflicts: [] };
        acc[key].added += r[key].added;
        acc[key].updated += r[key].updated;
        acc[key].unchanged += r[key].unchanged;
        acc[key].conflicts.push(...r[key].conflicts);
      }
      // Не входит в SECTION_LABEL: settingsApplied — не раздел, а число восстановленных
      // значений. Без явного суммирования здесь оно терялось бы при sum() и строка
      // «Настройки восстановлены» никогда бы не показалась, даже если merge их применил.
      acc.settingsApplied = (acc.settingsApplied || 0) + (r.settingsApplied || 0);
      return acc;
    }, {});

  async function handleFiles(fileList) {
    setBusy(true);
    setError(null);
    setReport(null);
    // Ошибка ловится по каждому файлу отдельно. Один try на весь цикл прятал бы отчёт
    // по успешно импортированным файлам: данные уже записаны, а пользователь видит
    // только сообщение об ошибке и думает, что не импортировалось ничего.
    const reports = [];
    const failures = [];
    for (const file of fileList) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        reports.push(await store.actions.importFile({ name: file.name, bytes }));
      } catch (e) {
        failures.push(`${file.name}: ${e.message}`);
      }
    }
    if (reports.length) setReport(sum(reports));
    if (failures.length) setError(failures.join("; "));
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handlePaste() {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) throw new Error("Буфер обмена пустой");
      setReport(sum([await store.actions.importText(text)]));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: C.card, border: "0.5px solid " + C.border, borderRadius: 14, padding: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: 10 }}>
        Импорт: export.xml, export.zip, TCX от HealthFit или JSON. Повторный импорт того же файла ничего не дублирует.
      </div>

      <input
        ref={inputRef} type="file" multiple accept=".xml,.zip,.tcx,.json,application/json,text/xml"
        style={{ display: "none" }}
        onChange={(e) => handleFiles([...e.target.files])}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button style={button} disabled={busy} onClick={() => inputRef.current.click()}>Импорт файла</button>
        <button style={button} disabled={busy} onClick={handlePaste}>Вставить из буфера</button>
      </div>

      {busy && <div style={{ fontSize: 12, color: C.text3 }}>Разбираю…</div>}

      {error && (
        <div style={{ fontSize: 12, color: "#B91C1C", background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 10, padding: 10 }}>
          {error}
        </div>
      )}

      {report && (() => {
        // Конфликты приходят и от тренировок, и от веса — форма у них одна,
        // поэтому показываем их одним списком, иначе часть осталась бы невидимой.
        const allConflicts = Object.keys(SECTION_LABEL).flatMap((key) => report[key].conflicts);
        return (
        <div style={{ fontSize: 12, color: C.text2 }}>
          {Object.entries(SECTION_LABEL).map(([key, label]) => {
            const r = report[key];
            if (!r.added && !r.updated && !r.unchanged) return null;
            return (
              <div key={key} style={{ padding: "3px 0" }}>
                {label}: добавлено {r.added}, обновлено {r.updated}, без изменений {r.unchanged}
              </div>
            );
          })}
          {report.settingsApplied > 0 && (
            <div style={{ padding: "3px 0" }}>Настройки восстановлены: {report.settingsApplied} значений</div>
          )}
          {allConflicts.length > 0 && (
            <div style={{ marginTop: 8, color: "#92400E", background: "#FFFBEB", border: "0.5px solid #FDE68A", borderRadius: 10, padding: 10 }}>
              Конфликтов с ручными записями: {allConflicts.length}. Твои значения сохранены.
              {allConflicts.slice(0, 5).map((c) => (
                <div key={c.id} style={{ fontSize: 11, marginTop: 4 }}>
                  {c.id}: {c.fields.map((f) => `${f.field} ${f.mine} против ${f.incoming}`).join(", ")}
                </div>
              ))}
            </div>
          )}
        </div>
        );
      })()}
    </div>
  );
}
