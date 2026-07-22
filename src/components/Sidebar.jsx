// src/components/Sidebar.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { TC_LIGHT } from "../theme.js";
import { Briefcase, Building2, Search, Building, Home, TrendingUp, BookOpen, Users, DollarSign, Menu, ChevronLeft, LineChart } from "lucide-react";

const SIDEBAR_W = 220;
const RAIL_W    = 52;

// ── nav tree ─────────────────────────────────────────────
const PORTFOLI_SECTIONS = [
  {
    id:"alt", label:"Alternatius", icon:Briefcase,
    children:[
      {id:"alt-resum",      label:"Resum",       icon:LineChart},
      {id:"fons",           label:"Fons",        icon:Building2},
      {id:"searchers",      label:"Searchers",   icon:Search},
      {id:"companies",      label:"Participades",icon:Building},
      {id:"alt-cash-model", label:"Model",       icon:LineChart},
    ],
  },
  {
    id:"re", label:"Real Estate", icon:Home,
    children:[
      {id:"re-directe",    label:"Directe"},
      {id:"re-altres",     label:"Vehicles Real Estate"},
      {id:"re-inversions", label:"Totes les Posicions"},
      {id:"re-cash-model", label:"Model"},
    ],
  },
  {
    id:"mp", label:"Mercats Públics", icon:TrendingUp,
    children:[
      {id:"mp-resum",        label:"Resum"},
      {id:"mp-rv",           label:"Renda Variable"},
      {id:"mp-rf",           label:"Renda Fixa"},
      {id:"mp-posicions",    label:"Posicions"},
      {id:"mp-transaccions", label:"Transaccions"},
      {id:"mp-traçabilitat", label:"Traçabilitat"},
    ],
  },
  {
    id:"cm", label:"Model Caixa", icon:LineChart,
    children:[
      {id:"alt-cash-model", label:"Alternatius"},
      {id:"re-cash-model",  label:"Real Estate"},
    ],
  },
];

const TX_LEAVES = [
  {id:"tx-alt", label:"Alternatius",    icon:DollarSign},
  {id:"tx-re",  label:"Real Estate",    icon:DollarSign},
  {id:"tx-mp",  label:"Mercats Públics", icon:DollarSign},
];

const BOTTOM_ITEMS = [
  {id:"guia",  label:"Guia",  icon:BookOpen, to:"/guia"},
  {id:"admin", label:"Admin", icon:Users,  to:"/admin", adminOnly:true},
];

