# Nav Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three-bar horizontal navigation with a persistent left sidebar, group content under Portfoli, add a top-level Transaccions section, and route SF/PC/RE transactions to their correct sub-sections.

**Architecture:** New `Sidebar.jsx` owns all nav rendering. `Dashboard.jsx` gains a sidebar + slim top-bar shell that replaces the three current nav bars. Content panels are unchanged; only the outer frame and a few state additions are new.

**Tech Stack:** React 18, react-router-dom, `usePersistedState` (localStorage), existing theme/tc pattern.

---

## File map

| File | Action | What changes |
|---|---|---|
| `src/config.js` | Modify | Add `SF`, `PC` to `VCPE_CFG` |
| `src/components/Sidebar.jsx` | **Create** | Full sidebar component |
| `src/components/Dashboard.jsx` | Modify | Shell restructure, state additions, new renders |
| `src/components/PMTipusTab.jsx` | Modify | `secLabel` font-size fix |

---

## Task 1 — Add SF/PC vcpe types

**Files:** Modify `src/config.js:13-17`

- [ ] **Step 1 — Add SF and PC to VCPE_CFG**

Replace:
```js
export const VCPE_CFG = {
  "PE": { color:TC.navy,    bg:"#E6EDF3" },
  "VC": { color:TC.green,   bg:"#E8F8E8" },
  "RE": { color:"#6A4C8A",  bg:"#F3EEF8" },
};
```
With:
```js
export const VCPE_CFG = {
  "PE": { color:TC.navy,      bg:"#E6EDF3" },
  "VC": { color:TC.green,     bg:"#E8F8E8" },
  "RE": { color:"#6A4C8A",    bg:"#F3EEF8" },
  "SF": { color:"#2563A8",    bg:"#DDEAF8" },
  "PC": { color:"#7A5A00",    bg:"#FFF5D6" },
};
```

- [ ] **Step 2 — Update vcpe filter pills in Dashboard.jsx** (line ~792)

Find the hardcoded `["PE","VC","RE"]` pill array and replace with `Object.keys(VCPE_CFG)`:

```js
{Object.keys(vcpeCfg).map(v=>(
  <button key={v} onClick={()=>toggleVcpe(v)}
    style={{background:fVcpe.has(v)?tc.navy:"transparent",border:`1.5px solid ${fVcpe.has(v)?tc.navy:tc.border}`,color:fVcpe.has(v)?"#fff":tc.textMid,borderRadius:20,padding:"2px 10px",cursor:"pointer",fontSize:11,fontWeight:fVcpe.has(v)?700:400,fontFamily:"inherit"}}>
    {v}
  </button>
))}
```

Also update `vcpeCfg` in Dashboard.jsx (~line 433) to include SF and PC:
```js
const vcpeCfg = {
  "PE": { color:tc.navy,               bg: dark ? "#112030" : "#E6EDF3" },
  "VC": { color:tc.green,              bg: dark ? "#0A2010" : "#E8F8E8" },
  "RE": { color:tc.purple||"#9B7CC8",  bg: dark ? "#20163A" : "#F3EEF8" },
  "SF": { color:"#2563A8",             bg: dark ? "#0A1828" : "#DDEAF8" },
  "PC": { color:"#7A5A00",             bg: dark ? "#1A1200" : "#FFF5D6" },
};
```

- [ ] **Step 3 — Commit**
```bash
git add src/config.js src/components/Dashboard.jsx
git commit -m "feat: add SF/PC vcpe types"
```

---

## Task 2 — Create Sidebar.jsx

**Files:** Create `src/components/Sidebar.jsx`

- [ ] **Step 1 — Create the file**

