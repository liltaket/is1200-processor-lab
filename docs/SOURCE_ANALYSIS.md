# Lab 4 source analysis

This note records requirements from the supplied course sources for the interactive learning material. Locators use printed Lab 4 PDF pages, Lecture 9 PDF page numbers (which differ from printed slide numbers after omitted slides), and the instruction-sheet page/section. The PDF source supplied is `lab4-processor-design.pdf`; no `(1)` duplicate was found. No PDF is copied or published here.

## Assignment scope and exact contracts

| Part | Required scope and interface | Source locator |
|---|---|---|
| ALU | Inputs `A`, `B` are 32-bit, `F` is 3-bit; outputs `Y` 32-bit and `Zero` 1-bit. `F=000` ADD, `001` SUB, `010` AND, `011` OR, `101` SLT. Other F values undefined. `Zero` must equal `(Y==0)` for ADD and SUB only; it is don't-care for AND/OR/SLT. Logisim Subtractor component is prohibited. | Lab 4 pp. 4–5; Lecture 9 PDF p. 7 |
| Register file | Two combinational read ports and one clocked write port; 8 × 32-bit registers addressed by 3 bits. Index 0 (`zero`) always reads zero and ignores writes. Expose `t2`. Interface: `CLK`, `WE3` 1-bit; `A1`, `A2`, `A3` 3-bit; `WD3` 32-bit; `RD1`, `RD2`, `T2` 32-bit. Aliases by index: 0 zero, 1 ra, 2 sp, 3 gp, 4 tp, 5 t0, 6 t1, 7 t2. This deliberately restricts programs to x0–x7; names such as a0 are outside the register file. | Lab 4 p. 6; instruction sheet “REGISTERS” |
| Control unit | Pure combinational decoder for `addi`, `add`, `beq`; input `Instruction` 32-bit; outputs `RegWrite`, `ALUSrc`, `Branch` 1-bit and `ALUControl` 3-bit. Must preserve add/addi behavior while adding beq. beq compares via ALU subtraction/Zero and enables Branch. | Lab 4 pp. 6–7; Lecture 9 PDF pp. 34–36 |
| Datapath | Execute only `addi`, `add`, `beq`; byte-addressed 8-bit PC resets to 0 and increments by 4. ROM is word-addressed, so PC bits are shifted right 2 for instruction lookup. Register file uses only low 3 address bits. For beq, branch target is PC plus the sign-extended branch immediate; the condition selects branch target or PC+4. Required observable output is `t2` (32-bit). | Lab 4 pp. 7–9; reference sheet “Definitions” and B-format |
| Factorial | Assembly may use only `add`, `addi`, `beq` and registers x0–x7 (`zero`, `ra`, `sp`, `gp`, `tp`, `t0`, `t1`, `t2`). First instruction must be `addi t0, zero, n`; result in `t2`; final instruction line is a self-branching stop loop. Multiply by repeated `add`. Test at least 0!, 3!, 8! both in RARS and on the datapath. Submit assembly and circuit with matching first ROM word. | Lab 4 pp. 10–11 |

The lab describes the factorial routine for a parameterized `n`, but only explicitly requires test inputs 0, 3, and 8. Since the circuit uses 32-bit arithmetic, the lesson should not imply arbitrary mathematical factorials are representable: results overflow 32 bits for sufficiently large n. Keep any supported input range explicit if one is introduced.

## Semantics and design details

- **SLT is signed.** The reference sheet defines `slt rd,rs1,rs2` as 1 exactly when `reg[rs1] < reg[rs2]` under signed interpretation. `sltu` is a distinct unsigned instruction. Lab 4’s ALU SLT therefore needs signed comparison and a 32-bit result of 0 or 1 (zero extension). Lecture 9 PDF p. 7 depicts extracting the most-significant sign bit and zero-extending the comparison result.
- **Control encodings.** Lecture 9 PDF p. 36 gives the general ALU decoder mapping: ALUOp `00` → ADD/`000`; `01` → SUB/`001`; ALUOp `10` with funct3 `010` → SLT/`101`; funct3 `110` → OR/`011`; funct3 `111` → AND/`010`; R-type ADD and SUB distinguished by `{op5,funct7[5]}`. Lab 4 only asks the smaller control unit to select ADD for add/addi and SUB for beq. Main decoder on PDF p. 35 lists beq as `RegWrite=0`, `ALUSrc=0`, `Branch=1`, `ALUOp=01`; addi has `RegWrite=1`, `ALUSrc=1`; R-type has `RegWrite=1`, `ALUSrc=0`.
- **Branch immediate layout.** B-format immediate bits are encoded as `imm[12] | imm[10:5] | rs2 | rs1 | funct3 | imm[4:1] | imm[11] | opcode`; reconstructed immediate has implicit low bit 0. Reference sheet defines BTA as `PC + sext(imm)`. Thus branch displacements are aligned in two-byte units; do not treat the scattered instruction fields as an ordinary contiguous 12-bit field.
- **Why this lab can omit ImmSrc.** The lab explicitly asks students to explain the omission and points to the maximum PC address (8-bit PC). The branch path still must reconstruct/sign-extend the B immediate correctly. Because the PC datapath is only 8 bits, only the low eight bits of the selected next PC are retained; this simplification makes separate immediate-format selection less significant in the supplied implementation. This explanation should be presented as a consequence of this constrained datapath, not as a general RISC-V rule. (This is a design inference from the lab’s hint and PC width; the handout does not give a full derivation.)
- **Register access timing.** The lab asks students orally to distinguish clocked write from reads and explain why. Standard intended behavior is synchronous write at the clock edge and asynchronous/combinational reads; the supplied source does not explicitly spell this timing out in the assignment text. Treat as a concept to explain from the circuit implementation / lecture, not as a quoted contract.
- **Unconditional jump in factorial.** The processor has no `j` instruction. The oral question expects explaining a self-branching `beq` stop loop (compare a register with itself, so condition is always true). It is permitted by the instruction subset and fulfills the required final stop loop.

## Oral examination topics

The handout says each student is examined individually and may be asked about a randomly selected part; questions are not limited to the listed prompts (Lab 4 p. 3). Teach the learner to explain their own implementation, signal decisions, and program trace rather than memorize only answers. Explicit topics:

- **ALU (pp. 5–6):** define each function; explain subtraction using two’s complement; explain Zero logic and alternatives; purpose of grouping functions in an ALU.
- **Register file (p. 6):** which operations are clocked and why; x0 read/write semantics and implementation; storage capacity (8 × 32 here; compare a full 32-register file).
- **Control unit (p. 7):** justify beq control signals and how ALU Zero determines branch decision.
- **Datapath (pp. 9–10):** bit selection for instruction fields; beq target calculation and control; roles of ImmSrc and ALUSrc; why this constrained processor omits ImmSrc.
- **Factorial (p. 11):** trace for a value chosen by the teaching assistant; show how to change n; explain unconditional jumps using the stop loop.

## Reference locator index

- `temp/source/lab4-processor-design.txt`: printed page markers around lines 1–441; assignments at pp. 4–11, examination requirements p. 3.
- `temp/source/lecture9.txt`: Lecture 9 PDF p. 7 (ALU function codes/SLT zero extension); PDF p. 35 (main decoder); PDF p. 36 (ALU decoder); PDF pp. 23, 26, 32–33 (instruction fields including B-format); PDF p. 42 (summary of datapath/control roles).
- `temp/source/riscv-instruction-sheet_improved.txt`: p. 1, instruction subset, signed `slt`, register aliases, instruction formats, and definitions including BTA.
