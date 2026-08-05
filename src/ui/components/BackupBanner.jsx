import { C } from "../theme.js";

const WEEK_MS = 7 * 24 * 3600 * 1000;

export default function BackupBanner({ sync, onBackup }) {
  const last = sync?.lastBackupAt ? Date.parse(sync.lastBackupAt) : null;
  const days = last ? Math.floor((Date.now() - last) / (24 * 3600 * 1000)) : null;
  if (last && Date.now() - last < WEEK_MS) return null;

  return (
    <div style={{ background: "#FFFBEB", border: "0.5px solid #FDE68A", borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 12, color: "#92400E" }}>
      <div style={{ marginBottom: 8 }}>
        {last ? `Последний бэкап ${days} дней назад.` : "Бэкапа ещё не было."} iOS может очистить данные приложения, если им долго не пользоваться.
      </div>
      <button
        style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: "#92400E", color: "#fff", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}
        onClick={onBackup}
      >
        Выгрузить в файл
      </button>
    </div>
  );
}
