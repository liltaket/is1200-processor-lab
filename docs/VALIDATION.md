# Local acceptance evidence

Verified on 2026-09-30 on macOS, Node.js 25.8.1, using the production Vite build and Playwright Chromium.

| Check | Result |
|---|---|
| Unit tests (`npm test`) | 38 passed across 3 files |
| Strict TypeScript (`npm run typecheck`) | Passed |
| ESLint (`npm run lint`) | Passed |
| Production (`npm run build`) | Passed |
| Browser tests (`npm run test:e2e`) | 23 passed |
| Dependency audit (`npm audit`) | 0 reported vulnerabilities |
| Responsive browser layout | All 11 topics fit document widths 390 and 1024 px |
| Independent processor review | No material execution defects found; see CORRECTNESS_REVIEW.md |
| Independent visual review | Three material findings resolved; see UX_REVIEW.md |

The browser suite exercises a full manual beq cycle before and after its rising edge, RF combinational reads and x0 writes, signed overflow, all five encoding stages, grading wrong field placements, actual B immediate fragments, seven branch predictions, byte/word addressing, clock feedback locking, oral self-assessment, assembly validation, hex file import, factorial 0/3/8, assisted-score handling, saved/blocked storage, keyboard focus and SVG exploration.

## Static subpath

A separate build used `VITE_BASE_PATH=/subpath-check/`. Its output was copied under that directory and served by Python's plain HTTP server, with no rewrite support. Every one of the 11 hash routes was directly loaded and refreshed. All returned the app with matching topic labels; script and stylesheet URLs remained under `/subpath-check/assets/`; no browser errors or failed responses occurred. The default relative-base build was restored afterward.

## Visual review

Desktop (1440 px), tablet (1024 px), and mobile (390 px) captures were reviewed. The fix batch contained the bit strip in its card and added visible mobile pan/navigation cues. A bounded confirmation capture and independent verdict resolved all three findings. `docs/screenshots/datapath.png` is an actual production-browser capture.

The trainer author's mechanical design scan reported no findings for ComponentLab, InstructionLab, BranchLab, and trainers.css. This is scoped evidence, not a claim of a whole-repository scan.

## GitHub Pages verification

The first deployment of commit `67a7fe3d36c5f2368f01dd058744f428344d86d5` succeeded in [workflow run 36764962157](https://github.com/liltaket/is1200-processor-lab/actions/runs/36764962157). GitHub's deployment status reported success at https://liltaket.github.io/is1200-processor-lab/.

The complete Chromium suite was then run against that public URL with `TEST_BASE_URL`: all 23 tests passed. A separate direct-navigation and refresh check covered all 11 topic URLs with successful responses and no failed assets or browser errors. The browser tests use paths relative to the selected base URL so the same suite covers local previews and repository Pages subpaths.

## Limits

These are local software and Chromium browser results, including responsive viewport emulation. They do not prove Safari/iPad hardware rendering, a Logisim circuit, or physical hardware. Published-site behavior is verified separately above in Chromium. Publication is authorized for the public repository `liltaket/is1200-processor-lab`. Its workflow runs unit, type, lint, build, and Chromium checks for PRs; pushes and merges to main additionally build with the Pages subpath and deploy. The workflow status provides CI/deployment evidence for each commit.
