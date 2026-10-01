# Validation status

Validated on 2026-10-01 for the course-progress, keyboard and touch update.

| Check | Result |
|---|---|
| Unit tests (`npm test`) | 43 passed across four files |
| Browser tests (`npm run test:e2e`) | 34 passed, Chromium and targeted WebKit tablet projects |
| TypeScript (`npm run typecheck`) | Passed |
| ESLint (`npm run lint`) | Passed |
| Production build (`npm run build`) | Passed |
| Whitespace (`git diff --check`) | Passed |
| Independent finish review | Passed; no material fixes requested |

The browser suite exercises ordered Next/Finish-series navigation, cookie persistence and reload, direct exercise links, reset cancel/confirm, preservation of unrelated storage, the complete manual cycle and rising edge, native numeric/register selection, typed answers, program imports, guided/revealed grading, and factorial inputs 0/3/8. Keyboard checks include welcome-to-ROM navigation with Tab/Enter, checking and advancing, field placement, component exploration, and focus at the manual rising edge. Touch checks include pointer drag and tablet tap placement/navigation.

Responsive checks cover all eleven topic routes, welcome and Progress at 390, 768 and 1024px in Chromium and WebKit, with open disclosures and B-type field layouts. They check document width and visible internal horizontal overflow, including scroll containers. Native form controls and clipped screen-reader utilities are excluded from the internal-content check. A WebKit control-grid overflow at 1024px was fixed by allowing field columns to reflow at a readable minimum width.

The lead also inspected batched desktop/mobile/iPad-width captures of the production build. The initial and confirmation passes showed readable task-first layouts, responsive exact-range field grids, and contained diagrams; the next action was moved to the sticky task-position row to avoid covering feedback. Current example screenshots are in `docs/screenshots/`.

One design-detector pass reported 259 advisories, mostly inherited palette/type literals, and one warning for an inherited width transition. The width transition was removed; the detector was not rerun. Detector output is a source scan, not browser validation.

GitHub Actions installs Chromium and WebKit and runs checks before publishing main. Local acceptance precedes the commit and deployment; remote run and live-site results are reported separately after publication.

## Scope limits

Browser viewport and input emulation do not establish physical Safari/iPad rendering, a Logisim circuit, or physical processor behavior. Processor-model correctness is documented separately in [the correctness review](CORRECTNESS_REVIEW.md).
