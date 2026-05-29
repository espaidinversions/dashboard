# Turtle Capital Design System

<!-- Hallmark · project design.md · locked system for this app -->
<!-- All pages read from this file. Do not alter tokens without updating tokens.css and src/index.css. -->

## Identity

**Product:** Turtle Capital Dashboard — private investment management  
**Mood:** Institutional  
**Genre:** Modern-minimal — Swiss editorial meets financial press  
**Voice:** Dense typographic hierarchy, ruled dividers, tabular data front and center

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

OKLCH palette anchored on **navy hue 245°** and **green hue 145°**.

### Light mode

| Token | OKLCH | Role |
|-------|-------|------|
| `--color-paper` | `oklch(97% 0.008 245)` | Page background |
| `--color-paper-2` | `oklch(94% 0.012 245)` | Alt / hover background |
| `--color-surface` | `oklch(100% 0 0)` | Cards, panels |
| `--color-rule` | `oklch(87% 0.018 245)` | Dividers, borders |
| `--color-ink` | `oklch(22% 0.06 245)` | Primary text |
| `--color-ink-2` | `oklch(38% 0.07 245)` | Secondary text |
| `--color-ink-3` | `oklch(55% 0.06 245)` | Muted / tertiary |
| `--color-accent` | `oklch(35% 0.10 245)` | Navy — brand primary |
| `--color-vivid` | `oklch(60% 0.19 145)` | Green — brand secondary, active states |
| `--color-danger` | `oklch(42% 0.18 27)` | Red — negative values, errors |
| `--color-warn` | `oklch(62% 0.16 60)` | Orange — warnings |
| `--color-focus` | `oklch(60% 0.19 145)` | Focus ring |

Dark mode tokens defined in `src/index.css` `[data-theme="dark"]`.

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