```jsx
// src/components/Sidebar.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";

export const SIDEBAR_W = 220;
export const RAIL_W    = 52;

// ── nav tree ─────────────────────────────────────────────
const PORTFOLI_SECTIONS = [
  {
    id:"alt", label:"Alternatius", icon:"💼",
    children:[
      {id:"fons",      label:"Fons",                icon:"🏦"},
      {id:"searchers", label:"Searchers",           icon:"🔍"},
      {id:"companies", label:"Participades",        icon:"🏢"},
      {id:"posicions", label:"Totes les Posicions", icon:"📋"},
    ],
  },
  {
    id:"re", label:"Real Estate", icon:"🏠",
    children:[
      {id:"re-directe", label:"Directe"},
      {id:"re-altres",  label:"Altres Vehicles"},
    ],
  },
  {
    id:"mp", label:"Mercats Públics", icon:"📈",
    children:[
      {id:"mp-resum",        label:"Resum"},
      {id:"mp-rv",           label:"Renda Variable"},
      {id:"mp-rf",           label:"Renda Fixa"},
      {id:"mp-posicions",    label:"Posicions"},
      {id:"mp-transaccions", label:"Transaccions"},
      {id:"mp-traçabilitat", label:"Traçabilitat"},
    ],
  },
];

const TX_LEAVES = [
  {id:"tx-alt", label:"Alternatives",    icon:"💼"},
  {id:"tx-mp",  label:"Mercats Públics", icon:"📈"},
];

const BOTTOM_ITEMS = [
  {id:"guia",  label:"Guia",  icon:"📖", to:"/guia"},
  {id:"admin", label:"Admin", icon:"⚙️",  to:"/admin", adminOnly:true},
];

// ── component ─────────────────────────────────────────────
export function Sidebar({ collapsed, onToggle, activeItem, onNavigate, tc, dark, isAdmin }) {
  const [expanded, setExpanded] = useState(new Set(["alt","re","mp"]));
  const [popover,  setPopover]  = useState(null);

  const toggleSec = id =>
    setExpanded(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });

  const C = {
    bg:           dark ? "#0d1e30" : "#1a3a5c",
    bgHover:      dark ? "#162840" : "#1f4570",
    bgActive:     dark ? "#1a3a5c" : "#2461a0",
    text:         "rgba(255,255,255,0.85)",
    textFade:     "rgba(255,255,255,0.4)",
    groupLabel:   "rgba(255,255,255,0.32)",
    border:       "rgba(255,255,255,0.08)",
    activeBorder: "#3DC83E",
  };

  // ── shared leaf button ──
  function Leaf({ item, indent = false }) {
    const active = activeItem === item.id;
    return (
      <button
        onClick={() => onNavigate(item.id)}
        title={collapsed ? item.label : undefined}
        style={{
          display:"flex", alignItems:"center", gap:9,
          width:"100%", border:"none", cursor:"pointer",
          borderLeft:`3px solid ${active ? C.activeBorder : "transparent"}`,
          padding: collapsed ? "9px 0" : indent ? "8px 16px 8px 32px" : "9px 14px",
          background: active ? C.bgActive : "transparent",
          color: active ? "#fff" : C.text,
          fontSize:12, fontFamily:"inherit",
          justifyContent: collapsed ? "center" : "flex-start",
          transition:"background 0.1s",
        }}
        onMouseEnter={e => { if(!active) e.currentTarget.style.background=C.bgHover; }}
        onMouseLeave={e => { if(!active) e.currentTarget.style.background="transparent"; }}
      >
        {item.icon && <span style={{fontSize:13,flexShrink:0,lineHeight:1}}>{item.icon}</span>}
        {!collapsed && <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.label}</span>}
      </button>
    );
  }

  // ── collapsible section ──
  function Section({ sec }) {
    const open        = expanded.has(sec.id);
    const childActive = sec.children.some(c => c.id === activeItem);

    return (
      <div
        style={{position:"relative"}}
        onMouseEnter={() => collapsed && setPopover(sec.id)}
        onMouseLeave={() => collapsed && setPopover(null)}
      >
        {/* section header */}
        <button
          onClick={() => collapsed ? onNavigate(sec.children[0].id) : toggleSec(sec.id)}
          title={collapsed ? sec.label : undefined}
          style={{
            display:"flex", alignItems:"center", gap:9,
            width:"100%", border:"none", cursor:"pointer",
            borderLeft:`3px solid ${childActive && collapsed ? C.activeBorder : "transparent"}`,
            padding: collapsed ? "10px 0" : "9px 14px",
            background:"transparent",
            color: childActive ? "#fff" : C.text,
            fontSize:12, fontFamily:"inherit", fontWeight:600,
            justifyContent: collapsed ? "center" : "flex-start",
            transition:"background 0.1s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background=C.bgHover; }}
          onMouseLeave={e => { e.currentTarget.style.background="transparent"; }}
        >
          <span style={{fontSize:15,flexShrink:0,lineHeight:1}}>{sec.icon}</span>
          {!collapsed && (
            <>
              <span style={{flex:1,letterSpacing:"0.01em"}}>{sec.label}</span>
              <span style={{fontSize:8,opacity:0.5}}>{open ? "▾" : "▸"}</span>
            </>
          )}
        </button>

        {/* children (expanded) */}
        {!collapsed && open && sec.children.map(c => <Leaf key={c.id} item={c} indent />)}

        {/* popover (collapsed hover) */}
        {collapsed && popover === sec.id && (
          <div style={{
            position:"absolute", left:RAIL_W+6, top:0, zIndex:300,
            background: dark ? "#0d1e30" : "#1a3a5c",
            border:`1px solid ${C.border}`,
            borderRadius:8, padding:"6px 0", minWidth:170,
            boxShadow:"0 6px 24px rgba(0,0,0,.35)",
            pointerEvents:"all",
          }}>
            <div style={{padding:"4px 14px 8px",fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:C.groupLabel}}>
              {sec.label}
            </div>
            {sec.children.map(c => (
              <button key={c.id}
                onClick={() => { onNavigate(c.id); setPopover(null); }}
                style={{
                  display:"block", width:"100%", textAlign:"left",
                  background: activeItem===c.id ? C.bgActive : "transparent",
                  border:"none",
                  borderLeft:`3px solid ${activeItem===c.id ? C.activeBorder : "transparent"}`,
                  padding:"8px 16px", cursor:"pointer",
                  color: activeItem===c.id ? "#fff" : C.text,
                  fontSize:12, fontFamily:"inherit",
                }}
                onMouseEnter={e => { if(activeItem!==c.id) e.currentTarget.style.background=C.bgHover; }}
                onMouseLeave={e => { if(activeItem!==c.id) e.currentTarget.style.background="transparent"; }}
              >{c.label}</button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── group label ──
  function GroupLabel({ label }) {
    if (collapsed) return <div style={{height:12, borderTop:`1px solid ${C.border}`, margin:"4px 8px"}} />;
    return (
      <div style={{padding:"14px 14px 4px",fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:C.groupLabel}}>
        {label}
      </div>
    );
  }

  return (
    <div style={{
      width: collapsed ? RAIL_W : SIDEBAR_W,
      minHeight:"100vh", background:C.bg,
      display:"flex", flexDirection:"column",
      transition:"width 0.2s ease", flexShrink:0, overflowX:"hidden",
      borderRight:`1px solid ${C.border}`,
    }}>
      {/* header */}
      <div style={{
        height:44, display:"flex", alignItems:"center",
        padding: collapsed ? "0" : "0 14px",
        justifyContent: collapsed ? "center" : "space-between",
        borderBottom:`1px solid ${C.border}`, flexShrink:0,
      }}>
        {!collapsed && <span style={{color:"#fff",fontWeight:700,fontSize:13,letterSpacing:"0.05em",whiteSpace:"nowrap"}}>Turtle Capital</span>}
        <button onClick={onToggle} style={{background:"none",border:"none",cursor:"pointer",color:C.text,fontSize:16,padding:6,lineHeight:1,flexShrink:0}}>
          {collapsed ? "☰" : "←"}
        </button>
      </div>

      {/* scrollable nav body */}
      <div style={{flex:1, overflowY:"auto", overflowX:"hidden", padding:"4px 0"}}>

        {/* ── Portfoli group ── */}
        <GroupLabel label="Portfoli" />
        {PORTFOLI_SECTIONS.map(sec => <Section key={sec.id} sec={sec} />)}

        {/* ── Transaccions group ── */}
        <GroupLabel label="Transaccions" />
        {TX_LEAVES.map(item => <Leaf key={item.id} item={item} />)}

      </div>

      {/* bottom links */}
      <div style={{borderTop:`1px solid ${C.border}`, padding:"6px 0", flexShrink:0}}>
        {BOTTOM_ITEMS.filter(i => !i.adminOnly || isAdmin).map(item => (
          <Link key={item.id} to={item.to}
            title={collapsed ? item.label : undefined}
            style={{
              display:"flex", alignItems:"center", gap:9,
              padding: collapsed ? "9px 0" : "9px 14px",
              color:C.text, textDecoration:"none",
              fontSize:12, fontFamily:"inherit",
              justifyContent: collapsed ? "center" : "flex-start",
            }}
          >
            <span style={{fontSize:14,lineHeight:1}}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 — Commit**
```bash
git add src/components/Sidebar.jsx
git commit -m "feat: add Sidebar component"
```

---

## Task 3 — Dashboard shell restructure

**Files:** Modify `src/components/Dashboard.jsx`

This task replaces the three nav bars with the sidebar + slim top bar. Content panels are **not touched** yet.

- [ ] **Step 1 — Add Sidebar import at top of Dashboard.jsx**

After the existing imports, add:
```js
import { Sidebar, SIDEBAR_W, RAIL_W } from "./Sidebar.jsx";
```

- [ ] **Step 2 — Add sidebar state + activeItem computation**

After `const [companiesSubTab, setCompaniesSubTab]` (~line 48), add:
```js
const [sidebarCollapsed, setSidebarCollapsed] = usePersistedState("ui_sidebarCollapsed", false);
const [activeNavItem,    setActiveNavItem]     = usePersistedState("ui_navItem", "fons");
```

- [ ] **Step 3 — Add handleNavigate function**

After the `handleCCDelete` function block (~line 113), add:
```js
function handleNavigate(itemId) {
  setActiveNavItem(itemId);
  switch (itemId) {
    case "fons":           setTab("pipeline"); break;
    case "searchers":      setTab("searchers"); break;
    case "companies":      setTab("companies"); break;
    case "posicions":      setTab("inversions"); break;
    case "re-directe":     setTab("real-estate");     setRealEstateTab("directe"); break;
    case "re-altres":      setTab("real-estate");     setRealEstateTab("altres-vehicles"); break;
    case "mp-resum":       setTab("mercats-publics"); setMercatsPublicsTab("resum"); break;
    case "mp-rv":          setTab("mercats-publics"); setMercatsPublicsTab("rv"); break;
    case "mp-rf":          setTab("mercats-publics"); setMercatsPublicsTab("rf"); break;
    case "mp-posicions":   setTab("mercats-publics"); setMercatsPublicsTab("posicions"); break;
    case "mp-transaccions":setTab("mercats-publics"); setMercatsPublicsTab("transaccions"); break;
    case "mp-traçabilitat":setTab("mercats-publics"); setMercatsPublicsTab("traçabilitat"); break;
    case "tx-alt":         setTab("tx-alt"); break;
    case "tx-mp":          setTab("mercats-publics"); setMercatsPublicsTab("transaccions"); break;
    default: break;
  }
}
```

- [ ] **Step 4 — Update section derivation**

Find (line ~309):
```js
const section = (tab==="mercats-publics"||tab==="real-estate") ? tab : "alternatives";
```
Replace with:
```js
const section = tab==="mercats-publics" ? "mercats-publics"
              : tab==="real-estate"     ? "real-estate"
              : tab==="tx-alt"          ? "transaccions"
              : "alternatives";
