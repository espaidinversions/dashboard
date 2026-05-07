# UI Sub-plan 2: Shared Primitives — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `SharedComponents.jsx` with: hero/standard KpiCard variants, SectionHeader component, tableCardStyle helper, and pill-shaped Badge.

**Architecture:** All changes are additive to `src/components/SharedComponents.jsx`. KpiCard gets a `hero` prop (default false); existing callers remain compatible. SectionHeader and tableCardStyle are new exports. Badge gets an updated shape but same API. Sub-plan 1 (theme tokens) must be deployed first so `tc.shadows`, `tc.radius`, and `tc.gradients` exist.

**Tech Stack:** React inline styles, `useTheme()` hook

**Prerequisite:** Sub-plan 1 must be merged so `tc.shadows`, `tc.radius`, `tc.gradients` are available.

---

### Task 1: Upgrade KpiCard to support hero and standard variants

**Files:**
- Modify: `src/components/SharedComponents.jsx`

Context: Current KpiCard (lines 101-109):
```js
export function KpiCard({ label, value, sub, valueColor, tc = TC_LIGHT }) {
  return (
    <div className="kpi-card card-hover" style={sharedStyles.kpi(tc)}>
      <div style={sharedStyles.kpiLabel(tc)}>{label}</div>
      <div style={sharedStyles.kpiValue(tc, valueColor)}>{value}</div>
      {sub && <div style={sharedStyles.kpiSub(tc)}>{sub}</div>}
    </div>
  );
}
```

New API: `<KpiCard hero? label value sub? valueColor? progress? tc? />`

- `hero` (boolean, default false): gradient navy background, white text, accent bar at top, decorative orb
- `progress` (number 0-1, optional): renders a thin progress bar on standard variant
- All existing props remain; existing callers without `hero` prop get standard variant unchanged in behavior but with shadow

- [ ] **Step 1: Replace KpiCard in SharedComponents.jsx**

Replace the existing KpiCard function (lines 101-109) with:

```js
export function KpiCard({ label, value, sub, valueColor, hero = false, progress, tc = TC_LIGHT }) {
  if (hero) {
    return (
      <div style={{
        background: tc.gradients?.navy ?? "linear-gradient(135deg, #2B5070 0%, #1C3A52 100%)",
        borderRadius: tc.radius?.lg ?? 14,
        padding: "16px 20px",
        boxShadow: "0 4px 16px rgba(43,80,112,0.25)",
        minWidth: 140,
        flex: 1,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* accent bar at top */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: tc.gradients?.green ?? "linear-gradient(90deg, #3DC83E 0%, #28A029 100%)",
          borderRadius: `${tc.radius?.lg ?? 14}px ${tc.radius?.lg ?? 14}px 0 0`,
        }} />
        {/* decorative orb */}
        <div style={{
          position: "absolute", right: -12, top: -12,
          width: 70, height: 70,
          background: "rgba(61,200,62,0.08)",
          borderRadius: "50%",
        }} />
        <div style={{
          fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)", fontWeight: 600, marginBottom: 6,
        }}>{label}</div>
        <div style={{
          fontSize: 22, fontWeight: 700, color: "#fff",
          fontFamily: "'DM Mono',monospace", letterSpacing: "-0.5px",
        }}>{value}</div>
        {sub && <div style={{
          fontSize: 10, color: tc.green ?? "#3DC83E", marginTop: 4, fontWeight: 500,
        }}>{sub}</div>}
      </div>
    );
  }

  return (
    <div className="kpi-card card-hover" style={{
      background: tc.card,
      border: `1px solid ${tc.border}`,
      borderRadius: tc.radius?.lg ?? 14,
      padding: "16px 20px",
      boxShadow: tc.shadows?.card ?? "0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)",
      minWidth: 140,
      flex: 1,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
        color: tc.textLight, fontWeight: 600, marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontSize: 20, fontWeight: 700, color: valueColor ?? tc.navy,
        fontFamily: "'DM Mono',monospace",
      }}>{value}</div>
      {progress != null && (
        <div style={{ height: 3, background: tc.bgAlt, borderRadius: 2, marginTop: 8 }}>
          <div style={{
            height: 3,
            width: `${Math.min(100, Math.max(0, progress * 100))}%`,
            background: tc.gradients?.green ?? "linear-gradient(90deg, #3DC83E 0%, #28A029 100%)",
            borderRadius: 2,
          }} />
        </div>
      )}
      {sub && <div style={{
        fontSize: 10, color: tc.textLight, marginTop: 4,
      }}>{sub}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Run verify**

```bash
npm run verify
```

Expected: all checks pass. Existing callers without `hero` prop get the updated standard variant.

- [ ] **Step 3: Commit**

```bash
git add src/components/SharedComponents.jsx
git commit -m "feat(SharedComponents): upgrade KpiCard with hero and progress variants"
```

---

### Task 2: Add SectionHeader component

**Files:**
- Modify: `src/components/SharedComponents.jsx`

Context: No SectionHeader exists yet. Add it as a new named export after the KpiCard function. API: `<SectionHeader title count? action? tc? />`.

- `title` (string): section name
- `count` (number, optional): shown as faint text on the right
- `action` (ReactNode, optional): button or element on the right, overrides count if both present
- `tc` (theme object, default from `useTheme()`)

- [ ] **Step 1: Add SectionHeader after KpiCard in SharedComponents.jsx**

Add after the KpiCard closing brace, before the `// ── Flag emoji` comment:

```js
// ── Section Header ───────────────────────────────────────
export function SectionHeader({ title, count, action, tc: tcProp }) {
  const { tc: tcTheme } = useTheme();
  const tc = tcProp ?? tcTheme;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      paddingBottom: 10,
      borderBottom: `1px solid ${tc.border}`,
      marginBottom: 14,
    }}>
      {/* green accent bar */}
      <div style={{
        width: 3, height: 18, flexShrink: 0,
        background: tc.gradients?.green ?? "linear-gradient(180deg, #3DC83E 0%, #28A029 100%)",
        borderRadius: 2,
      }} />
      <span style={{
        fontSize: 14, fontWeight: 700, color: tc.navyDark,
        letterSpacing: "-0.01em",
      }}>{title}</span>
      {(action || count != null) && (
        <div style={{ marginLeft: "auto" }}>
          {action ?? (
            <span style={{ fontSize: 11, color: tc.textLight, fontWeight: 400 }}>
              {count}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run verify**

```bash
npm run verify
```

Expected: all checks pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/SharedComponents.jsx
git commit -m "feat(SharedComponents): add SectionHeader component"
```

---

### Task 3: Add tableCardStyle helper

**Files:**
- Modify: `src/components/SharedComponents.jsx`

Context: `tableCardStyle` is a style object factory (function receiving `tc`) used to wrap tables in a card container. It needs to be exported so screen components can import it.

- [ ] **Step 1: Add tableCardStyle export to SharedComponents.jsx**

Add after the SectionHeader function (before the `// ── Flag emoji` comment):

```js
// ── Table card wrapper style ─────────────────────────────
export function tableCardStyle(tc = TC_LIGHT) {
  return {
    background: tc.card,
    borderRadius: tc.radius?.md ?? 10,
    boxShadow: tc.shadows?.card ?? "0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)",
    overflow: "hidden",
    border: `1px solid ${tc.border}`,
  };
}
```

Note: `tableCardStyle` is a function (not a static object) so it can be called with the current `tc` for dark mode support.

- [ ] **Step 2: Run verify**

```bash
npm run verify
```

Expected: all checks pass. Knip may warn if no consumer imports `tableCardStyle` yet — that's fine; it will be consumed in Sub-plan 3.

- [ ] **Step 3: Commit**

```bash
git add src/components/SharedComponents.jsx
git commit -m "feat(SharedComponents): add tableCardStyle helper export"
```

---

### Task 4: Update Badge to pill shape

**Files:**
- Modify: `src/components/SharedComponents.jsx`

Context: Current Badge (around line 157):
```js
export function Badge({label,cfg}) {
  const { tc: TC } = useTheme();
  const s=cfg||{color:TC.textMid,bg:TC.bgAlt};
  return <span style={{fontSize:11,background:s.bg,color:s.color,borderRadius:4,padding:"2px 8px",fontWeight:600,whiteSpace:"nowrap",display:"inline-block"}}>{label}</span>;
}
```

Changes: `borderRadius: 4` → `20`, `padding: "2px 8px"` → `"3px 9px"`, add `border: "1px solid"` with 15% alpha of the badge color.

- [ ] **Step 1: Replace Badge in SharedComponents.jsx**

Replace:
```js
export function Badge({label,cfg}) {
  const { tc: TC } = useTheme();
  const s=cfg||{color:TC.textMid,bg:TC.bgAlt};
  return <span style={{fontSize:11,background:s.bg,color:s.color,borderRadius:4,padding:"2px 8px",fontWeight:600,whiteSpace:"nowrap",display:"inline-block"}}>{label}</span>;
}
```

With:
```js
export function Badge({label,cfg}) {
  const { tc: TC } = useTheme();
  const s=cfg||{color:TC.textMid,bg:TC.bgAlt};
  const border = s.border ?? hexToRgba(s.color, 0.15);
  return <span style={{fontSize:11,background:s.bg,color:s.color,borderRadius:20,padding:"3px 9px",fontWeight:600,whiteSpace:"nowrap",display:"inline-block",border:`1px solid ${border}`}}>{label}</span>;
}

function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith("#")) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
```

Place `hexToRgba` before `Badge` (it is a module-level helper, not exported).

- [ ] **Step 2: Run verify**

```bash
npm run verify
```

Expected: all checks pass. Badge callers (FundsIndex, PipelineFY26, etc.) automatically get the new pill shape with no API change.

- [ ] **Step 3: Commit**

```bash
git add src/components/SharedComponents.jsx
git commit -m "feat(SharedComponents): update Badge to pill shape with subtle border"
```
