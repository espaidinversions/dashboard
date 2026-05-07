import React from "react";
import ReactECharts from "../ReactECharts.jsx";
import { fmtM } from "../utils.js";
import { formatPercent } from "../data/searcherFormatting.js";
import { CHART_PALETTE } from "../chartColors.js";
const FLAG_MAP = { ES:"🇪🇸", EN:"🇬🇧", IT:"🇮🇹", DE:"🇩🇪", FR:"🇫🇷", PT:"🇵🇹", NL:"🇳🇱", US:"🇺🇸", CH:"🇨🇭" };

export function SearcherYearChart({ commitmentYearData, t, TC }) {
  return (
    <ReactECharts
      style={{ width:"100%", height:260 }}
      opts={{ renderer:"canvas" }}
      option={{
        grid: { top: 12, right: 12, bottom: 32, left: 12, containLabel: true },
        tooltip: {
          ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" },
          formatter: (params) => {
            const item = params?.[0];
            if (!item) return "";
            return `<b>${item.axisValue}</b><br/>${item.marker}Searchers: ${item.value}`;
          },
        },
        xAxis: {
          type: "category", data: commitmentYearData.map(r => r.year),
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: TC.textLight, fontSize: 10 },
        },
        yAxis: {
          type: "value", minInterval: 1, axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: TC.textLight, fontSize: 10 },
          splitLine: { lineStyle: { color: TC.border } },
        },
        series: [{
          type: "bar", name: "Searchers",
          data: commitmentYearData.map(r => r.count),
          itemStyle: { color: TC.navy, borderRadius: [5, 5, 0, 0] },
          barMaxWidth: 42,
          label: { show: true, position: "top", color: TC.textMid, fontSize: 10, formatter: ({ value }) => value },
        }],
      }}
    />
  );
}

export function SearcherGeoPieChart({ geoData, geoTotal, activeGeoFilter, t, TC, onGeoClick }) {
  return (
    <ReactECharts
      style={{ width: "100%", height: 300 }}
      opts={{ renderer: "canvas" }}
      onEvents={{
        click: (params) => onGeoClick(params?.data?.geo ?? "Tots"),
      }}
      option={{
        tooltip: {
          ...t.tooltip, trigger: "item",
          formatter: p => `<b>${p.name}</b><br/>${fmtM(p.value)}<br/>${formatPercent(geoTotal > 0 ? (p.value / geoTotal) * 100 : 0)}% · ${(geoData.find(r => r.name === p.name)?.count ?? 0)} searcher${(geoData.find(r => r.name === p.name)?.count ?? 0) === 1 ? "" : "s"}`,
        },
        legend: { show: false },
        graphic: [{
          type: "group", left: "center", top: "middle",
          children: [
            { type: "text", style: { text: fmtM(geoTotal), x: 0, y: -7, textAlign: "center", fill: TC.navy, fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono',monospace" } },
            { type: "text", style: { text: "Total", x: 0, y: 9, textAlign: "center", fill: TC.textLight, fontSize: 9 } },
          ],
        }],
        series: [{
          type: "pie", radius: ["48%", "76%"], center: ["50%", "50%"],
          selectedMode: false, labelLine: { show: false },
          label: {
            show: true,
            formatter: p => {
              if (p.percent < 4) return "";
              return `${FLAG_MAP[p.name] || p.name} ${formatPercent(p.percent, 0)}%`;
            },
            fontSize: 11, color: TC.textMid,
          },
          data: geoData.map((d, i) => ({
            name: d.name, value: d.value, geo: d.geo,
            itemStyle: {
              color: CHART_PALETTE[i % CHART_PALETTE.length],
              opacity: activeGeoFilter === "Tots" || activeGeoFilter === d.geo ? 1 : 0.35,
              borderWidth: activeGeoFilter === d.geo ? 3 : 0,
              borderColor: activeGeoFilter === d.geo ? TC.navy : "transparent",
            },
          })),
        }],
      }}
    />
  );
}

export function SearcherGeoBarChart({ geoCountData, geoCountTotal, activeGeoFilter, t, TC, onGeoClick }) {
  return (
    <ReactECharts
      style={{ width:"100%", height:260 }}
      opts={{ renderer:"canvas" }}
      onEvents={{
        click: (params) => onGeoClick(geoCountData[params?.dataIndex]?.geo ?? "Tots"),
      }}
      option={{
        grid: { top: 12, right: 12, bottom: 24, left: 80, containLabel: true },
        tooltip: {
          ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" },
          formatter: (params) => {
            const item = params?.[0];
            if (!item) return "";
            const geoRow = geoCountData[item.dataIndex];
            return `<b>${geoRow?.name ?? item.axisValue}</b><br/>${item.marker}Searchers: ${item.value}<br/>Capital: ${fmtM(geoRow?.value ?? 0)}`;
          },
        },
        xAxis: {
          type: "value", minInterval: 1, axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: TC.textLight, fontSize: 10 },
          splitLine: { lineStyle: { color: TC.border } },
        },
        yAxis: {
          type: "category", data: geoCountData.map(r => r.name),
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: TC.textLight, fontSize: 10 },
        },
        series: [{
          type: "bar",
          data: geoCountData.map((row, index) => ({
            value: row.count,
            itemStyle: {
              color: CHART_PALETTE[index % CHART_PALETTE.length],
              opacity: activeGeoFilter === "Tots" || activeGeoFilter === row.geo ? 1 : 0.35,
            },
          })),
          barMaxWidth: 26,
          label: { show: true, position: "right", color: TC.textMid, fontSize: 10, formatter: ({ value }) => `${value}` },
        }],
        graphic: [{
          type: "text", right: 4, top: 0,
          style: { text: `Total ${geoCountTotal}`, fill: TC.textLight, fontSize: 10, fontFamily: "'DM Mono',monospace" },
        }],
      }}
    />
  );
}
