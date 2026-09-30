import type { Topic } from './engine/types';

export const TOPICS: { id: Topic; label: string; description: string }[] = [
  { id: 'datapath', label: 'Datapath', description: 'Follow instruction values through the processor and predict the state update.' },
  { id: 'formats', label: 'Instruction formats', description: 'Find fields and explain how their positions guide decoding.' },
  { id: 'control', label: 'Control unit', description: 'Derive control signals from the instruction being executed.' },
  { id: 'registers', label: 'Register file', description: 'Select register addresses, read data, and reason about clocked writes.' },
  { id: 'alu', label: 'ALU', description: 'Choose an operation and predict its result and Zero output.' },
  { id: 'branch', label: 'Branches', description: 'Work out beq comparison, target address, and next PC.' },
  { id: 'clock', label: 'Clocking', description: 'Separate combinational propagation from state changes at the edge.' },
  { id: 'encoding', label: 'Assembly and encoding', description: 'Connect assembly operands with instruction fields and machine code.' },
  { id: 'rom', label: 'PC and ROM', description: 'Convert byte-addressed PC values to word-addressed ROM indices.' },
  { id: 'factorial', label: 'Factorial', description: 'Trace a restricted assembly program on the Lab 4 processor.' },
  { id: 'oral', label: 'Oral exam', description: 'Practice explaining design choices and processor behavior.' },
];

