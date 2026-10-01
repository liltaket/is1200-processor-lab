# Architecture

Processor Lab is a static React/TypeScript application built with Vite. It needs no backend or credentials. Hash navigation preserves direct links and refresh under a GitHub Pages repository subpath.

## Canonical processor model

`src/engine/types.ts` defines the instruction, control, register, CPU-state, cycle-trace, and exercise contracts. `src/engine/index.ts` owns the supported instruction definitions, encoding and decoding, arithmetic, register access, assembly parsing, scenario generation, and cycle transitions. See [ENGINE_API.md](ENGINE_API.md) for the actual exported API.

The processor separates combinational evaluation from sequential updates:

1. `traceCycle(state, word)` decodes the instruction and computes controls, operands, ALU outputs, ROM index, branch decision, pending write, and PCnext without changing stored state.
2. `commitCycle(state, trace)` validates the originating state and applies register/memory writes and the PC update at one rising edge.

x0 remains zero. Lab mode uses eight physical registers and an 8-bit byte PC, with instruction ROM indexed by PC shifted right two. Encoded instructions retain standard five-bit register fields; Lab 4 assembly entry restricts register operands to x0–x7. Full scattered B-immediate reconstruction is shared by encoding, branches, and program execution. Lecture extensions are explicitly separated from lab scope.

## Interface

`src/App.tsx` owns hash navigation, learning experience, the Progress view, and explicit Next/Finish-series navigation. `src/course.tsx` owns stable lesson identities, per-topic cursors and cookie persistence; the app remounts each exercise when its topic, cursor, or reset epoch changes. Shared styles establish the dark workbench, focus treatment, responsive navigation, feedback, and data/control/state colors. [DESIGN.md](../DESIGN.md) records the implemented visual system.

| Module | Responsibility |
|---|---|
| `components/Datapath.tsx` | Responsive SVG or semantic signal-flow buttons, revealed paths, component explanations, and keyboard activation |
| `modes/ManualCpu.tsx` | Signal-by-signal predictions followed by explicit edge commit |
| `modes/ComponentLab.tsx` | Register-file experiments, ALU outputs, and generated control signals |
| `modes/InstructionLab.tsx` | R/I/B field placement and progressive assembly encoding |
| `modes/BranchLab.tsx` | Branch calculations and PC/ROM addressing |
| `modes/StudyLab.tsx` | Clock timing, editable program execution, and oral self-assessment |
| `modes/trainerFeedback.tsx` | Shared checking, reveal/reset handling, and explanation display |
| `course.tsx` | Ordered lesson banks, cookie completion, cursors, and provider hooks |
| `components/NumberAnswer.tsx` | Native numeric choice lists with optional typed decimal/hex/binary values |
| `learning.ts` | Source-linked questions, timing events, legacy accuracy statistics, and source-grounded study content |

Learning modules consume the same processor model. Grading and displayed expected results derive from traces or canonical instruction definitions. Program prediction evaluates future cycles without advancing the displayed CPU. Source edits must assemble successfully before execution; invalid imports preserve the loaded state.

## Progress and scope

The versioned `processor_lab_course_v1` first-party cookie persists 120 task outcomes and each topic cursor for a year, scoped to the app base path. It records not started, reviewed with help, and solved (correct prediction or oral self-assessment); repeated reports cannot inflate the solved count or downgrade a solved task. The Progress page links to individual tasks and provides cancel/confirm reset. Guarded localStorage separately preserves per-topic attempts and accuracy. Storage failure leaves practice usable within the session. Session streaks reset after reload. Reveals and feedback retries cannot add extra correct attempts; guided field hints are explicitly unscored. Oral answers use an expected-concept guide and self-assessment rather than automatic text grading.

The authored factorial lesson series uses n=0, 3, and 8; imported programs may use other supported inputs and is clearly identified as a demonstration. Assembly and hexadecimal import let students trace their own implementation. Execution is bounded, and reaching a self-branch pauses the workbench while explaining that the physical processor would continue that loop.

## Validation and deployment

Unit tests cover fixed instruction words, boundary encodings, signed arithmetic, x0, edge timing, PC wrapping, branch behavior, program scope, and local progress. Chromium and targeted WebKit tablet tests exercise interactions, persistence, keyboard/touch input, and responsive sizing; separate reviews cover processor correctness and visual layout. See [VALIDATION.md](VALIDATION.md) for evidence and limits.

The GitHub Actions workflow checks PRs targeting main. Pushes and merges to main run the same validation, then build with the Pages base path and publish through the `github-pages` environment. Deployment depends on successful checks; PRs do not publish. GitHub Pages hosts only the production `dist` artifact.
