import { useEffect, useState } from "react";

const PRIVACY_KEY = "huishoudboekje-privacy";
// Hoe lang bedragen zichtbaar blijven nadat u ze toont.
const REVEAL_MS = 5 * 60 * 1000;

// Privacymodus (standaard aan):
// - bedragen zijn vervaagd tot u ze toont (oog-knop of tik op een bedrag); na 5 minuten
//   of bij het verlaten van de app vervagen ze weer;
// - bij het verlaten van de app komt er een waas over het hele scherm, zodat de appkiezer
//   geen gegevens laat zien. Dat plaatje maakt het besturingssysteem zelf, dus op telefoons
//   werkt dit "best effort": soms is het systeem sneller dan de waas.
export function usePrivacy() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(PRIVACY_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(PRIVACY_KEY, enabled ? "on" : "off");
    } catch {
      // opslag niet beschikbaar
    }
    if (!enabled) setRevealed(false);
  }, [enabled]);

  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => setRevealed(false), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [revealed]);

  // Waas bij verlaten. Het attribuut wordt direct (buiten React om) gezet, zodat het er zo
  // snel mogelijk staat voordat het systeem zijn schermafdruk maakt.
  useEffect(() => {
    const root = document.documentElement;
    if (!enabled) {
      delete root.dataset.shield;
      return;
    }
    const cover = () => {
      root.dataset.shield = "on";
      setRevealed(false);
    };
    const uncover = () => {
      if (document.visibilityState === "visible") delete root.dataset.shield;
    };
    const onVisibility = () => (document.hidden ? cover() : uncover());
    // Op telefoons/tablets is "blur" vaak het vroegste signaal (appkiezer openen). Op de
    // computer niet gebruiken: dan zou de app vervagen zodra u naar een ander venster klikt.
    const touch = window.matchMedia?.("(pointer: coarse)").matches;
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", cover);
    window.addEventListener("pageshow", uncover);
    if (touch) {
      window.addEventListener("blur", cover);
      window.addEventListener("focus", uncover);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", cover);
      window.removeEventListener("pageshow", uncover);
      window.removeEventListener("blur", cover);
      window.removeEventListener("focus", uncover);
      delete root.dataset.shield;
    };
  }, [enabled]);

  return {
    enabled,
    toggleEnabled: () => setEnabled((v) => !v),
    hidden: enabled && !revealed,
    setRevealed,
  };
}