type Scope = 'lab' | 'lecture';
export const ORAL_QUESTIONS: {
  id: string; topic: Topic; prompt: string; concepts: string[]; answer: string; source: string; scope: Scope;
}[] = [
  { id: 'alu-functions', topic: 'alu', prompt: 'What does the ALU do, and what results do the Lab 4 function codes select?', concepts: ['shared arithmetic and logic unit', 'ADD', 'SUB', 'AND', 'OR', 'SLT'], answer: 'The ALU is a shared combinational unit. In this lab F=000 selects ADD, 001 SUB, 010 AND, 011 OR, and 101 signed SLT.', source: 'Lab 4 pp. 4–5, Assignment 1; Lecture 9 PDF p. 7', scope: 'lab' },
  { id: 'alu-subtract', topic: 'alu', prompt: 'Explain how the ALU can implement A − B using addition.', concepts: ['two complement', 'invert B', 'add one', 'A + ~B + 1'], answer: 'Two’s-complement subtraction uses A + (~B) + 1: invert B and set the adder carry-in to one.', source: 'Lab 4 p. 5, Assignment 1; Lecture 9 PDF p. 7', scope: 'lab' },
  { id: 'alu-zero', topic: 'alu', prompt: 'How is the Zero output defined, and which Lab 4 operations need it to be meaningful?', concepts: ['result equals zero', 'ADD', 'SUB', 'beq comparison'], answer: 'For ADD and SUB, Zero is 1 exactly when the ALU result is zero. The branch logic uses the SUB result to compare beq operands; other ALU functions may leave Zero undefined in this lab.', source: 'Lab 4 pp. 4–5, Assignment 1; version history p. 12', scope: 'lab' },
  { id: 'alu-grouping', topic: 'alu', prompt: 'Why group several operations in one ALU instead of building a separate processor-wide unit for each instruction?', concepts: ['shared hardware', 'selected operation', 'reuse operands'], answer: 'Instructions can reuse the same operand path and ALU hardware; control selects which function the combinational unit performs for the current instruction.', source: 'Lab 4 p. 6, Assignment 1 oral questions', scope: 'lab' },
  { id: 'register-timing', topic: 'registers', prompt: 'Which register-file operation is clocked: reading, writing, or both? Why?', concepts: ['combinational reads', 'write at rising edge', 'state'], answer: 'Reads are combinational and respond to address/value changes within the cycle. A write changes stored state at the active rising clock edge, which makes state updates synchronized.', source: 'Lab 4 p. 6, Assignment 2 oral questions; Lecture 9 PDF pp. 11, 13', scope: 'lab' },
  { id: 'register-zero', topic: 'registers', prompt: 'What happens when the register file reads or writes register zero?', concepts: ['reads zero', 'write ignored', 'hardwired zero'], answer: 'Reading register zero always returns 0. A write targeting it is ignored, so software cannot change its value.', source: 'Lab 4 p. 6, Assignment 2; RISC-V reference sheet p. 1', scope: 'lab' },
  { id: 'register-capacity', topic: 'registers', prompt: 'How many data bits can this 8-register file store? What would a 32-register file hold?', concepts: ['8 times 32', '256 bits total', '224 writable', '32 times 32', '1024 bits total', '992 writable'], answer: 'The physical Lab 4 file has 8 × 32 = 256 bits of register storage; because x0 is constant, 7 × 32 = 224 bits are writable. A conventional 32 × 32 file has 1024 bits total, with 31 × 32 = 992 writable when x0 is hardwired.', source: 'Lab 4 p. 6, Assignment 2 oral questions; RISC-V reference sheet p. 1', scope: 'lab' },
  { id: 'register-ports', topic: 'registers', prompt: 'What is the difference between a register address such as A1 and the read data output RD1?', concepts: ['A1 address selector', 'RD1 data value', 'address versus data'], answer: 'A1 selects which register to read; RD1 is the 32-bit value stored at that selected register. Similarly, instruction field rs1 supplies an address, not the operand data itself.', source: 'Lab 4 p. 6, Assignment 2 interface', scope: 'lab' },
  { id: 'control-beq', topic: 'control', prompt: 'Why does beq use RegWrite=0, ALUSrc=0, Branch=1, and SUB as ALUControl?', concepts: ['no register write', 'two register operands', 'branch signal', 'subtract compare'], answer: 'beq writes no destination register, compares two register values, and identifies a branch. The ALU subtracts the operands; its Zero result says whether they are equal.', source: 'Lab 4 pp. 6–7, Assignment 3; Lecture 9 PDF pp. 35–36', scope: 'lab' },
  { id: 'opcode-v-control', topic: 'control', prompt: 'How are opcode/funct fields different from ALUControl?', concepts: ['encoded instruction fields', 'decoder output', 'selects ALU operation'], answer: 'Opcode and funct fields are bits already encoded in the instruction. The control unit interprets them and generates ALUControl to select an ALU operation.', source: 'Lab 4 pp. 6–7, Assignment 3; Lecture 9 PDF p. 36', scope: 'lab' },
  { id: 'control-combinational', topic: 'control', prompt: 'Does the Lab 4 control decoder need a clock? Explain.', concepts: ['purely combinational', 'instruction input', 'control outputs'], answer: 'No. It is a combinational decoder: the current instruction determines RegWrite, ALUSrc, Branch, and ALUControl without storing state.', source: 'Lab 4 p. 7, Assignment 3 auto-grader contract', scope: 'lab' },
  { id: 'branch-condition', topic: 'branch', prompt: 'Does Branch=1 alone mean a beq is taken?', concepts: ['instruction class', 'Branch AND Zero', 'condition'], answer: 'No. Branch identifies a branch instruction. For beq, the branch is taken only when Branch AND Zero is true.', source: 'Lab 4 pp. 6–7, Assignment 3; Lecture 9 PDF pp. 27, 35', scope: 'lab' },
  { id: 'branch-target', topic: 'branch', prompt: 'How does beq produce its comparison and choose the next PC?', concepts: ['subtract', 'Zero', 'PC plus immediate', 'PC plus four', 'mux'], answer: 'The ALU subtracts the two register operands; Zero indicates equality. The branch target is PC plus the sign-extended branch displacement. Branch AND Zero selects that target; otherwise PC+4 is selected.', source: 'Lab 4 pp. 8–9, Assignment 4; RISC-V reference sheet p. 1', scope: 'lab' },
  { id: 'branch-target-base', topic: 'branch', prompt: 'Is a branch target calculated from the current PC or from PC+4?', concepts: ['current PC', 'PC plus sign extended immediate'], answer: 'The branch target is based on the current instruction PC: BTA = PC + sign-extended immediate. PC+4 is the sequential alternative.', source: 'Lab 4 pp. 8–9, Assignment 4; RISC-V reference sheet p. 1', scope: 'lab' },
  { id: 'branch-unconditional', topic: 'branch', prompt: 'How can the factorial program make an unconditional jump using only the allowed instructions?', concepts: ['beq', 'same register', 'always equal'], answer: 'Use beq with the same register as both operands, such as beq zero,zero,label. The operands are always equal, so the branch is always taken.', source: 'Lab 4 p. 11, Assignment 5 oral questions', scope: 'lab' },
  { id: 'formats-btype', topic: 'formats', prompt: 'Why should you not read a B-type branch immediate as one contiguous run of instruction bits?', concepts: ['scattered immediate bits', 'reordered fields', 'implicit low zero', 'sign extension'], answer: 'B-type immediate bits are split across the instruction and must be reassembled in the specified order; the low bit is implicit zero, then the value is sign-extended.', source: 'RISC-V reference sheet p. 1, B-format; Lecture 9 PDF pp. 26, 28', scope: 'lab' },
  { id: 'formats-low-register-bits', topic: 'formats', prompt: 'Why does the Lab 4 datapath use only the low three bits of a register address?', concepts: ['3-bit address', 'eight registers', 'x0 through x7'], answer: 'The simplified register file contains eight entries, so its address is three bits wide. The datapath selects the low three bits to address x0 through x7.', source: 'Lab 4 pp. 6, 8–9, Assignments 2 and 4', scope: 'lab' },
  { id: 'datapath-addi', topic: 'datapath', prompt: 'For addi, where does the ALU get its second operand, and where does the result go?', concepts: ['sign extended immediate', 'ALUSrc', 'register writeback'], answer: 'The immediate is sign-extended and selected as ALU operand B by ALUSrc. The ALU adds it to RD1 and the result is written to rd at the rising edge when RegWrite is enabled.', source: 'Lab 4 pp. 8–9, Assignment 4; Lecture 9 PDF pp. 28–29, 35', scope: 'lab' },
  { id: 'datapath-add', topic: 'datapath', prompt: 'For add, why must ALUSrc select the register-file path?', concepts: ['RD2', 'register operand', 'ALUSrc=0'], answer: 'Both source operands come from registers. ALUSrc selects RD2 for operand B (ALUSrc=0 in the lab convention), and the result is written to rd.', source: 'Lab 4 p. 9, Assignment 4; Lecture 9 PDF pp. 24–25', scope: 'lab' },
  { id: 'datapath-field-address', topic: 'datapath', prompt: 'Explain the path from instruction field rs1 to the ALU input A.', concepts: ['rs1 bits', 'A1 address', 'register file', 'RD1 data'], answer: 'The rs1 field supplies the register-file read address A1. The selected register value appears as RD1 and feeds ALU input A.', source: 'Lab 4 pp. 8–9, Assignment 4; Lecture 9 PDF pp. 15–16', scope: 'lab' },
  { id: 'rom-byte-word', topic: 'rom', prompt: 'The PC is 0x0C. Which ROM word is fetched, and why?', concepts: ['byte address', 'shift right two', 'word index 3'], answer: '0x0C is decimal 12. Shifting the byte address right by two gives word index 3, because each ROM word contains four bytes.', source: 'Lab 4 p. 8, Assignment 4', scope: 'lab' },
  { id: 'rom-pcplus4', topic: 'rom', prompt: 'Why does the PC normally advance by four for the next instruction?', concepts: ['32-bit instruction', 'four bytes', 'byte address'], answer: 'Each instruction is 32 bits, or four bytes, and the PC stores a byte address, so the next sequential instruction is at PC+4.', source: 'Lab 4 p. 8, Assignment 4', scope: 'lab' },
  { id: 'clock-pc', topic: 'clock', prompt: 'When is PCnext calculated, and when does PC itself change?', concepts: ['combinational calculation', 'rising edge', 'state'], answer: 'Combinational logic calculates PCnext during the cycle. The PC register takes that value at the rising clock edge.', source: 'Lab 4 pp. 7–8, Assignment 4; Lecture 9 PDF pp. 11, 19–20', scope: 'lab' },
  { id: 'encoding-funct-vs-control', topic: 'encoding', prompt: 'In an R-type instruction, what does funct3 represent, and who creates ALUControl?', concepts: ['funct3 encoded', 'instruction field', 'control decoder output'], answer: 'funct3 is an encoded instruction field that helps identify the operation. The control decoder interprets it and produces the ALUControl signal.', source: 'RISC-V reference sheet p. 1; Lecture 9 PDF pp. 23, 32, 36', scope: 'lab' },
  { id: 'factorial-constraints', topic: 'factorial', prompt: 'What restrictions must the Lab 4 factorial program obey?', concepts: ['add addi beq only', 'registers 0 through 7', 'input t0', 'result t2'], answer: 'Use only add, addi, and beq; use only registers x0–x7; put n in t0 as the first instruction requires; and leave the final result in t2.', source: 'Lab 4 p. 10, Assignment 5', scope: 'lab' },
  { id: 'factorial-multiply', topic: 'factorial', prompt: 'How can the program multiply without a mul instruction?', concepts: ['repeated addition', 'loop', 'add'], answer: 'Implement multiplication with a loop that accumulates repeated additions, using the allowed add, addi, and beq instructions.', source: 'Lab 4 p. 10, Assignment 5', scope: 'lab' },
  { id: 'factorial-stop', topic: 'factorial', prompt: 'What must the final stop loop do, and how can it be expressed in the allowed subset?', concepts: ['self loop', 'beq', 'branch to itself'], answer: 'The program must stop by looping forever at its final instruction. A beq comparing a register with itself and targeting that instruction provides the required self-loop.', source: 'Lab 4 pp. 10–11, Assignment 5', scope: 'lab' },
  { id: 'lecture-imm-src', topic: 'datapath', prompt: 'In the Lecture 9 datapath, what job does ImmSrc perform, and how is that different from ALUSrc?', concepts: ['immediate format selection', 'ALU operand mux', 'different muxes'], answer: 'ImmSrc controls which immediate format is generated from instruction bits. ALUSrc selects the ALU B input, for example between RD2 and the generated immediate; they control different choices.', source: 'Lab 4 pp. 9–10, Assignment 4 oral questions; Lecture 9 PDF pp. 28–29', scope: 'lecture' },
  { id: 'lab-imm-src-omission', topic: 'datapath', prompt: 'Why can the constrained Lab 4 processor avoid the lecture’s shared ImmSrc selector?', concepts: ['8-bit PC', 'low branch displacement bits', 'separate immediate paths', 'B bits still reconstructed'], answer: 'One wiring approach gives addi its I-type immediate on the ALU path and reconstructs the low branch displacement bits on the separate PC-target path. Only the low eight target bits survive in the lab PC, so a shared I/S/B immediate generator with an ImmSrc selector is unnecessary here. B bits still need the correct ordering. This is a consequence of the constrained wiring, not a general RISC-V rule; explain the particular circuit you built.', source: 'Lab 4 p. 9, Assignment 4 hint; Lecture 9 PDF p. 28. Wiring explanation is an inference from the 8-bit PC constraint.', scope: 'lab' },
  { id: 'lecture-single-cycle', topic: 'datapath', prompt: 'What does the single-cycle design mean by CPI=1?', concepts: ['one instruction per cycle', 'single cycle'], answer: 'The design completes one instruction per clock cycle, so its ideal cycles per instruction is one (CPI=1). The clock period still has to accommodate the instruction’s combinational critical path.', source: 'Lecture 9 PDF pp. 37–38 (printed slides 38–39)', scope: 'lecture' },
  { id: 'lecture-critical-path', topic: 'datapath', prompt: 'What determines the minimum clock period in a single-cycle processor?', concepts: ['longest path', 'critical path', 'combinational delay'], answer: 'The clock period must be long enough for the slowest instruction’s longest combinational path to settle before state is captured; that path is the critical path.', source: 'Lecture 9 PDF pp. 38–39 (printed slides 39–40)', scope: 'lecture' },
  { id: 'lecture-load-store', topic: 'control', prompt: 'In the lecture’s extended datapath, how do lw and sw differ in their major state/control effects?', concepts: ['lw writes register', 'sw writes memory', 'MemWrite', 'ResultSrc'], answer: 'lw reads data memory and selects that data for register writeback. sw writes register-file data to memory and asserts MemWrite, while it does not write a destination register.', source: 'Lecture 9 PDF pp. 15–22, 35', scope: 'lecture' },
];