```

- [ ] **Step 5 — Remove old supra derivation dependency on "txlog"**

`supra` is currently:
```js
const supra = tab==="searchers"?"searchers":tab==="companies"?"companies":tab==="inversions"?"inversions":tab==="txlog"?"txlog":"fons";
```
Replace with (remove txlog branch, add fons-tx → fons):
```js
const supra = tab==="searchers"?"searchers"
            : tab==="companies"?"companies"
            : tab==="inversions"?"inversions"
            : "fons";
```

Also remove `{id:"txlog", label:"Transaccions"}` from `SUPRA_ALL` (~line 472). The resulting `SUPRA_ALL`:
```js
const SUPRA_ALL = [
  {id:"fons",       label:"Fons"},
  {id:"searchers",  label:"Searchers"},
  {id:"companies",  label:"Participades"},
  {id:"inversions", label:"Totes les Posicions"},
];
```

- [ ] **Step 6 — Replace the full outer JSX with sidebar layout**

The current `return (` opens with:
```jsx
<div id="dashboard-content" style={{minHeight:"100vh",background:tc.bg,...}}>
  {/* ── Header ── */}
  <div className="tab-bar no-print" style={{...wide header...}}>
    ...Logo, search, Guia, Admin, Excel, dark mode, sign out...
  </div>

  {/* ── Section nav ── */}
  ...

  {/* ── Supra nav ── */}
  ...

  {/* ── Sub-tabs (Searchers) ── */}
  ...
  {/* ── Sub-tabs (Companies) ── */}
  ...
  {/* ── Sub-tabs (Inversions) ── */}
  ...
  {/* ── Sub-tabs (Mercats Públics) ── */}
  ...
  {/* ── Sub-tabs (Real Estate) ── */}
  ...
  {/* ── Sub-tabs (Fons only) ── */}
  ...

  <div className="page-pad" style={{padding:"22px 32px 60px"}}>
    ...content panels...
  </div>
</div>
```

Replace everything from `return (` down to (but not including) `{/* ── PIPELINE ── */}` with:

```jsx
return (
  <div id="dashboard-content" style={{display:"flex",minHeight:"100vh",background:tc.bg,color:tc.text,fontFamily:"'Outfit',system-ui,sans-serif",fontSize:14,letterSpacing:"0.005em"}}>

    {/* ── Sidebar ── */}
    <Sidebar
      collapsed={sidebarCollapsed}
      onToggle={() => setSidebarCollapsed(c => !c)}
      activeItem={activeNavItem}
      onNavigate={handleNavigate}
      tc={tc}
      dark={dark}
      isAdmin={isAdmin}
    />

    {/* ── Main column ── */}
    <div style={{flex:1, display:"flex", flexDirection:"column", minWidth:0}}>

      {/* ── Slim top bar ── */}
      <div className="no-print" style={{
        height:44, display:"flex", alignItems:"center", gap:8,
        padding:"0 18px", background:tc.card,
        borderBottom:`1px solid ${tc.border}`,
        flexShrink:0, boxShadow:"0 1px 0 rgba(0,0,0,.06)",
      }}>
        <input
          value={globalSearch}
          onChange={e=>{setGlobalSearch(e.target.value);setTxPage(0);}}
          placeholder="Cerca…"
          style={{padding:"5px 12px",borderRadius:7,border:`1.5px solid ${tc.border}`,background:tc.bg,color:tc.text,fontSize:12,fontFamily:"inherit",width:200,outline:"none"}}
        />
        {globalSearch&&(
          <button onClick={()=>{setGlobalSearch("");setTxPage(0);}}
            style={{background:"transparent",border:"none",cursor:"pointer",fontSize:13,color:tc.textLight,padding:"0 2px",lineHeight:1,marginLeft:-4}}>
            ✕
          </button>
        )}
        {section==="alternatives"&&supra==="fons"&&tab!=="pipeline"&&(
          <FonsSelector excluded={excluded} setExcluded={setExcluded} rawCC={rawCC}/>
        )}
        <div style={{flex:1}}/>
        <button onClick={()=>setShowLoader(true)}
          style={{background:tc.navy,color:"#fff",border:"none",borderRadius:7,padding:"5px 12px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>
          ↑ Carregar dades
        </button>
        <button onClick={exportAll} disabled={exporting}
          style={{background:"transparent",border:`1.5px solid ${tc.border}`,borderRadius:7,padding:"5px 10px",cursor:exporting?"not-allowed":"pointer",fontSize:11,color:tc.textMid,fontFamily:"inherit",opacity:exporting?0.6:1}}>
          {exporting?"…":"↓ Excel"}
        </button>
        <button onClick={exportPDF}
          style={{background:"transparent",border:`1.5px solid ${tc.border}`,borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:11,color:tc.textMid,fontFamily:"inherit"}}>
          ↓ PDF
        </button>
        <button onClick={exportPNG} disabled={exporting}
          style={{background:"transparent",border:`1.5px solid ${tc.border}`,borderRadius:7,padding:"5px 10px",cursor:exporting?"wait":"pointer",fontSize:11,color:tc.textMid,fontFamily:"inherit"}}>
          {exporting?"…":"↓ PNG"}
        </button>
        <button onClick={toggleDark}
          style={{background:"transparent",border:`1.5px solid ${tc.border}`,borderRadius:7,padding:"5px 8px",cursor:"pointer",fontSize:15,color:tc.textMid,fontFamily:"inherit"}}>
          {dark?"☀️":"🌙"}
        </button>
        <button onClick={signOut}
          style={{background:"transparent",border:`1.5px solid ${tc.border}`,borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:11,color:tc.textMid,fontFamily:"inherit",fontWeight:600}}>
          Sortir
        </button>
      </div>

      {/* ── Sub-tab bars (only Fons section) ── */}
      {section==="alternatives"&&supra==="fons"&&(
      <div className="tab-bar no-print" style={{background:tc.card,borderBottom:`1px solid ${tc.border}`,padding:"0 24px",display:"flex",gap:0,alignItems:"center"}}>
        <div style={{display:"flex",flex:1}}>
          {TABS_FONS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{background:"none",border:"none",borderBottom:`2px solid ${tab===t.id?tc.green:"transparent"}`,padding:"10px 18px",cursor:"pointer",fontSize:12,fontWeight:tab===t.id?600:400,color:tab===t.id?tc.navy:tc.textMid,fontFamily:"inherit",whiteSpace:"nowrap",letterSpacing:"0.01em"}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* ── Sub-tab bars (Searchers) ── */}
      {section==="alternatives"&&supra==="searchers"&&(
      <div className="tab-bar no-print" style={{background:tc.card,borderBottom:`1px solid ${tc.border}`,padding:"0 24px",display:"flex"}}>
        {[{id:"tots",label:"Tots"},{id:"actius",label:"Actius"},{id:"transaccions",label:"Transaccions"}].map(s=>(
          <button key={s.id} onClick={()=>setSearchersSubTab(s.id)}
            style={{background:"none",border:"none",borderBottom:`2px solid ${searchersSubTab===s.id?tc.green:"transparent"}`,padding:"10px 18px",cursor:"pointer",fontSize:12,fontWeight:searchersSubTab===s.id?600:400,color:searchersSubTab===s.id?tc.navy:tc.textMid,fontFamily:"inherit",whiteSpace:"nowrap"}}>
            {s.label}
          </button>
        ))}
      </div>
      )}

      {/* ── Sub-tab bars (Companies/Participades) ── */}
      {section==="alternatives"&&supra==="companies"&&(
      <div className="tab-bar no-print" style={{background:tc.card,borderBottom:`1px solid ${tc.border}`,padding:"0 24px",display:"flex"}}>
        {[{id:"totes",label:"Totes"},{id:"search-funds",label:"Search Funds"},{id:"altres",label:"Altres"},{id:"transaccions",label:"Transaccions"}].map(s=>(
          <button key={s.id} onClick={()=>setCompaniesSubTab(s.id)}
            style={{background:"none",border:"none",borderBottom:`2px solid ${companiesSubTab===s.id?tc.green:"transparent"}`,padding:"10px 18px",cursor:"pointer",fontSize:12,fontWeight:companiesSubTab===s.id?600:400,color:companiesSubTab===s.id?tc.navy:tc.textMid,fontFamily:"inherit",whiteSpace:"nowrap"}}>
            {s.label}
          </button>
        ))}
      </div>
      )}

      {/* ── Sub-tab bars (Totes les Posicions) ── */}
      {section==="alternatives"&&supra==="inversions"&&(
      <div className="tab-bar no-print" style={{background:tc.card,borderBottom:`1px solid ${tc.border}`,padding:"0 24px",display:"flex"}}>
        {[{id:"fons",label:"Fons"},{id:"companies",label:"Participades"}].map(s=>(
          <button key={s.id} onClick={()=>setInversionsSubTab(s.id)}
            style={{background:"none",border:"none",borderBottom:`2px solid ${inversionsSubTab===s.id?tc.green:"transparent"}`,padding:"10px 18px",cursor:"pointer",fontSize:12,fontWeight:inversionsSubTab===s.id?600:400,color:inversionsSubTab===s.id?tc.navy:tc.textMid,fontFamily:"inherit",whiteSpace:"nowrap"}}>
            {s.label}
          </button>
        ))}
      </div>
      )}

      {/* ── Content area ── */}
      <div className="page-pad" style={{flex:1,overflowY:"auto",padding:"22px 28px 60px"}}>
```

Then at the very **end** of the return, close the new wrapper divs. Find the closing structure and add `</div>{/* main column */}</div>{/* dashboard-content */}` to match the new nesting.

- [ ] **Step 7 — Remove the inline PDF/PNG export button row inside page-pad**

Find and remove (~line 681-690):
```jsx
<div className="no-print" style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:16}}>
  <button onClick={exportPDF} ...>↓ PDF</button>
  <button onClick={exportPNG} ...>{exporting?"…":"↓ PNG"}</button>
</div>
```
These are now in the top bar.

- [ ] **Step 8 — Commit**
```bash
git add src/components/Dashboard.jsx
git commit -m "feat: sidebar layout shell + slim top bar"
```

---

## Task 4 — vcpe-filtered derived data

**Files:** Modify `src/components/Dashboard.jsx`

- [ ] **Step 1 — Scope baseTx/baseCompr to PE/VC only**

Find (~line 305):
```js
const baseTx    = useMemo(()=>TRANSACTIONS.filter(r=>!excluded.has(r.fons)),[TRANSACTIONS,excluded]);
const baseCompr = useMemo(()=>COMPROMISOS.filter(r=>!excluded.has(r.fons)),[COMPROMISOS,excluded]);
```
Replace with:
```js
const baseTx    = useMemo(()=>TRANSACTIONS.filter(r=>!excluded.has(r.fons)&&(r.vcpe==="PE"||r.vcpe==="VC")),[TRANSACTIONS,excluded]);
const baseCompr = useMemo(()=>COMPROMISOS.filter(r=>!excluded.has(r.fons)&&(r.vcpe==="PE"||r.vcpe==="VC")),[COMPROMISOS,excluded]);
```

- [ ] **Step 2 — Add slices for SF/PC/RE and all-alternatives**

Immediately after the two lines above, add:
```js
const sfTx    = useMemo(()=>TRANSACTIONS.filter(r=>r.vcpe==="SF"),[TRANSACTIONS]);
const sfCompr = useMemo(()=>COMPROMISOS.filter(r=>r.vcpe==="SF"),[COMPROMISOS]);
const pcTx    = useMemo(()=>TRANSACTIONS.filter(r=>r.vcpe==="PC"),[TRANSACTIONS]);
const pcCompr = useMemo(()=>COMPROMISOS.filter(r=>r.vcpe==="PC"),[COMPROMISOS]);
const reTx    = useMemo(()=>TRANSACTIONS.filter(r=>r.vcpe==="RE"),[TRANSACTIONS]);
const reCompr = useMemo(()=>COMPROMISOS.filter(r=>r.vcpe==="RE"),[COMPROMISOS]);
const allAltTx= useMemo(()=>TRANSACTIONS.filter(r=>!excluded.has(r.fons)),[TRANSACTIONS,excluded]);
```

- [ ] **Step 3 — Commit**
```bash
git add src/components/Dashboard.jsx
git commit -m "feat: vcpe-filtered derived data slices"
```

---

## Task 5 — Transactions sub-tabs for Searchers + Participades

**Files:** Modify `src/components/Dashboard.jsx` (content rendering section)

- [ ] **Step 1 — Add Searchers transactions render**

Find (~line 696):
```jsx
{tab==="searchers"&&<div className="tab-panel"><SearchersTab search={globalSearch} subTab={searchersSubTab}/></div>}
```
Replace with:
```jsx
{tab==="searchers"&&searchersSubTab!=="transaccions"&&(
  <div className="tab-panel"><SearchersTab search={globalSearch} subTab={searchersSubTab}/></div>
)}
{tab==="searchers"&&searchersSubTab==="transaccions"&&(
  <div className="tab-panel">
    <TxSection tx={sfTx} compr={sfCompr} catCfg={catCfg} vcpeCfg={vcpeCfg} tc={tc} dark={dark} canEdit={canEdit}
      onAdd={()=>setCcAddModalFons("")} onEdit={r=>setCcEditModalRow(r)} onDelete={r=>handleCCDelete(r._rowId)}
      title="Transaccions · Searchers" vcpeDefault="SF" rawCC={rawCC} />
  </div>
)}
```

- [ ] **Step 2 — Add Participades transactions render**

Find (~line 699):
```jsx
{tab==="companies"&&<div className="tab-panel"><PortfolioCompaniesTab .../></div>}
```
Replace with:
```jsx
{tab==="companies"&&companiesSubTab!=="transaccions"&&(
  <div className="tab-panel"><PortfolioCompaniesTab search={globalSearch} tipusFilter={companiesSubTab==="search-funds"?"SF":companiesSubTab==="altres"?"altres":null}/></div>
)}
{tab==="companies"&&companiesSubTab==="transaccions"&&(
  <div className="tab-panel">
    <TxSection tx={pcTx} compr={pcCompr} catCfg={catCfg} vcpeCfg={vcpeCfg} tc={tc} dark={dark} canEdit={canEdit}
      onAdd={()=>setCcAddModalFons("")} onEdit={r=>setCcEditModalRow(r)} onDelete={r=>handleCCDelete(r._rowId)}
      title="Transaccions · Participades" vcpeDefault="PC" rawCC={rawCC} />
  </div>
)}
```

- [ ] **Step 3 — Create TxSection helper component**

`TxSection` is a thin wrapper that renders a section title + the existing inline txlog table style. Add it at the top of `Dashboard.jsx` (before `DashboardInner`, after the imports):

```jsx
function TxSection({ tx, compr, catCfg, vcpeCfg, tc, dark, canEdit, onAdd, title, vcpeDefault, rawCC }) {
  const [sortK, setSortK] = React.useState("data");
  const [sortD, setSortD] = React.useState("desc");
  const sorted = [...tx].sort((a,b)=>{
    let va=a[sortK],vb=b[sortK];
    if(typeof va==="string") return sortD==="asc"?va.localeCompare(vb):vb.localeCompare(va);
    return sortD==="asc"?va-vb:vb-va;
  });
  const Arr = ({k})=><span style={{marginLeft:3,opacity:sortK===k?1:0.25,fontSize:9}}>{sortK===k&&sortD==="asc"?"▲":"▼"}</span>;
  const sort = k=>{if(sortK===k)setSortD(d=>d==="asc"?"desc":"asc");else{setSortK(k);setSortD("desc");}};
  const th={padding:"8px 10px",fontSize:10,letterSpacing:"0.09em",color:tc.textLight,textTransform:"uppercase",fontWeight:600,whiteSpace:"nowrap",userSelect:"none",cursor:"pointer"};

  const gCalls = tx.filter(r=>r.cat==="Capital Call").reduce((s,r)=>s+r.eur,0);
  const gDist  = tx.filter(r=>r.cat==="Distribució"||r.cat==="Retorn Capital").reduce((s,r)=>s+Math.abs(r.eur),0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* KPIs */}
      <div style={{display:"flex",gap:12}}>
        {[
          {label:"Total Cridat",   value:fmtM(gCalls)},
          {label:"Total Rebut",    value:fmtM(gDist)},
          {label:"Flux Net",       value:fmtM(Math.abs(gDist-gCalls)), sub:gDist>=gCalls?"positiu":"pendent"},
        ].map((k,i)=>(
          <div key={i} style={{background:tc.card,border:`1px solid ${tc.border}`,borderRadius:10,padding:"14px 18px",flex:1,boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
            <div style={{fontSize:10,letterSpacing:"0.11em",color:tc.textLight,textTransform:"uppercase",marginBottom:4,fontWeight:600}}>{k.label}</div>
            <div style={{fontSize:20,fontWeight:700,color:tc.navy,fontFamily:"'DM Mono',monospace"}}>{k.value}</div>
            {k.sub&&<div style={{fontSize:11,color:tc.textLight,marginTop:2}}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{background:tc.card,border:`1px solid ${tc.border}`,borderRadius:10,padding:"18px",boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.11em",textTransform:"uppercase",color:tc.textLight}}>{title}</div>
          {canEdit&&(
            <button onClick={onAdd}
              style={{padding:"5px 14px",borderRadius:6,border:`1.5px solid ${tc.green}`,background:dark?"#0A2010":"#E8F8E8",color:tc.green,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:700}}>
              ＋ Afegeix
            </button>
          )}
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:tc.bgAlt}}>
                {[{k:"data",l:"Data"},{k:"fons",l:"Vehicle"},{k:"tipus",l:"Tipus"},{k:"cat",l:"Categoria"},{k:"eur",l:"Import EUR",r:true},{k:"fy",l:"FY"}].map(h=>(
                  <th key={h.k} onClick={()=>sort(h.k)} style={{...th,textAlign:h.r?"right":"left",borderBottom:`2px solid ${tc.border}`}}>
                    {h.l}<Arr k={h.k}/>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length===0&&<tr><td colSpan={6} style={{padding:"24px",textAlign:"center",color:tc.textLight,fontSize:13}}>Cap transacció</td></tr>}
              {sorted.map((r,i)=>{
                const cfg=catCfg[r.cat]||{};
                return(
                  <tr key={i} style={{borderBottom:`1px solid ${tc.bgAlt}`,background:i%2===0?tc.card:tc.bgAlt}}>
                    <td style={{padding:"8px 10px",fontSize:11,color:tc.textMid,whiteSpace:"nowrap"}}>{r.data}</td>
                    <td style={{padding:"8px 10px",fontWeight:600,color:tc.text,fontSize:12,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.fons}</td>
                    <td style={{padding:"8px 10px",fontSize:11,color:tc.textMid,whiteSpace:"nowrap"}}>{r.tipus}</td>
                    <td style={{padding:"8px 10px"}}><span style={{fontSize:11,background:cfg.bg||tc.bgAlt,color:cfg.color||tc.textMid,borderRadius:5,padding:"2px 8px",fontWeight:600,whiteSpace:"nowrap"}}>{r.cat}</span></td>
                    <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:r.eur>0?tc.navy:tc.green}}>{r.eur<0&&"+ "}{fmtM(Math.abs(r.eur))}</td>
                    <td style={{padding:"8px 10px",fontSize:11,color:tc.textMid,whiteSpace:"nowrap"}}>{r.fy}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{borderTop:`2px solid ${tc.border}`,background:tc.bgAlt}}>
                <td colSpan={4} style={{padding:"8px 10px",fontSize:12,fontWeight:700}}>{sorted.length} transaccions</td>
                <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontWeight:700,color:tc.navy,fontSize:12}}>
                  {fmtM(tx.filter(r=>r.eur>0).reduce((s,r)=>s+r.eur,0))} cridat
                  {tx.some(r=>r.eur<0)&&<span style={{color:tc.green,marginLeft:8}}>{fmtM(tx.filter(r=>r.eur<0).reduce((s,r)=>s+Math.abs(r.eur),0))} rebut</span>}
                </td>
                <td/>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4 — Commit**
```bash
git add src/components/Dashboard.jsx
git commit -m "feat: transactions sub-tabs for Searchers and Participades"
```

---

## Task 6 — Add Fons transactions sub-tab + tx-alt top-level view

**Files:** Modify `src/components/Dashboard.jsx`

- [ ] **Step 1 — Add Transaccions to TABS_CC**

Find (~line 457):
```js
const TABS_CC = [
  {id:"resum",   label:"📊 Resum Anual"},
  {id:"mensual", label:"📈 Detall Mensual"},
  {id:"fons",    label:"🏦 Per Fons"},
];
```
Replace with:
```js
const TABS_CC = [
  {id:"resum",   label:"📊 Resum Anual"},
  {id:"mensual", label:"📈 Detall Mensual"},
  {id:"fons",    label:"🏦 Per Fons"},
  {id:"fons-tx", label:"💸 Transaccions"},
];
```

- [ ] **Step 2 — Add fons-tx render**

After the existing `{tab==="txlog"&&...}` block (~line 1140), add:
```jsx
{/* ── FONS TRANSACTIONS ── */}
{tab==="fons-tx"&&(
  <div className="tab-panel">
    <TxSection tx={baseTx} compr={baseCompr} catCfg={catCfg} vcpeCfg={vcpeCfg} tc={tc} dark={dark} canEdit={canEdit}
      onAdd={()=>setCcAddModalFons("")} onEdit={r=>setCcEditModalRow(r)} onDelete={r=>handleCCDelete(r._rowId)}
      title="Transaccions · Fons" vcpeDefault="PE" rawCC={rawCC} />
  </div>
)}
```

- [ ] **Step 3 — Add tx-alt top-level render**

Immediately after the fons-tx block:
```jsx
{/* ── TRANSACCIONS › ALTERNATIVES ── */}
{tab==="tx-alt"&&(
  <div className="tab-panel">
    <TxSection tx={allAltTx} compr={[]} catCfg={catCfg} vcpeCfg={vcpeCfg} tc={tc} dark={dark} canEdit={canEdit}
      onAdd={()=>setCcAddModalFons("")} onEdit={r=>setCcEditModalRow(r)} onDelete={r=>handleCCDelete(r._rowId)}
      title="Totes les Transaccions · Alternatives" vcpeDefault="PE" rawCC={rawCC} />
  </div>
)}
```

- [ ] **Step 4 — Commit**
```bash
git add src/components/Dashboard.jsx
git commit -m "feat: fons-tx sub-tab + tx-alt top-level transactions view"
```

---

## Task 7 — Real Estate Altres Vehicles content

**Files:** Modify `src/components/Dashboard.jsx`

- [ ] **Step 1 — Build RE_FONS_MAP derived from reTx/reCompr**

After the `FONS_MAP2` useMemo (~line 386), add:
```js
const RE_FONS_MAP = useMemo(()=>{
  const m={};
  reCompr.forEach(r=>{m[r.id??r.fons]={id:r.id??null,fons:r.fons,compr:r.eur,calls:0,dist:0,retorn:0};});
  reTx.forEach(r=>{
    const k=r.id??r.fons;
    if(!m[k])m[k]={id:r.id??null,fons:r.fons,compr:0,calls:0,dist:0,retorn:0};
    if(r.cat==="Capital Call")   m[k].calls  +=r.eur;
    if(r.cat==="Distribució")    m[k].dist   +=Math.abs(r.eur);
    if(r.cat==="Retorn Capital") m[k].retorn +=Math.abs(r.eur);
  });
  return Object.values(m).sort((a,b)=>b.compr-a.compr);
},[reCompr,reTx]);
```

- [ ] **Step 2 — Replace Real Estate Altres Vehicles placeholder**

Find (~line 729):
```jsx
{tab==="real-estate"&&realEstateTab==="altres-vehicles"&&(
  <div className="tab-panel" style={{display:"flex",flexDirection:"column",alignItems:"center",...}}>
    <div style={{fontSize:32}}>🏗️</div>
    <div ...>Real Estate · Altres Vehicles</div>
    <div ...>Pròximament</div>
  </div>
)}
```
Replace with:
```jsx
{tab==="real-estate"&&realEstateTab==="altres-vehicles"&&(
  <div className="tab-panel">
    {/* KPIs */}
    <div style={{display:"flex",gap:12,marginBottom:18}}>
      {[
        {label:"Compromís",  value:fmtM(reCompr.reduce((s,r)=>s+r.eur,0))},
        {label:"Cridat",     value:fmtM(reTx.filter(r=>r.cat==="Capital Call").reduce((s,r)=>s+r.eur,0))},
        {label:"Distribuït", value:fmtM(reTx.filter(r=>r.cat==="Distribució"||r.cat==="Retorn Capital").reduce((s,r)=>s+Math.abs(r.eur),0))},
      ].map((k,i)=>(
        <div key={i} style={{background:tc.card,border:`1px solid ${tc.border}`,borderRadius:10,padding:"14px 18px",flex:1,boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
          <div style={{fontSize:10,letterSpacing:"0.11em",color:tc.textLight,textTransform:"uppercase",marginBottom:4,fontWeight:600}}>{k.label}</div>
          <div style={{fontSize:20,fontWeight:700,color:tc.navy,fontFamily:"'DM Mono',monospace"}}>{k.value}</div>
        </div>
      ))}
    </div>
    {/* Fund table */}
    <div style={{background:tc.card,border:`1px solid ${tc.border}`,borderRadius:10,padding:"18px",boxShadow:"0 2px 8px rgba(0,0,0,.06)",marginBottom:18}}>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.11em",textTransform:"uppercase",color:tc.textLight,marginBottom:14}}>Vehicles Real Estate</div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:tc.bgAlt}}>
            {["Vehicle","Compromís","Cridat","Distribuït","Retorn","Net"].map(h=>(
              <th key={h} style={{padding:"8px 12px",fontSize:10,letterSpacing:"0.09em",color:tc.textLight,textTransform:"uppercase",fontWeight:600,borderBottom:`2px solid ${tc.border}`,textAlign:h==="Vehicle"?"left":"right",whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {RE_FONS_MAP.length===0&&<tr><td colSpan={6} style={{padding:"24px",textAlign:"center",color:tc.textLight,fontSize:13}}>Cap vehicle</td></tr>}
            {RE_FONS_MAP.map((f,i)=>(
              <tr key={f.fons} style={{borderBottom:`1px solid ${tc.bgAlt}`,background:i%2===0?tc.card:tc.bgAlt}}>
                <td style={{padding:"9px 12px",fontWeight:600,fontSize:13}}>{f.fons}</td>
                {[f.compr,f.calls,f.dist,f.retorn,(f.dist+f.retorn-f.calls)].map((v,vi)=>(
                  <td key={vi} style={{padding:"9px 12px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:vi===4?(v>=0?tc.green:tc.navy):tc.navy}}>{fmtM(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    {/* Transactions */}
    <TxSection tx={reTx} compr={reCompr} catCfg={catCfg} vcpeCfg={vcpeCfg} tc={tc} dark={dark} canEdit={canEdit}
      onAdd={()=>setCcAddModalFons("")} onEdit={r=>setCcEditModalRow(r)} onDelete={r=>handleCCDelete(r._rowId)}
      title="Transaccions · Real Estate" vcpeDefault="RE" rawCC={rawCC} />
  </div>
)}
```

- [ ] **Step 3 — Commit**
```bash
git add src/components/Dashboard.jsx
git commit -m "feat: Real Estate Altres Vehicles fund table + transactions"
```

---

## Task 8 — Fix PMTipusTab secLabel font size

**Files:** Modify `src/components/PMTipusTab.jsx:80`

- [ ] **Step 1 — Update secLabel**

Find:
```js
const secLabel = { fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 12 };
```
Replace with:
```js
const secLabel = { fontSize: 11, letterSpacing: "0.11em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 12 };
```

- [ ] **Step 2 — Commit**
```bash
git add src/components/PMTipusTab.jsx
git commit -m "fix: standardise PM secLabel font size to match Alternatius"
```

---

## Task 9 — Cleanup + old txlog backward compat

**Files:** Modify `src/components/Dashboard.jsx`

- [ ] **Step 1 — Migrate persisted "txlog" tab value to tx-alt**

In `DashboardInner`, add a one-time migration effect after the state declarations:
```js
useEffect(() => {
  if (tab === "txlog") {
    setTab("tx-alt");
    setActiveNavItem("tx-alt");
  }
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2 — Remove old `{tab==="txlog"&&...}` render block**

Find the existing `{/* ── TRANSACCIONS ── */}` block that starts with `{tab==="txlog"&&(`. Delete the entire block (it's been superseded by tx-alt in Task 6).

- [ ] **Step 3 — Verify keyboard navigation still works**

The arrow-key navigation block (~line 500) references `TABS_FONS`. After adding `fons-tx` to `TABS_CC`, this automatically gains keyboard navigation. Verify the `supra` derivation covers the fons supra group correctly: since `fons-tx` maps to `supra="fons"`, ArrowLeft/Right within Fons sub-tabs will cycle through all of them including `fons-tx`. No code change needed.

- [ ] **Step 4 — Commit**
```bash
git add src/components/Dashboard.jsx
git commit -m "chore: remove old txlog block, add tab migration for persisted state"
```

---

## Self-review

**Spec coverage check:**
- ✅ Persistent left sidebar (Tasks 2, 3)
- ✅ Icon rail collapsed state with popovers (Task 2)
- ✅ Slim top bar with all utilities (Task 3)
- ✅ Portfoli group: Alternatius/RE/MP (Task 2)
- ✅ Transaccions group: Alternatives + MP (Tasks 2, 6)
- ✅ Pipeline inside Fons sub-tabs — unchanged, stays as first TABS_FONS item ✅
- ✅ Fons sub-tabs: Pipeline·Resum·Mensual·Per Fons·Transaccions (Task 6)
- ✅ Searchers sub-tabs + transactions (Tasks 3, 5)
- ✅ Participades sub-tabs + transactions (Tasks 3, 5)
- ✅ Totes les Posicions label (Task 3 — SUPRA_ALL rename)
- ✅ RE Altres Vehicles fund table + transactions (Task 7)
- ✅ SF/PC vcpe types (Task 1)
- ✅ vcpe routing (Task 4)
- ✅ PM secLabel font fix (Task 8)
- ✅ Backward compat for old "txlog" persisted state (Task 9)

**Placeholder scan:** No TBDs. All code blocks complete.

**Type consistency:** `TxSection` defined in Task 5 Step 3, called in Tasks 5, 6, 7 with identical props signature. `allAltTx` defined in Task 4, used in Task 6. `RE_FONS_MAP` defined in Task 7. `sfTx/sfCompr/pcTx/pcCompr/reTx/reCompr` defined in Task 4, used in Tasks 5, 7.
