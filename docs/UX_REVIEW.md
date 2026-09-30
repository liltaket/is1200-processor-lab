# UX finish review — interface overhaul

Reviewed on 2026-09-30 against the user's request for a quieter interface, clear tasks, instruction-field drag and drop, and a welcome screen. The pinned direction remains a calm dark processor workbench (seed `b901f51d`). No approved visual comp or separate quality-bar card was supplied.

## Built result

- Root opens a welcome screen with one primary **Open lab** action.
- Working views remove course branding, repeated introductions, provenance footers, and routine storage/streak badges.
- The current task and relevant values lead. Extra explanations, progress, program editing, and predictions start collapsed.
- Fields support real mouse/touch pointer dragging, tap selection, keyboard activation, moving, and displacement. Practice starts without revealed mappings.
- The mobile Topics menu exposes all 11 topics; wide technical surfaces scroll inside their own regions.

## Review evidence

A batched production-browser capture covered welcome and all 11 topics on desktop (1440 px) and mobile (390 px), representative tablet views (1024 px), and B-type field layouts. Thirty captures had no document overflow or browser errors. Ordinary visible prompts, labels, and buttons measured at least 14 px; essential SVG annotations retain a denser scale.

The build-thread correction batch removed overlapping internal register-port labels, enlarged a remaining scroll cue, removed empty previous-edge panels, and adjusted control spacing. A bounded confirmation round followed.

A separate reviewer inspected the supplied captures and returned the required persistence, fidelity, ceiling, material-fixes, and keep sections. TYPE and MATERIAL matched the pinned flat slate/vector direction. One material finding remained: mobile field strips did not visibly indicate their hidden bit ranges.

| Independent finding | Final verdict |
|---|---|
| Offscreen instruction ranges need a visible discovery cue | Resolved: a 14 px cue appears when the strip actually overflows |
| Regressions from the correction | None visible in the supplied captures |
| Remaining material findings | Clear |

The reviewer scored fresh desktop, tablet, and mobile recaptures after that fix. Browser tests also assert the cue on a narrow touch viewport. This evidence covers Chromium viewport emulation, not physical Safari/iPad testing.