export const CLOCK_EVENTS: {
  id: string; event: string; answer: 'combinational' | 'edge'; explanation: string;
}[] = [
  { id: 'address-a1-changes', event: 'A1 changes to select a different register.', answer: 'combinational', explanation: 'A1 is a read address. The selected RD1 value follows the address through combinational read logic.' },
  { id: 'read-data-changes', event: 'RD1 changes after its selected register value changes.', answer: 'combinational', explanation: 'Register-file reads are combinational; the output reflects the stored value without waiting for a clock edge.' },
  { id: 'a2-changes', event: 'A2 changes while the clock is low.', answer: 'combinational', explanation: 'Changing the second read address can change RD2 during the same cycle.' },
  { id: 'alu-source-changes', event: 'The ALUSrc mux changes from RD2 to the immediate.', answer: 'combinational', explanation: 'A mux selection changes its output through combinational logic.' },
  { id: 'alu-result-changes', event: 'The ALU result changes after one operand changes.', answer: 'combinational', explanation: 'The ALU computes from its current inputs during the cycle.' },
  { id: 'we3-asserts', event: 'WE3 becomes 1 before the next clock edge.', answer: 'combinational', explanation: 'WE3 is a control signal. Asserting it enables a pending write but does not itself commit register state.' },
  { id: 'wd3-changes', event: 'WD3 changes while WE3 is already 1 and the clock is low.', answer: 'combinational', explanation: 'WD3 is write data on the input path. The stored value is still unchanged until the active edge.' },
  { id: 'a3-changes', event: 'A3 changes before the active edge.', answer: 'combinational', explanation: 'A3 selects the destination register for a pending write; changing the address alone does not update any register.' },
  { id: 'register-write', event: 'A rising edge occurs while WE3=1 and A3 is nonzero.', answer: 'edge', explanation: 'The register file commits WD3 to the selected writable register on the rising edge.' },
  { id: 'x0-write', event: 'A rising edge occurs with WE3=1 and A3=0.', answer: 'edge', explanation: 'The write attempt is sampled at the edge, but x0 semantics suppress the write; register zero remains 0.' },
  { id: 'pcnext-computed', event: 'The branch decision changes the combinational PCnext value.', answer: 'combinational', explanation: 'PCnext is selected by combinational branch and mux logic during the current cycle.' },
  { id: 'pc-updates', event: 'A rising edge captures PCnext into the PC register.', answer: 'edge', explanation: 'The PC is sequential state and changes at the active clock edge.' },
  { id: 'control-decoded', event: 'A new instruction changes the decoded RegWrite and ALUControl signals.', answer: 'combinational', explanation: 'The Lab 4 control unit is a combinational decoder with no clocked state.' },
  { id: 'rom-word', event: 'A changed PC selects the corresponding instruction word from ROM.', answer: 'combinational', explanation: 'The PC-derived ROM address selects an instruction; fetch selection is combinational in this model.' },
];

