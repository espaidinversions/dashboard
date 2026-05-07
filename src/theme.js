import { createContext, useContext } from "react";

// Brand anchors extracted from logo:
//   Green #3DC83E — the icon mark
//   Navy  #2B5070 — the wordmark text

export const TC_LIGHT = {
  green:"#3DC83E", greenLight:"#62D963", greenDark:"#28A029",
  navy:"#2B5070", navyLight:"#4A789A", navyDark:"#1C3A52",
  bg:"#F1F5F8", bgAlt:"#E6EDF3", border:"#C8D5E0",
  card:"#FFFFFF",
  text:"#16303F", textMid:"#3B5F75", textLight:"#6B8EA6",
  red:"#C62828", redLight:"#FDECEA", orange:"#E67E22",
  warning:"#D69E2E",
  yellow:"#B8860B", yellowLight:"#FFF8E1", purple:"#6A4C8A",
  shadows: {
    card:      "0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)",
    cardHover: "0 4px 12px rgba(15,23,42,0.10), 0 8px 24px rgba(15,23,42,0.06)",
    modal:     "0 8px 40px rgba(0,0,0,0.20)",
    sm:        "0 1px 4px rgba(15,23,42,0.08)",
  },
  radius: { sm: 6, md: 10, lg: 14, xl: 20 },
  gradients: {
    navy:   "linear-gradient(135deg, #2B5070 0%, #1C3A52 100%)",
    green:  "linear-gradient(135deg, #3DC83E 0%, #28A029 100%)",
    accent: "linear-gradient(90deg, #3DC83E 0%, #2B5070 100%)",
  },
};

export const TC_DARK = {
  green:"#4DD94E", greenLight:"#76E477", greenDark:"#35B836",
  navy:"#6AB0D8", navyLight:"#8DC6E8", navyDark:"#4A8FBD",
  bg:"#0C1A26", bgAlt:"#112030", border:"#1C3348",
  card:"#132130",
  text:"#C8DDE8", textMid:"#5E90AB", textLight:"#3A6278",
  red:"#EF5350", redLight:"#2A0F0F", orange:"#E8922A",
  warning:"#F6AD55",
  yellow:"#E8C040", yellowLight:"#221900", purple:"#9B7CC8",
  shadows: {
    card:      "0 1px 3px rgba(0,0,0,0.20), 0 4px 16px rgba(0,0,0,0.15)",
    cardHover: "0 4px 12px rgba(0,0,0,0.30), 0 8px 24px rgba(0,0,0,0.20)",
    modal:     "0 8px 40px rgba(0,0,0,0.50)",
    sm:        "0 1px 4px rgba(0,0,0,0.25)",
  },
  radius: { sm: 6, md: 10, lg: 14, xl: 20 },
  gradients: {
    navy:   "linear-gradient(135deg, #1a3a5c 0%, #0d1e30 100%)",
    green:  "linear-gradient(135deg, #3DC83E 0%, #28A029 100%)",
    accent: "linear-gradient(90deg, #4DD94E 0%, #2B5070 100%)",
  },
};

export const ThemeContext = createContext({
  tc: TC_LIGHT,
  dark: false,
  toggle: () => {},
});

export function useTheme() {
  const value = useContext(ThemeContext);
  return {
    tc: value?.tc ?? TC_LIGHT,
    dark: Boolean(value?.dark),
    toggle: typeof value?.toggle === "function" ? value.toggle : (() => {}),
  };
}
