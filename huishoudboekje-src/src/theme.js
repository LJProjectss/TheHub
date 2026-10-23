// Kleurthema's. `P` is het actieve palet; App wisselt het bij het renderen
// via applyTheme(), zodat componenten simpelweg P.xxx kunnen lezen.
export const LIGHT = {
  navy: "#0C1830",
  navyLight: "#1A2C50",
  heading: "#0F1B33",
  blue: "#2B64C8",
  blueLight: "#6FA1F2",
  paleBlue: "#EAF0FC",
  bg: "#F3F5F9",
  surface: "#FFFFFF",
  border: "#E3E8F0",
  text: "#172033",
  muted: "#5E6B80",
  income: "#157A4E",
  expense: "#B83C33",
  errorBg: "#FBEAE7",
  successBg: "#E2F3EA",
  warnBg: "#FDF3E0",
  warn: "#85570F",
  onBlue: "#FFFFFF",
};

export const DARK = {
  navy: "#070D1A",
  navyLight: "#17233B",
  heading: "#EEF2FA",
  blue: "#6FA1F2",
  blueLight: "#8DB5F5",
  paleBlue: "#172A4B",
  bg: "#0A101D",
  surface: "#111A2B",
  border: "#222E47",
  text: "#E6EBF4",
  muted: "#8D9CB6",
  income: "#4FBF85",
  expense: "#EE7E72",
  errorBg: "#3A1E1E",
  successBg: "#15301F",
  warnBg: "#33281A",
  warn: "#E6B65E",
  onBlue: "#0A111F",
};

export const P = { ...LIGHT };

export function applyTheme(dark) {
  Object.assign(P, dark ? DARK : LIGHT);
}

export const CHART_COLORS = [
  "#1A2C50",
  "#2B64C8",
  "#6FA1F2",
  "#8FBADC",
  "#B5443A",
  "#D98B82",
  "#1B7A4C",
  "#6FAE8C",
  "#C99A3E",
  "#8A7CA8",
  "#4A6572",
  "#B08968",
];
