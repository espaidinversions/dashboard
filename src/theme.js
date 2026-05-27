import { createContext, useContext } from "react";

// Brand anchors extracted from logo:
//   Green #3DC83E — the icon mark
//   Navy  #2B5070 — the wordmark text

export const TC_LIGHT = {
  green:"#3DC83E",   // var(--color-green)
  greenLight:"#62D963",
  greenDark:"#28A029",
  navy:"#2B5070",    // var(--color-navy)
  navyLight:"#4A789A",
  navyDark:"#1C3A52",
  bg:"#F1F5F8",      // var(--color-bg)
  bgAlt:"#E6EDF3",   // var(--color-bg-alt)
  border:"#C8D5E0",  // var(--color-border)
  card:"#FFFFFF",    // var(--color-card)
  text:"#16303F",    // var(--color-text)
  textMid:"#3B5F75", // var(--color-text-mid)
  textLight:"#6B8EA6",// var(--color-text-light)
  red:"#C62828",     // var(--color-red)
  redLight:"#FDECEA",
  orange:"#E67E22",  // var(--color-orange)
  warning:"#D69E2E",
  yellow:"#B8860B", yellowLight:"#FFF8E1", purple:"#6A4C8A",
  shadows: {
    card:      "0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)",
    cardHover: "0 4px 12px rgba(15,23,42,0.10), 0 8px 24px rgba(15,23,42,0.06)",
    modal:     "0 8px 40px rgba(0,0,0,0.20)",
    sm:        "0 1px 4px rgba(15,23,42,0.08)",
  },
  // radius mirrors --radius-sm/md/lg/xl in index.css (4/6/10/14px)
  radius: { sm: 6, md: 10, lg: 14, xl: 20 },
  gradients: {
    navy:   "linear-gradient(135deg, #2B5070 0%, #1C3A52 100%)",
    green:  "linear-gradient(135deg, #3DC83E 0%, #28A029 100%)",
    accent: "linear-gradient(90deg, #3DC83E 0%, #2B5070 100%)",
  },
};

export const TC_DARK = {
  green:"#4DD94E",   // var(--color-green) dark
  greenLight:"#76E477",
  greenDark:"#35B836",
  navy:"#6AB0D8",    // var(--color-navy) dark
  navyLight:"#8DC6E8",
  navyDark:"#4A8FBD",
  bg:"#0C1A26",      // var(--color-bg) dark
  bgAlt:"#112030",   // var(--color-bg-alt) dark
  border:"#1C3348",  // var(--color-border) dark
  card:"#132130",    // var(--color-card) dark
  text:"#C8DDE8",    // var(--color-text) dark
  textMid:"#5E90AB", // var(--color-text-mid) dark
  textLight:"#3A6278",// var(--color-text-light) dark
  red:"#EF5350",     // var(--color-red) dark
  redLight:"#2A0F0F",
  orange:"#E8922A",  // var(--color-orange) dark
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