// ── component ─────────────────────────────────────────────
export function Sidebar({ collapsed, onToggle, activeItem, activeNavItem, onNavigate, tc = TC_LIGHT, dark, isAdmin, canAccessSection }) {
  const [expanded, setExpanded] = useState(new Set(["alt","re","mp"]));
  const [popover,  setPopover]  = useState(null);
  const activeId = activeItem ?? activeNavItem;

  const toggleSec = id =>
    setExpanded(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });

  const C = {
    bg:           dark ? "#0E1B27" : "#1C3650",
    bgHover:      dark ? "#142030" : "#22425F",
    bgActive:     dark ? "#1A2E42" : "#0F2A44",
    text:         "rgba(255,255,255,0.80)",
    textFade:     "rgba(255,255,255,0.36)",
    groupLabel:   "rgba(255,255,255,0.28)",
    border:       "rgba(255,255,255,0.07)",
    activeBorder: "#3DC83E",
  };

  // ── shared leaf button ──
  function Leaf({ item, indent = false }) {
    const active = activeId === item.id;
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
        {item.icon && (() => { const Icon = item.icon; return <Icon size={16} strokeWidth={1.75} color={active ? tc.green : tc.textLight} style={{flexShrink:0}} />; })()}
        {!collapsed && <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.label}</span>}
      </button>
    );
  }

  // ── collapsible section ──
  function Section({ sec }) {
    const visibleChildren = sec.children.filter((child) => {
      if (sec.id === "alt") {
        if (child.id === "searchers") return canAccessSection?.("alternatives") ?? true;
        if (child.id === "alt-cash-model") return canAccessSection?.("cash-model") ?? true;
        if (child.id === "alt-resum") return canAccessSection?.("fons") ?? true;
        return canAccessSection?.(child.id === "posicions" ? "inversions" : child.id) ?? true;
      }
      if (sec.id === "re") {
        if (child.id === "re-cash-model") return canAccessSection?.("cash-model") ?? true;
        return canAccessSection?.(child.id) ?? true;
      }
      if (sec.id === "mp") return canAccessSection?.(child.id) ?? true;
      if (sec.id === "cm") return canAccessSection?.("cash-model") ?? true;
      return true;
    });
    if (visibleChildren.length === 0) return null;

    const open = expanded.has(sec.id);
    const childActive = visibleChildren.some(c => c.id === activeId);

    return (
      <div
        style={{position:"relative"}}
        onMouseEnter={() => collapsed && setPopover(sec.id)}
        onMouseLeave={() => collapsed && setPopover(null)}
      >
        {/* section header */}
        <button
          onClick={() => collapsed ? onNavigate(visibleChildren[0].id) : toggleSec(sec.id)}
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
          {(() => { const Icon = sec.icon; return <Icon size={16} strokeWidth={1.75} color={childActive ? tc.green : tc.textLight} style={{flexShrink:0}} />; })()}
          {!collapsed && (
            <>
              <span style={{flex:1,letterSpacing:"0.01em"}}>{sec.label}</span>
              <span style={{fontSize:8,opacity:0.5}}>{open ? "▾" : "▸"}</span>
            </>
          )}
        </button>

        {/* children (expanded) */}
        {!collapsed && open && visibleChildren.map(c => <Leaf key={c.id} item={c} indent />)}

        {/* popover (collapsed hover) */}
        {collapsed && popover === sec.id && (
          <div style={{
            position:"absolute", left:RAIL_W+6, top:0, zIndex:300,
            background: dark ? "#0d1e30" : "#1a3a5c",
            border:`1px solid ${C.border}`,
            borderRadius:4, padding:"6px 0", minWidth:170,
            boxShadow:"0 6px 24px rgba(0,0,0,.35)",
            pointerEvents:"all",
          }}>
            <div style={{padding:"4px 14px 8px",fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:C.groupLabel}}>
              {sec.label}
            </div>
            {visibleChildren.map(c => (
              <button key={c.id}
                onClick={() => { onNavigate(c.id); setPopover(null); }}
                style={{
                  display:"block", width:"100%", textAlign:"left",
                  background: activeId===c.id ? C.bgActive : "transparent",
                  border:"none",
                  borderLeft:`3px solid ${activeId===c.id ? C.activeBorder : "transparent"}`,
                  padding:"8px 16px", cursor:"pointer",
                  color: activeId===c.id ? "#fff" : C.text,
                  fontSize:12, fontFamily:"inherit",
                }}
                onMouseEnter={e => { if(activeId!==c.id) e.currentTarget.style.background=C.bgHover; }}
                onMouseLeave={e => { if(activeId!==c.id) e.currentTarget.style.background="transparent"; }}
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
      height:"100vh", background:C.bg,
      position:"sticky", top:0, alignSelf:"flex-start",
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
        <button onClick={onToggle} style={{background:"none",border:"none",cursor:"pointer",color:C.text,padding:6,lineHeight:1,flexShrink:0,display:"flex",alignItems:"center"}}>
          {collapsed ? <Menu size={16} strokeWidth={1.75} /> : <ChevronLeft size={16} strokeWidth={1.75} />}
        </button>
      </div>

      {/* scrollable nav body */}
      <div style={{flex:1, overflowY:"auto", overflowX:"hidden", padding:"4px 0"}}>

        {/* ── Inici ── */}
        <Leaf item={{ id: "home", label: "Inici", icon: Home }} />

        {/* ── Portfoli group ── */}
        <GroupLabel label="Portfoli" />
        {PORTFOLI_SECTIONS.map(sec => <Section key={sec.id} sec={sec} />)}

        {/* ── Transaccions group ── */}
        {TX_LEAVES.some(l => canAccessSection?.(l.id) ?? true) ? <GroupLabel label="Transaccions" /> : null}
        {TX_LEAVES.map(l => (canAccessSection?.(l.id) ?? true) ? <Leaf key={l.id} item={l} /> : null)}

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
              transition:"background 0.1s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background=C.bgHover; }}
            onMouseLeave={e => { e.currentTarget.style.background="transparent"; }}
          >
            {(() => { const Icon = item.icon; return <Icon size={16} strokeWidth={1.75} color={tc.textLight} style={{flexShrink:0}} />; })()}
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
