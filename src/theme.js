import { createContext, useContext, useState, useEffect, createElement } from "react";
import { readStoredFlag } from "./utils.js";

// Brand anchors:
//   Navy  #284A67 — structure, headings (the wordmark hue)
//   Green #3DC83E — gains / positive data (the icon mark)
//   Brass #AE8836 — editorial UI accent thread (new distinctive anchor)
//   Clay  #B24E2C — losses / negative data

// Hex approximations of the OKLCH token system in index.css
// (warm private-bank editorial — ivory paper, brass accent thread)
// radius mirrors --radius-sm/md/lg/xl (2/4/6/8px — sharpened institutional)
export const TC_LIGHT = {
  green:"#3DC83E",
  greenLight:"#62D963",
  greenDark:"#2E9E2F",
  navy:"#284A67",
  navyLight:"#3D6A94",
  navyDark:"#1A3348",
  brass:"#AE8836",
  brassLight:"#C7A24E",
  brassDark:"#876825",
  bg:"#F5F1E9",
  bgAlt:"#ECE6D9",
  bgAlt2:"#E0D8C7",
  border:"#DDD5C5",
  borderMid:"#C6BBA2",
  card:"#FDFBF6",
  text:"#20272E",
  textMid:"#465360",
  textLight:"#7B7566",
  red:"#B24E2C",
  redLight:"#F6E8E1",
  orange:"#BE771A",
  warning:"#A9781A",
  yellow:"#8A6B12", yellowLight:"#F8F1DC", purple:"#6A4C8A",
  shadows: {
    card:      "0 1px 2px rgba(52,38,16,0.05), 0 10px 26px rgba(52,38,16,0.07)",
    cardHover: "0 10px 26px rgba(52,38,16,0.12), 0 18px 44px rgba(52,38,16,0.09)",
    modal:     "0 8px 40px rgba(35,25,10,0.20)",
    sm:        "0 1px 3px rgba(52,38,16,0.08)",
    hero:      "0 16px 44px rgba(26,51,72,0.26)",
  },
  radius: { sm: 2, md: 4, lg: 6, xl: 8 },
  gradients: {
    navy:   "linear-gradient(135deg, #284A67 0%, #1A3348 100%)",
    green:  "linear-gradient(135deg, #3DC83E 0%, #2E9E2F 100%)",
    brass:  "linear-gradient(135deg, #C7A24E 0%, #876825 100%)",
    accent: "linear-gradient(90deg, #C7A24E 0%, #284A67 100%)",
  },
};

export const TC_DARK = {
  green:"#4DD94E",
  greenLight:"#76E477",
  greenDark:"#37BB38",
  navy:"#7FB0D6",
  navyLight:"#A0C7E6",
  navyDark:"#5E93BE",
  brass:"#CBA255",
  brassLight:"#DCB870",
  brassDark:"#9E7C36",
  bg:"#151D26",
  bgAlt:"#1B2531",
  bgAlt2:"#22303E",
  border:"#2A3947",
  borderMid:"#374A5B",
  card:"#1C2733",
  text:"#E4DECF",
  textMid:"#8A94A0",
  textLight:"#5C6672",
  red:"#DC7A55",
  redLight:"#2A1810",
  orange:"#E0952F",
  warning:"#E6B45A",
  yellow:"#D9B65A", yellowLight:"#241C0A", purple:"#9B7CC8",
  shadows: {
    card:      "0 1px 3px rgba(0,0,0,0.28), 0 12px 28px rgba(0,0,0,0.22)",
    cardHover: "0 10px 24px rgba(0,0,0,0.38), 0 18px 42px rgba(0,0,0,0.26)",
    modal:     "0 8px 40px rgba(0,0,0,0.54)",
    sm:        "0 1px 4px rgba(0,0,0,0.30)",
    hero:      "0 18px 48px rgba(0,0,0,0.40)",
  },
  radius: { sm: 2, md: 4, lg: 6, xl: 8 },
  gradients: {
    navy:   "linear-gradient(135deg, #22405e 0%, #14263a 100%)",
    green:  "linear-gradient(135deg, #3DC83E 0%, #2E9E2F 100%)",
    brass:  "linear-gradient(135deg, #DCB870 0%, #9E7C36 100%)",
    accent: "linear-gradient(90deg, #DCB870 0%, #22405e 100%)",
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
