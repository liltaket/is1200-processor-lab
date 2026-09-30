---
name: IS1200 Processor Lab
description: A calm dark workbench for tracing processor signals and state.
colors:
  canvas: "#101318"
  surface: "#181d25"
  surface-raised: "#202733"
  border: "#303946"
  text: "#e8edf3"
  muted: "#a4afbd"
  data-blue: "#9dc3ef"
  control-amber: "#e5bb79"
  state-lilac: "#c7b5eb"
  success-green: "#a5d4b7"
  error-red: "#f3aaa5"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "normal"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  xs: "3px"
  sm: "5px"
  md: "7px"
  lg: "8px"
  panel: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
components:
  button-primary:
    backgroundColor: "#a9c5e6"
    textColor: "#13253a"
    rounded: "{rounded.md}"
    padding: "9px 14px"
    height: "38px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "#c8d3e3"
    rounded: "{rounded.md}"
    padding: "9px 14px"
    height: "38px"
  input:
    backgroundColor: "#11161e"
    textColor: "#e5ecf7"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "40px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
  chip:
    backgroundColor: "#273140"
    textColor: "#c4d4e9"
    rounded: "{rounded.sm}"
    padding: "5px 9px"
---

# Design System: IS1200 Processor Lab

## Overview

**Creative North Star: "The Calm Processor Workbench"**

The interface feels like a focused technical instrument: dark slate surfaces recede behind the datapath, readable labels, and live values. Its visual hierarchy follows the work itself—read an instruction, follow its signals, then distinguish the clocked state change. The tone stays quiet so students can reason through the mechanism without decorative competition.

Color carries meaning across the actual diagrams and learning modes. Blue marks data paths and the primary action; amber marks control; lilac marks sequential state. Responsive layouts keep navigation and guided work available on narrow screens, while the datapath remains a wide, pannable diagram when it cannot fit. Motion is brief and reduced when the user requests it.

**Key Characteristics:**
- Dark slate instrument surfaces with restrained borders.
- Blue data, amber control, and lilac state cues.
- Dense technical detail with readable hierarchy and horizontally pannable diagrams.

## Colors

The palette uses low-glare charcoal and slate neutrals, with muted accents assigned to processor meaning rather than decoration.

### Primary
- **Signal Blue** (`{colors.data-blue}`): Highlights data buses, selected navigation and choices, focus, and the primary action family.
- **Control Amber** (`{colors.control-amber}`): Marks control signals, failed status, and control-focused explanations.

### Secondary
- **State Lilac** (`{colors.state-lilac}`): Identifies sequential state, pending PC values, and clock-edge explanation.
- **Success Green** (`{colors.success-green}`): Shows completed or changed register state and correct feedback.
- **Error Red** (`{colors.error-red}`): Shows incorrect feedback and validation errors.

### Neutral
- **Instrument Canvas** (`{colors.canvas}`): Page background.
- **Slate Surface** (`{colors.surface}`): Panels and primary working surfaces.
- **Raised Slate** (`{colors.surface-raised}`): Elevated tonal grouping for controls and nodes.
- **Quiet Border** (`{colors.border}`): Surface boundaries, dividers, and field outlines.
- **Readable Frost** (`{colors.text}`): Main text and diagram labels.
- **Muted Slate Text** (`{colors.muted}`): Supporting labels and secondary information.

### Named Rules
**The Signal Meaning Rule.** Keep blue on data, amber on control, and lilac on sequential state; do not exchange these roles for decoration.

## Typography

**Display Font:** System sans-serif (`-apple-system`, BlinkMacSystemFont, Segoe UI, sans-serif)
**Body Font:** System sans-serif (`-apple-system`, BlinkMacSystemFont, Segoe UI, sans-serif)
**Label/Mono Font:** UI monospace (`ui-monospace`, SFMono-Regular, Consolas, Liberation Mono, monospace)

**Character:** Compact, neutral sans-serif keeps instructions and explanations easy to scan. Monospace separates machine values, code, and addresses from prose.

