# Acceptance evidence

Verified on 2026-09-30 on macOS, Node.js 25.8.1, using the production Vite build and Playwright Chromium.

| Check | Result |
|---|---|
| Unit tests (`npm test`) | 38 passed across 3 files |
| Strict TypeScript (`npm run typecheck`) | Passed |
| ESLint (`npm run lint`) | Passed |
| Production (`npm run build`) | Passed |
| Browser tests (`npm run test:e2e`) | 29 passed |
| Responsive browser layout | All 11 topics fit document widths 390 and 1024 px |
| Rendered capture batch | 30 desktop/tablet/mobile captures; no browser errors or document overflow |
| Processor model | Unchanged by this interface overhaul; prior review in CORRECTNESS_REVIEW.md |
| Independent visual review | One remaining material finding resolved; final verdict clear, see UX_REVIEW.md |

The browser suite exercises a full manual beq cycle before and after its rising edge, RF combinational reads and x0 writes, signed overflow, all five encoding stages, correct and incorrect field placements, actual B immediate fragments, seven branch predictions, byte/word addressing, clock feedback locking, oral self-assessment, assembly validation, hex file import, factorial 0/3/8, assisted-score handling, saved/blocked storage, keyboard focus and SVG exploration.

The overhaul adds welcome/deep-link refresh checks, mobile topic navigation, tap and keyboard placement with moving/displacement, real mouse pointer dragging including an already-selected chip, and emulated touch input through Chromium's input protocol. Program editing, prediction, decoder references, and the last-edge trace remain available behind explicit disclosures.

## Delivery

The same suite accepts `TEST_BASE_URL` and uses paths relative to it, including the separately created touch context. The Pages workflow validates unit, type, lint, build, and browser behavior before deploying pushes or merges to `main`. Pull requests receive checks without deployment. Current CI/deployment evidence is available in the repository's [workflow runs](https://github.com/liltaket/is1200-processor-lab/actions).

The original deployment of commit `67a7fe3d36c5f2368f01dd058744f428344d86d5` succeeded in [run 36764962157](https://github.com/liltaket/is1200-processor-lab/actions/runs/36764962157); its earlier 23-test suite passed against the public URL. Those results describe the original interface, not this overhaul. The new published interface is verified separately after its deployment.

## Limits

These are software and Chromium browser results with responsive and touch emulation. They do not prove physical Safari/iPad rendering, a Logisim circuit, or physical processor hardware. Publication is authorized for `liltaket/is1200-processor-lab`, served at https://liltaket.github.io/is1200-processor-lab/.
