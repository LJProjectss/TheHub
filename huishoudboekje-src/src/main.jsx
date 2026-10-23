import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";

// Service worker: zodra er een nieuwe versie klaarstaat, herlaadt de app zichzelf.
// Een geïnstalleerde app blijft vaak lang open staan, dus we kijken ook elk uur en
// bij elke terugkeer naar de app of er een update is.
const UPDATE_CHECK_MS = 60 * 60 * 1000;
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const check = () => registration.update().catch(() => {});
    setInterval(check, UPDATE_CHECK_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) check();
    });
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
