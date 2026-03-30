import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { BarTip, PieTip, PL } from "../SharedComponents.jsx";

export function ResumTab({ tc, byFy, byVcpe, byEst, vcpeCfg }) {
  return (
    <>
      <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 22px", marginBottom: 18, boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.13em", color: tc.textLight, textTransform: "uppercase", marginBottom: 16, fontWeight: 600 }}>
          Capital Cridat vs. Retornat per Any Fiscal
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byFy} margin={{ left: 10, right: 10, top: 5, bottom: 5 }} barGap={4} barCategoryGap="30%">
            <XAxis dataKey="fy" tick={{ fill: tc.textMid, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => fmtS(v)} tick={{ fill: tc.textLight, fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
            <Tooltip content={<BarTip />} />
            <Legend formatter={v => <span style={{ color: tc.textMid, fontSize: 11 }}>{v}</span>} />
            <Bar dataKey="Capital Call" fill={tc.navy} radius={[5, 5, 0, 0]} />
            <Bar dataKey="Distribució" fill={tc.green} radius={[5, 5, 0, 0]} />
            <Bar dataKey="Retorn Capital" fill={tc.greenDark} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 18 }}>
        {[
          { title: "Capital Cridat per Tipus", data: byVcpe, colorFn: n => vcpeCfg[n]?.color || tc.navy },
          { title: "Capital Cridat per Estratègia", data: byEst, colorFn: n => vcpeCfg[n]?.color || tc.navy },
        ].map((ch, i) => (
          <div key={i} style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "18px 22px", boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.13em", color: tc.textLight, textTransform: "uppercase", marginBottom: 14, fontWeight: 600 }}>{ch.title}</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={ch.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} labelLine={false} label={PL}>
                  {ch.data.map((e, j) => <Cell key={j} fill={ch.colorFn(e.name)} />)}
                </Pie>
                <Tooltip content={<PieTip />} />
                <Legend formatter={v => <span style={{ color: tc.textMid, fontSize: 11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </>
  );
}

function fmtS(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M€";
  if (a >= 1e3) return (n / 1e3).toFixed(0) + "K€";
  return n.toFixed(0) + "€";
}
