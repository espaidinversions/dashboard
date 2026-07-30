# Turtle Capital Design System

<!-- Hallmark · project design.md · locked system for this app -->
<!-- All pages read from this file. Do not alter tokens without updating tokens.css and src/index.css. -->

## Identity

**Product:** Turtle Capital Dashboard — private investment management  
**Mood:** Warm private-bank editorial  
**Genre:** Editorial — quality printed financial report (FT / Monocle register)  
**Voice:** Dense typographic hierarchy, ruled dividers, tabular data front and center — now on a warm ivory canvas with a brass accent thread and bolder Newsreader section headers

**Semantic colour split (the spine of the system):**

- **Navy** — structure, headings, KPI values
- **Brass** — the editorial UI accent thread: section markers, hairline rules, topbar accent, active tab underline, KPI accent bars, focus ring, wordmark
- **Green** — gains / positive data only (brand icon anchor)
- **Clay** — losses / negative data only

## Typography

| Role | Family | Weight | Usage |
|------|--------|--------|-------|
| Display | Newsreader | 300–400 | Page headers, brand statements, auth panel |
| Body / UI | IBM Plex Sans | 300–600 | All body copy, labels, navigation, buttons |
| Data / Mono | IBM Plex Mono | 400–500 | Numbers, KPI values, table cells with `.num` |

### Scale

| Token | px | Usage |
|-------|----|-------|
| `--text-xs` | 11 | Badges, table headers (uppercase), sub-labels |
| `--text-sm` | 13 | Secondary labels, filter controls |
| `--text-base` | 14 | Body, table cells |
| `--text-md` | 15 | Primary UI labels |
| `--text-lg` | 18 | Section titles |
| `--text-xl` | 20 | KPI values |
| `--text-2xl` | 24 | Hero KPI values |

## Color System

Warm OKLCH palette: **ivory paper hue 88°**, **navy structure hue 252°**, **brass accent hue 82°**, **green gains hue 148°**, **clay losses hue 40°**.

### Light mode

| Token | OKLCH | Role |
|-------|-------|------|
| `--color-paper` | `oklch(97.2% 0.011 88)` | Warm ivory page background |
| `--color-paper-2` | `oklch(94.6% 0.015 86)` | Alt / hover background |
| `--color-surface` | `oklch(99.2% 0.006 88)` | Warm near-white cards, panels |
| `--color-rule` | `oklch(87.5% 0.016 84)` | Warm dividers, borders |
| `--color-ink` | `oklch(24% 0.020 256)` | Primary text (charcoal-navy) |
| `--color-ink-2` | `oklch(40% 0.024 252)` | Secondary text |
| `--color-ink-3` | `oklch(56% 0.020 250)` | Muted / tertiary |
| `--color-accent` | `oklch(38% 0.092 252)` | Navy — structure, headings, KPI values |
| `--color-brass` | `oklch(63% 0.098 82)` | Brass — editorial UI accent thread |
| `--color-vivid` | `oklch(59% 0.175 148)` | Green — gains / positive data |
| `--color-danger` | `oklch(52% 0.145 40)` | Clay — losses / negative values |
| `--color-warn` | `oklch(66% 0.125 66)` | Amber — warnings |
| `--color-focus` | `oklch(59% 0.100 80)` | Brass focus ring |

Brass has three steps (`--color-brass` / `-hi` / `-lo`) mirrored in `theme.js` as `tc.brass` / `tc.brassLight` / `tc.brassDark`. Brass is a large-text / rule / decoration colour — never body text. Dark mode tokens defined in `src/index.css` `[data-theme="dark"]` (deep navy-charcoal canvas, brass thread preserved).

### Sidebar

Always navy-dark regardless of app theme:

| State | Light | Dark |
|-------|-------|------|
| Background | `#1C3650` | `#0E1B27` |
| Hover | `#22425F` | `#142030` |
| Active | `#0F2A44` | `#1A2E42` |
| Active border | `#3DC83E` | `#3DC83E` |

## Spacing

4px base scale. Tokens: `--space-1` (4px) through `--space-8` (32px).

## Border Radius

Sharpened for institutional tone:

| Token | px |
|-------|----|
| `--radius-sm` | 2 |
| `--radius-md` | 4 |
| `--radius-lg` | 6 |
| `--radius-xl` | 8 |

## Macrostructures

| Context | Family |
|---------|--------|
| Login / auth pages | Split Studio (left brand panel + right form) |
| Dashboard / app pages | Workbench (sidebar + main content) |
| Content / guide pages | Long Document |

## Components

### KpiCard

- **Regular:** white card, `--radius-lg`, `--color-ink-3` label, `--color-accent` value, IBM Plex Mono numbers
- **Hero:** solid `tc.navy` background, green bottom border (2px), white number, no gradient

### Sidebar

- Always dark navy, 220px expanded / 52px rail
- Active state: 3px left border `#3DC83E`, darker background
- Group labels: uppercase, 10px, opacity 0.28
- Popover (collapsed hover): `--radius-md` (4px)

### Inputs

- Border: `1px solid --color-rule`
- Border-radius: `--radius-md` (4px)
- Focus: border-color `--color-accent`, box-shadow `0 0 0 2px (vivid/0.18)`

### Buttons — Primary

- Background: `--color-accent` (navy)
- Border-radius: `--radius-md`
- Font: IBM Plex Sans 600, 13px, letter-spacing 0.03em

### Tab bars

- Active tab: `2px solid --color-vivid` bottom border
- Inactive: `--color-ink-3`
- Text: 12px uppercase, letter-spacing 0.06em

## Motion

Stance: **motion-on** (transitions via CSS, no heavy animation library).  
Keep to compositor properties: `transform`, `opacity`, `box-shadow`.  
Durations: 100–280ms, `--ease-out` easing.
