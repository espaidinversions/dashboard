import { createContext, useContext, useState, useEffect, createElement } from "react";
import { readStoredFlag } from "./utils.js";

// Brand anchors extracted from logo:
//   Green #3DC83E — the icon mark
//   Navy  #2B5070 — the wordmark text

// Hex approximations of the OKLCH token system in index.css
// radius mirrors --radius-sm/md/lg/xl (2/4/6/8px — sharpened institutional)
export const TC_LIGHT = {
  green:"#3DC83E",
  greenLight:"#62D963",
  greenDark:"#28A029",
  navy:"#2B4F70",
  navyLight:"#3D6A94",
  navyDark:"#1C3650",
  bg:"#EEF2F6",
  bgAlt:"#E3E9F0",
  bgAlt2:"#D6DFE9",
  border:"#CFD9E4",
  borderMid:"#B4C2D0",
  card:"#FFFFFF",
  text:"#1B2A36",
  textMid:"#334F65",
  textLight:"#5A7A90",
  red:"#B52020",
  redLight:"#FAEAEA",
  orange:"#C96A10",
  warning:"#B07B10",
  yellow:"#96700A", yellowLight:"#FFF8E1", purple:"#6A4C8A",
  shadows: {
    card:      "0 1px 2px rgba(15,23,42,0.05), 0 2px 8px rgba(15,23,42,0.04)",
    cardHover: "0 4px 12px rgba(15,23,42,0.10), 0 8px 24px rgba(15,23,42,0.06)",
    modal:     "0 8px 40px rgba(0,0,0,0.18)",
    sm:        "0 1px 3px rgba(15,23,42,0.07)",
  },
  radius: { sm: 2, md: 4, lg: 6, xl: 8 },
  gradients: {
    navy:   "linear-gradient(135deg, #2B4F70 0%, #1C3650 100%)",
    green:  "linear-gradient(135deg, #3DC83E 0%, #28A029 100%)",
    accent: "linear-gradient(90deg, #3DC83E 0%, #2B4F70 100%)",
  },
};

export const TC_DARK = {
  green:"#4DD94E",
  greenLight:"#76E477",
  greenDark:"#35B836",
  navy:"#6AACD4",
  navyLight:"#8DC3E6",
  navyDark:"#4A8AB8",
  bg:"#0E1B27",
  bgAlt:"#131F2D",
  bgAlt2:"#192636",
  border:"#1E2E3F",
  borderMid:"#26394E",
  card:"#142130",
  text:"#D0DDE8",
  textMid:"#5E8EAA",
  textLight:"#3A5F77",
  red:"#E55050",
  redLight:"#200C0C",
  orange:"#E8922A",
  warning:"#F6AD55",
  yellow:"#E8C040", yellowLight:"#221900", purple:"#9B7CC8",
  shadows: {
    card:      "0 1px 3px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.16)",
    cardHover: "0 4px 12px rgba(0,0,0,0.30), 0 8px 24px rgba(0,0,0,0.20)",
    modal:     "0 8px 40px rgba(0,0,0,0.50)",
    sm:        "0 1px 4px rgba(0,0,0,0.26)",
  },
  radius: { sm: 2, md: 4, lg: 6, xl: 8 },
  gradients: {
    navy:   "linear-gradient(135deg, #1a3a5c 0%, #0d1e30 100%)",
    green:  "linear-gradient(135deg, #3DC83E 0%, #28A029 100%)",
    accent: "linear-gradient(90deg, #4DD94E 0%, #2B4F70 100%)",
  },
};

export const ThemeContext = createContext({
  tc: TC_LIGHT,
  dark: false,
  toggle: () => {},
});

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => readStoredFlag("tc_dark"));

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  const tc = dark ? TC_DARK : TC_LIGHT;
  return createElement(
    ThemeContext.Provider,
    { value: { tc, dark, toggle: () => setDark(d => !d) } },
    children
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  return {
    tc: value?.tc ?? TC_LIGHT,
    dark: Boolean(value?.dark),
    toggle: typeof value?.toggle === "function" ? value.toggle : (() => {}),
  };
}
