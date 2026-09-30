# Canonical processor engine correctness review

Reviewed `docs/ENGINE_API.md`, `docs/SOURCE_ANALYSIS.md`, `src/engine/index.ts`, `src/engine/types.ts`, and both engine test files against the stated lab and lecture contracts.

## Findings

No material correctness defect found in the requested areas:

- **Encoding and decoding:** strict signed decimal / 32-bit hexadecimal and binary parsing is implemented in `parseValue` (`src/engine/index.ts:109-128`). R/I/B/S field extraction and encoding are bounded; B immediates reconstruct the scattered bits and sign-extend correctly (`src/engine/index.ts:205-245`). Fixed reference tests cover canonical ADDI and both B-immediate extremes (`tests/engine-reference.test.ts:7-39`).
- **ALU:** signed SLT compares signed interpretations, while arithmetic results wrap to 32 bits (`src/engine/index.ts:276-290`). Fixed extreme-value cases cover the signed boundary (`tests/engine-reference.test.ts:47-52`). Zero is calculated for every operation; this satisfies the lab, which only specifies ADD/SUB Zero and leaves other functions don't-care (`docs/SOURCE_ANALYSIS.md:9`).
- **Trace and edge commit:** `traceCycle` computes a frozen trace without mutating the state; `commitCycle` validates provenance and the source-state snapshot before applying writes and advancing PC/cycles (`src/engine/index.ts:365-435`). Tests verify nonmutation, delayed writes, and stale-trace rejection (`tests/engine-reference.test.ts:66-74`).
- **PC and ROM:** lab PC arithmetic wraps to eight bits, ROM address is byte PC shifted right by two, and branch targets use PC plus the signed byte displacement (`src/engine/index.ts:365-380,394-413`). Tests exercise sequential wrap, taken and untaken branches, and the fixed branch target at wrap (`tests/engine-reference.test.ts:54-64`).
- **Factorial and scope:** generated source supports exactly 0 through 8, starts with the required `addi t0, zero, n`, uses only the lab subset, leaves the result in `t2`, and ends with a self-branch (`src/engine/index.ts:663-682`). Tests execute 0!, 3!, and 8! (`tests/engine.test.ts:232-238`). Decoder and assembly parser enforce lab/lecture instruction scope (`src/engine/index.ts:243-245,580-586`), with representative tests (`tests/engine.test.ts:212-223`).

One minor explanatory limitation, not an execution defect: `traceSteps` emits register-port-oriented explanations for lecture extensions too, so load/store explanations may not be as clear as the lab add/addi/beq path (`src/engine/index.ts:490-500`). The API contract principally specifies those lab questions (`docs/ENGINE_API.md:25-27`).

## Check

`npm test` passed: 3 test files, 37 tests.
