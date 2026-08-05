import { createRoot } from "react-dom/client";
import App from "./ui/App.jsx";

// Снижает вероятность выселения данных браузером там, где это поддерживается.
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

createRoot(document.getElementById("root")).render(<App />);
