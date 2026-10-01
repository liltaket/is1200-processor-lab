# UX review — course progress and lesson flow

The course-progress interface separates lesson completion from answer accuracy. It keeps the established calm dark processor workbench (seed `b901f51d`) and adds a direct progress route rather than mixing review selection into topic navigation.

## Current interaction model

- `/progress` shows overall solved progress and expandable topic rows. Each row links directly to every exercise and labels it not started, reviewed, or solved.
- Topic cursors persist independently, so a learner can visit progress or another topic and return to the same exercise. A completed series reports solved and reviewed totals and offers review, next-topic, and progress actions.
- After a task is completed, its solved/reviewed status and **Next exercise** or **Finish series** action sit in the sticky row directly below the page heading.
- Reset is explicit: the learner opens confirmation, then cancels or confirms. Confirmation resets course completion and legacy prediction-accuracy history; it does not clear unrelated browser storage.
- Course state uses the versioned `processor_lab_course_v1` cookie, scoped to the app base path with a one-year lifetime and SameSite=Lax; it adds Secure on HTTPS. Legacy prediction accuracy remains in localStorage.
- Number-answer tasks present a choice list and allow a custom decimal, hexadecimal, or binary entry where configured.
- The R/I/B field bank preserves its instructional order; labeled exact bit ranges reflow in a responsive grid without horizontal scrolling. Pointer drag, tap selection, and keyboard operation remain available.
- The datapath uses semantic signal buttons below a 1000px container width and its full SVG from 1000px upward. Both layouts fit their container. Navigation and next-task changes move focus into the destination; Escape closes the Topics disclosure and returns focus to its summary.

## Review status

The UI contract above is grounded in the current source. Final local acceptance passed: 43 unit tests, 34 Chromium/WebKit browser tests, TypeScript, lint, production build, batched rendered review, and an independent finish review. See [validation status](VALIDATION.md) for evidence and limits. The WebKit 1024px control grid now reflows with a readable 190px minimum column width.
