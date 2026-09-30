---
name: IS1200 Processor Lab
description: A focused dark workbench for learning processor behavior.
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
  action-blue: "#a9c5e6"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  welcome-display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(48px, 5vw, 72px)"
    fontWeight: 550
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    letterSpacing: "normal"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  xs: "3px"
  sm: "5px"
  md: "7px"
  lg: "8px"
  panel: "12px"
  capsule: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  panel: "22px"
  section: "30px"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "#13253a"
    rounded: "{rounded.md}"
    padding: "11px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "#c8d3e3"
    rounded: "{rounded.md}"
    padding: "11px 16px"
    height: "44px"
  input:
    backgroundColor: "#11161e"
    textColor: "#e5ecf7"
    rounded: "{rounded.md}"
    padding: "11px 13px"
    height: "44px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "22px"
  chip:
    backgroundColor: "#273140"
    textColor: "#c4d4e9"
    rounded: "{rounded.sm}"
    padding: "7px 10px"
  navigation-item:
    backgroundColor: "#263447"
    textColor: "#e8edf3"
    rounded: "{rounded.md}"
    padding: "11px 12px"
    height: "44px"
  welcome-action:
    backgroundColor: "{colors.action-blue}"
    textColor: "#13253a"
    rounded: "{rounded.md}"
    padding: "15px 23px"
    height: "54px"
---

# Design System: IS1200 Processor Lab

## Overview

**Creative North Star: "The Calm Processor Workbench"**

The interface is a focused technical instrument. Dark slate surfaces leave room for the mechanism, its live values, and the learner's next decision. The welcome screen offers a single Open lab action beside a small vector circuit; once inside, one clear task leads each topic. Course identity stays quiet and supporting copy stays brief.

Color carries processor meaning: blue identifies data and primary actions, amber identifies control, and lilac identifies clocked state. A larger, more readable type scale keeps the instructional interface legible; the responsive layout moves the question and required state ahead of the wide diagram on smaller screens. Practice waits for a prediction or an explicit reveal before exposing an answer. Field placement works with pointer drag, tap selection, or keyboard activation.

**Key Characteristics:**
- Dark slate instrument surfaces, quiet boundaries, and no raster artwork or decorative card collage.
- Blue data, amber control, and lilac sequential state cues.
- Task-first layouts with readable labels and touch-sized controls.
- Explicit answers in Practice; no automatic answer hints.

## Colors

The interface retains its low-glare dark slate palette and uses muted, consistent accents to explain processor roles.

### Primary
- **Signal Blue** (`{colors.data-blue}`): Marks data paths, selected states, focus treatment, and the primary-action family.
- **Action Blue** (`{colors.action-blue}`): Fills prominent actions such as Open lab and Check answer.

### Secondary
- **Control Amber** (`{colors.control-amber}`): Marks control wires and control-focused explanations.
- **Success Green** (`{colors.success-green}`): Shows correct feedback and changed register state.
- **Error Red** (`{colors.error-red}`): Shows incorrect feedback and inline error notes.

### Tertiary
- **State Lilac** (`{colors.state-lilac}`): Identifies sequential state and clock-edge values.

### Neutral
- **Instrument Canvas** (`{colors.canvas}`): Full-page background.
- **Slate Surface** (`{colors.surface}`): Main exercise panels.
- **Raised Slate** (`{colors.surface-raised}`): Nested controls and schematic nodes.
- **Quiet Border** (`{colors.border}`): Panel divisions and field outlines.
- **Readable Frost** (`{colors.text}`): Primary text and diagram labels.
- **Muted Slate Text** (`{colors.muted}`): Supporting information.

### Named Rules
**The Signal Meaning Rule.** Blue stays with data and primary actions, amber with control, and lilac with clocked state.

## Typography

**Display Font:** System sans-serif (`-apple-system`, BlinkMacSystemFont, Segoe UI, sans-serif)
**Body Font:** System sans-serif (`-apple-system`, BlinkMacSystemFont, Segoe UI, sans-serif)
**Label/Mono Font:** UI monospace (`ui-monospace`, SFMono-Regular, Consolas, Liberation Mono, monospace)

**Character:** Neutral system sans-serif supports long study sessions and immediate reading. Monospace gives instruction words, register values, and addresses a distinct machine voice.

### Hierarchy
- **Welcome display** (550, 48–72px responsive, 1.05 line-height): The brief welcome heading; narrows to a 46–64px clamp on compact screens.
- **Page display** (600, 32px, 1.2 line-height): Single page heading identifying the active topic.
- **Headline** (500–600, 18–23px, 1.35–1.45 line-height): Current question and panel heading.
- **Body** (400, 15px base, 1.5–1.65 line-height): Explanations and instructional prose.
- **Label** (500, usually 14px): Topic navigation, phase, field, progress, and control labels.
- **Machine values** (400, usually 14–16px, monospace): Encoded words, instruction text, register values, and addresses.

### Named Rules
**The Readable Workbench Rule.** Keep labels and body copy at the implemented 14px and 15px baseline; reserve smaller text for dense diagram annotations that have adjacent explanation.