### Hierarchy
- **Display** (600, 32px, 1.15 line-height): Page heading; tighten letter spacing slightly.
- **Headline** (600, 19–21px, 1.45 line-height): Guided question and prominent working prompt.
- **Title** (500–550, 14–18px, 1.4 line-height): Panel and section titles.
- **Body** (400, 12–13px, 1.5–1.65 line-height): Explanations, prompts, and instructional prose.
- **Label** (500–700, 9–12px, normal to .09em tracking): Compact field names, phase labels, and uppercase kickers where used.
- **Machine values** (400, 9–18px, monospace): Addresses, encoded words, register values, and instruction text.

### Named Rules
**The Value-Type Rule.** Render machine values in monospace so they stay visually distinct from their explanation.

## Layout

The wide-screen shell pairs persistent topic navigation with a flexible work area. The manual datapath and guided question sit side by side when there is room; the register state and supporting signal details follow the active work. At narrower widths, the manual layout becomes a single column, topic navigation becomes a horizontal strip, and register grids reduce from eight columns to four and then two. The datapath preserves its readable minimum width inside a scrollable viewport and exposes a pan cue on compact layouts. Trainer and study layouts similarly collapse at their observed breakpoints. Use the established 4, 8, 12, 16, and 22px spacing rhythm, with responsive padding where the source already uses it.

## Elevation & Depth

Depth is tonal and structural. Panels sit on the slate surface, nested controls use darker or raised slate, and fine borders separate neighboring regions. The observed interface does not establish a shadow vocabulary; preserve its flat-by-default treatment and use color, border, and spacing to show grouping.

### Named Rules
**The Tonal Layer Rule.** Establish depth with surface tone and quiet borders; do not add shadows as a substitute for clear grouping.

## Shapes

The form language uses softly squared controls and cards, generally between 5px and 12px radius. Small chips, fields, and buttons stay compact; larger learning panels receive the more generous corners. Borders are thin and low contrast at rest, while focus is a clearly visible 2px outline with offset. Keep bit-field cells square-edged where their repeated grid geometry is the point.

## Components

### Buttons
- **Character:** Compact controls with clear hierarchy and restrained state changes.
- **Shape:** Softly squared (7px radius); usual minimum height 38px.
- **Primary:** Pale blue fill with dark text; 9px 14px padding.
- **Secondary:** Transparent or slate fill with a quiet outline; use for supporting actions.
- **Hover / Focus:** Slightly brighter fill on hover; visible light-blue focus outline with 4px offset.

### Chips
- **Style:** Small slate-blue fill, pale blue-gray text, and compact 5px 9px padding.
- **State:** Use selected or semantic feedback colors only when the underlying state calls for them.

### Cards / Containers
- **Corner Style:** Softly squared, usually 7–12px.
- **Background:** Slate surfaces with low-contrast border separation.
- **Shadow Strategy:** Flat tonal layering; see Elevation & Depth.
- **Internal Padding:** Commonly 16–22px for panels, with tighter spacing for dense technical subregions.

### Inputs / Fields
- **Style:** Dark inset field, quiet slate border, 7px radius, and 40px minimum height.
- **Focus:** 2px light-blue outline with offset; study controls use the current blue accent.
- **Error / Disabled:** Error notes use the red family; disabled buttons reduce opacity.

### Navigation
- **Style:** Compact labels and icons on the dark sidebar; active topics use a slightly lighter slate-blue surface.
- **Hover / Active:** Hover raises the slate tone; active text and icon brighten.
- **Mobile:** Navigation moves above the work area as a horizontally scrollable strip.

### Datapath and Signal Legend
The editable schematic is the signature component. Keep its data wires solid blue, control wires dashed amber, and state nodes outlined in lilac. Revealed values strengthen the corresponding signal color; inactive wires recede. Preserve its pannable viewport and compact-screen pan cue rather than shrinking labels until the diagram becomes hard to read.

## Do's and Don'ts

### Do:
- **Do** keep the dark instrument palette and the established blue, amber, and lilac signal roles.
- **Do** keep machine values in monospace and explanation text in the system sans-serif.
- **Do** let the work area adapt to the actual viewport; preserve a pannable datapath when needed.
- **Do** keep keyboard focus visible and respect reduced-motion preferences.

### Don't:
- **Don't** introduce a light theme, neon overload, or distracting gamification; the product contract commits to a dark, calm learning environment.
- **Don't** blur data, control, and sequential-state color roles.
- **Don't** compress the datapath into unreadable labels on narrow screens.