export type Progress = {
  version: 1;
  topics: Partial<Record<Topic, { attempts: number; correct: number }>>;
  streak: number;
  bestStreak: number;
};

const STORAGE_KEY = 'is1200-learning-progress-v1';
const validTopics = new Set<Topic>(TOPICS.map(({ id }) => id));

export function createProgress(): Progress {
  return { version: 1, topics: {}, streak: 0, bestStreak: 0 };
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function parseProgress(value: unknown): Progress {
  if (!value || typeof value !== 'object') return createProgress();
  const candidate = value as Partial<Progress>;
  if (candidate.version !== 1 || !candidate.topics || typeof candidate.topics !== 'object') return createProgress();
  const topics: Progress['topics'] = {};
  for (const [key, raw] of Object.entries(candidate.topics)) {
    if (!validTopics.has(key as Topic) || !raw || typeof raw !== 'object') continue;
    const attempts = nonNegativeInteger((raw as { attempts?: unknown }).attempts);
    const correct = Math.min(attempts, nonNegativeInteger((raw as { correct?: unknown }).correct));
    topics[key as Topic] = { attempts, correct };
  }
  const bestStreak = nonNegativeInteger(candidate.bestStreak);
  return { version: 1, topics, streak: 0, bestStreak };
}

export function loadProgress(storage?: Pick<Storage, 'getItem'>): Progress {
  try {
    const target = storage ?? globalThis.localStorage;
    const serialized = target.getItem(STORAGE_KEY);
    if (!serialized) return createProgress();
    return parseProgress(JSON.parse(serialized) as unknown);
  } catch {
    return createProgress();
  }
}

export function saveProgress(progress: Progress, storage?: Pick<Storage, 'setItem'>): boolean {
  try {
    const target = storage ?? globalThis.localStorage;
    target.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function recordAttempt(progress: Progress, topic: Topic, correct: boolean): Progress {
  if (!validTopics.has(topic)) return progress;
  const previous = progress.topics[topic] ?? { attempts: 0, correct: 0 };
  const streak = correct ? progress.streak + 1 : 0;
  return {
    version: 1,
    topics: {
      ...progress.topics,
      [topic]: { attempts: previous.attempts + 1, correct: previous.correct + (correct ? 1 : 0) },
    },
    streak,
    bestStreak: Math.max(progress.bestStreak, streak),
  };
}

export function weakestTopic(progress: Progress): Topic {
  let weakest = TOPICS[0].id;
  let lowest = Number.POSITIVE_INFINITY;
  for (const { id } of TOPICS) {
    // Oral practice credits the subject of the explanation, rather than a
    // separate topic. Otherwise mixed review would get stuck on "oral".
    if (id === 'oral') continue;
    const stat = progress.topics[id];
    const score = stat && stat.attempts > 0 ? stat.correct / stat.attempts : -1;
    if (score < lowest) {
      lowest = score;
      weakest = id;
    }
  }
  return weakest;
}

export function mastery(progress: Progress, topic: Topic): number {
  const stat = progress.topics[topic];
  if (!stat || stat.attempts <= 0) return 0;
  return Math.round((Math.max(0, Math.min(stat.correct, stat.attempts)) / stat.attempts) * 100);
}