## Layout

The welcome page puts the main action and a vector circuit in a spacious two-column composition, then offers a few topic shortcuts. On small screens the circuit yields space to the welcome message and the Open lab action. Inside the workbench, topic navigation stays persistent on desktop; below 800px it becomes a native expandable Topics menu. Progress and explanatory disclosures begin closed.

Manual practice leads with the current task. At medium desktop widths, the question and register state share the first row and the wide datapath follows beneath them; below 1100px the task, register state, and diagram stack in that order. On wide screens the question sits beside the diagram and register state. The diagram keeps its wide working surface inside a horizontally pannable viewport, with a visible pan cue on compact screens. Register grids move from four columns to two as space narrows. Other study and trainer panels collapse to one column at their implemented breakpoints. Controls are generally at least 44px high, and the spacing rhythm uses 4, 8, 12, 16, 22, and 30px steps.

## Elevation & Depth

The workbench uses tonal surfaces and fine borders for its main hierarchy, with one functional shadow on the open mobile topic menu to separate the popover from the page. Learning panels remain flat at rest. Brief transitions mark state changes and are disabled under reduced-motion preferences.

### Shadow Vocabulary
- **Mobile topic popover** (`box-shadow: 0 12px 34px #05070b80`): Separates the expanded Topics menu from the work area.

### Named Rules
**The Functional Depth Rule.** Reserve drop shadow for the open navigation popover; use surface tone and borders to group ordinary learning content.

## Shapes

Controls and panels use softly squared corners, typically 5–12px; selected instruction chips and the welcome action retain the same restrained language. Compact section labels may use capsule shapes. Instruction bit ranges remain square-edged so the 32-bit strip reads as a continuous field. Focus uses a visible blue outline. Avoid relying on small color-only distinctions for placement: the interface also shows selected, moving, drop-target, and result states.

## Components

### Buttons
- **Character:** Clear, touch-sized actions with one prominent blue choice and quieter outlined or transparent companions.
- **Shape:** Softly squared (7px radius); standard action height 44px, with the welcome action at 54px.
- **Primary:** Pale blue fill and dark text; standard padding 11px 16px.
- **Secondary:** Transparent or slate fill with a quiet outline.
- **Hover / Focus:** Hover gently lifts the slate tone; keyboard focus has a visible 2px blue outline and offset.

### Chips
- **Style:** Available instruction fields use a 7px corner, blue-gray border, and slate fill; selected fields brighten and gain a clear outline.
- **State:** Correct/incorrect and drop-target states change both fill and text or outline treatment.
- **Interaction:** Drag a field to a bit range, select then tap a range, or use Enter on a focused field and range.

### Cards / Containers
- **Corner Style:** Gently rounded (12px main panel; smaller nested areas 7–9px).
- **Background:** Dark slate surface with a low-contrast border.
- **Shadow Strategy:** Flat at rest; the open mobile topic menu is the functional exception.
- **Internal Padding:** Usually 20–24px for primary work areas, adjusted at narrow widths.

### Inputs / Fields
- **Style:** Dark inset field with quiet border and 7px radius.
- **Size:** 44px minimum height and 15px input text in the main workbench.
- **Focus:** Clear 2px blue outline with offset.

### Navigation
- **Style:** 14px topic labels, 44px minimum link height, and a subdued blue-slate active surface.
- **Desktop:** Persistent topic list with Mixed review and a closed Progress disclosure beneath it.
- **Mobile:** Native expandable Topics menu containing links, Mixed review, and a closed Progress disclosure.

### Welcome Screen
One large welcome heading, a short invitation, and a prominent Open lab action establish the route into practice. A small inline SVG circuit connects the PC, instruction, registers, and ALU; it disappears on the narrowest screens rather than becoming decorative clutter.

### Datapath and Field Placement
The datapath keeps the signal key visible: solid blue data, dashed amber control, and lilac state. Unknown signals remain part of the exercise; values become visible as learners answer. In the instruction field task, the available field bank is alphabetical so its order does not disclose the correct layout. R/I bit ranges retain proportional widths with a 36px minimum per bit; B-type one-bit ranges use a 44px minimum target. The 32-bit strip scrolls within its own frame while a field is dragged, tapped into place, or moved with the keyboard; show “Scroll sideways for all bit ranges” only when the strip overflows. Placement updates are announced through a screen-reader live status.

## Do's and Don'ts

### Do:
- **Do** keep the dark slate workbench and the established data, control, and state color roles.
- **Do** use concise, task-specific guidance and let learners request help when they want it.
- **Do** preserve the 44px control baseline and 14px navigation/label scale.
- **Do** put the task and relevant state before the wide diagram on narrow screens.
- **Do** support pointer, touch, and keyboard field placement, visible focus, and reduced motion.

### Don't:
- **Don't** add automatic answer hints to Practice; reveal answers only after a learner action.
- **Don't** turn the screen into a course-branding page, a raster-art hero, or a decorative card collage.
- **Don't** compress the datapath or instruction strip until its labels stop being readable.
- **Don't** add shadows to ordinary panels; reserve them for the expanded mobile topic menu.
