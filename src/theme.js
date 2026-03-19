import { createContext, useContext } from "react";

export const TC_LIGHT = {
  green:"#5A966E", greenLight:"#7AAD94", greenDark:"#3D6B55",
  navy:"#3C5064", navyLight:"#5A7A96", navyDark:"#2A3F52",
  bg:"#F4F6F8", bgAlt:"#EEF1F4", border:"#D8DFE6",
  card:"#FFFFFF",
  text:"#1E2D3A", textMid:"#4A6070", textLight:"#7A94A4",
  red:"#C62828", redLight:"#FDECEA", orange:"#E67E22",
  warning:"#D69E2E",
  yellow:"#B8860B", yellowLight:"#FFF8E1", purple:"#6A4C8A",
};

export const TC_DARK = {
  green:"#5CC88A", greenLight:"#80D8A8", greenDark:"#3BA86C",
  navy:"#70B0DC", navyLight:"#90C4E8", navyDark:"#4A90C0",
  bg:"#0F1923", bgAlt:"#152030", border:"#253548",
  card:"#16232F",
  text:"#D4E4F0", textMid:"#7A9EB8", textLight:"#4E6E88",
  red:"#EF5350", redLight:"#2A0F0F", orange:"#E8922A",
  warning:"#F6AD55",
  yellow:"#E8C040", yellowLight:"#221900", purple:"#9B7CC8",
};

export const ThemeContext = createContext({
  tc: TC_LIGHT,
  dark: false,
  toggle: () => {},
});

export const useTheme = () => useContext(ThemeContext);
