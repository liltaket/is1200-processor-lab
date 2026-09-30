import type {
  ALUFunction,
  Bit,
  ControlSignals,
  CpuMode,
  CpuState,
  CycleTrace,
  DecodedInstruction,
  ExerciseStep,
  Instruction,
  InstructionDefinition,
  InstructionName,
  ProgramLine,
  Scenario,
} from './types';

export * from './types';

const OP_R = 0x33;
const OP_I = 0x13;
const OP_B = 0x63;
const OP_LOAD = 0x03;
const OP_STORE = 0x23;
const MASK32 = 0xffff_ffff;

export const REGISTER_NAMES: readonly string[] = Object.freeze([
  'zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2',
]);

export const INSTRUCTIONS: Record<InstructionName, InstructionDefinition> = Object.freeze({
  add: {
    name: 'add', format: 'R', opcode: OP_R, funct3: 0, funct7: 0,
    alu: '000', regWrite: 1, aluSrc: 0, branch: 0, memWrite: 0, resultSrc: 0,
    syntax: 'add rd, rs1, rs2', scope: 'lab',
  },
  addi: {
    name: 'addi', format: 'I', opcode: OP_I, funct3: 0,
    alu: '000', regWrite: 1, aluSrc: 1, branch: 0, memWrite: 0, resultSrc: 0,
    syntax: 'addi rd, rs1, imm', scope: 'lab',
  },
  beq: {
    name: 'beq', format: 'B', opcode: OP_B, funct3: 0,
    alu: '001', regWrite: 0, aluSrc: 0, branch: 1, memWrite: 0, resultSrc: 0,
    syntax: 'beq rs1, rs2, offset', scope: 'lab',
  },
  and: {
    name: 'and', format: 'R', opcode: OP_R, funct3: 7, funct7: 0,
    alu: '010', regWrite: 1, aluSrc: 0, branch: 0, memWrite: 0, resultSrc: 0,
    syntax: 'and rd, rs1, rs2', scope: 'lecture',
  },
  or: {
    name: 'or', format: 'R', opcode: OP_R, funct3: 6, funct7: 0,
    alu: '011', regWrite: 1, aluSrc: 0, branch: 0, memWrite: 0, resultSrc: 0,
    syntax: 'or rd, rs1, rs2', scope: 'lecture',
  },
  slt: {
    name: 'slt', format: 'R', opcode: OP_R, funct3: 2, funct7: 0,
    alu: '101', regWrite: 1, aluSrc: 0, branch: 0, memWrite: 0, resultSrc: 0,
    syntax: 'slt rd, rs1, rs2', scope: 'lecture',
  },
  lw: {
    name: 'lw', format: 'I', opcode: OP_LOAD, funct3: 2,
    alu: '000', regWrite: 1, aluSrc: 1, branch: 0, memWrite: 0, resultSrc: 1,
    syntax: 'lw rd, imm(rs1)', scope: 'lecture',
  },
  sw: {
    name: 'sw', format: 'S', opcode: OP_STORE, funct3: 2,
    alu: '000', regWrite: 0, aluSrc: 1, branch: 0, memWrite: 1, resultSrc: 0,
    syntax: 'sw rs2, imm(rs1)', scope: 'lecture',
  },
});

export const ALU_FUNCTIONS: { code: ALUFunction; name: string }[] = [
  { code: '000', name: 'ADD' },
  { code: '001', name: 'SUB' },
  { code: '010', name: 'AND' },
  { code: '011', name: 'OR' },
  { code: '101', name: 'SLT (signed)' },
];

function assertInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a finite safe integer.`);
}

function checkedRange(value: number, min: number, max: number, label: string): number {
  assertInteger(value, label);
  if (value < min || value > max) throw new RangeError(`${label} must be in the range ${min} to ${max}.`);
  return value;
}

export function toUnsigned(n: number): number {
  if (!Number.isFinite(n)) throw new RangeError('A 32-bit value must be finite.');
  return n >>> 0;
}

export function toSigned(n: number): number {
  if (!Number.isFinite(n)) throw new RangeError('A 32-bit value must be finite.');
  return toUnsigned(n) | 0;
}

export function formatValue(n: number, base: 'decimal' | 'hex' | 'binary' = 'decimal'): string {
  const value = toUnsigned(n);
  if (base === 'hex') return `0x${value.toString(16).padStart(8, '0')}`;
  if (base === 'binary') return `0b${value.toString(2).padStart(32, '0')}`;
  if (base !== 'decimal') throw new RangeError(`Unsupported number format: ${String(base)}.`);
  return String(toSigned(value));
}

/** Parse a signed decimal or a 32-bit hexadecimal/binary bit pattern. */
export function parseValue(text: string): number {
  if (typeof text !== 'string') throw new TypeError('Value must be entered as text.');
  const value = text.trim();
  if (!value) throw new SyntaxError('Enter a number.');
  const match = /^([+-]?)(?:(\d+)|(0[xX][0-9a-fA-F]+)|(0[bB][01]+))$/.exec(value);
  if (!match) throw new SyntaxError(`Invalid number: ${text}`);

  const sign = match[1] === '-' ? -1 : 1;
  const digits = match[2] ?? match[3] ?? match[4];
  const magnitude = Number(match[2] ?? digits);
  const parsed = match[2] !== undefined
    ? sign * magnitude
    : sign * Number.parseInt(digits.slice(2), match[3] ? 16 : 2);
  const min = match[2] !== undefined || sign < 0 ? -0x8000_0000 : 0;
  const max = match[2] !== undefined ? 0x7fff_ffff : MASK32;
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new RangeError('Decimal values must fit signed 32-bit range; hex/binary values must fit in 32 bits.');
  }
  return toUnsigned(parsed);
}

function validateRegister(register: number | undefined, label: string): number {
  if (register === undefined) throw new TypeError(`${label} is required.`);
  return checkedRange(register, 0, 31, label);
}

function validateImmediate(imm: number | undefined, min: number, max: number, step: number, label: string): number {
  if (imm === undefined) throw new TypeError(`${label} is required.`);
  const value = checkedRange(imm, min, max, label);
  if (value % step !== 0) throw new RangeError(`${label} must be a multiple of ${step}.`);
  return value;
}

function instructionDefinition(name: InstructionName): InstructionDefinition {
  const definition = INSTRUCTIONS[name];
  if (!definition) throw new TypeError(`Unsupported instruction: ${String(name)}.`);
  return definition;
}

export function encode(instruction: Instruction): number {
  if (!instruction || typeof instruction !== 'object') throw new TypeError('An instruction is required.');
  const definition = instructionDefinition(instruction.name);
  let word: number;
  if (definition.format === 'R') {
    const rd = validateRegister(instruction.rd, 'rd');
    const rs1 = validateRegister(instruction.rs1, 'rs1');
    if (instruction.rs2 === undefined) throw new TypeError('rs2 is required.');
    const rs2 = validateRegister(instruction.rs2, 'rs2');
    word = ((definition.funct7! << 25) | (rs2 << 20) | (rs1 << 15)
      | (definition.funct3 << 12) | (rd << 7) | definition.opcode) >>> 0;
  } else if (instruction.name === 'addi' || instruction.name === 'lw') {
    const rd = validateRegister(instruction.rd, 'rd');
    const rs1 = validateRegister(instruction.rs1, 'rs1');
    const imm = validateImmediate(instruction.imm, -2048, 2047, 1, 'I immediate');
    word = (((imm & 0xfff) << 20) | (rs1 << 15) | (definition.funct3 << 12)
      | (rd << 7) | definition.opcode) >>> 0;
  } else if (instruction.name === 'beq') {
    const rs1 = validateRegister(instruction.rs1, 'rs1');
    if (instruction.rs2 === undefined) throw new TypeError('rs2 is required.');
    const rs2 = validateRegister(instruction.rs2, 'rs2');
    const imm = validateImmediate(instruction.imm, -4096, 4094, 2, 'B immediate');
    const bits = imm & 0x1fff;
    word = (((bits >>> 12) & 1) << 31)
      | (((bits >>> 5) & 0x3f) << 25)
      | (rs2 << 20)
      | (rs1 << 15)
      | (definition.funct3 << 12)
      | (((bits >>> 1) & 0xf) << 8)
      | (((bits >>> 11) & 1) << 7)
      | definition.opcode;
  } else {
    if (instruction.rs2 === undefined) throw new TypeError('rs2 is required.');
    const rs1 = validateRegister(instruction.rs1, 'rs1');
    const rs2 = validateRegister(instruction.rs2, 'rs2');
    const imm = validateImmediate(instruction.imm, -2048, 2047, 1, 'S immediate');
    word = (((imm >>> 5) & 0x7f) << 25)
      | (rs2 << 20)
      | (rs1 << 15)
      | (definition.funct3 << 12)
      | ((imm & 0x1f) << 7)
      | definition.opcode;
  }
  return word >>> 0;
}

function signExtend(value: number, bits: number): number {
  const shift = 32 - bits;
  return (value << shift) >> shift;
}

function requireMode(mode: CpuMode): CpuMode {
  if (mode !== 'lab' && mode !== 'lecture') throw new TypeError(`Unsupported CPU mode: ${String(mode)}.`);
  return mode;
}

export function decode(word: number, mode: CpuMode = 'lab'): DecodedInstruction {
  requireMode(mode);
  checkedRange(word, 0, MASK32, 'Instruction word');
  const opcode = word & 0x7f;
  const rdField = (word >>> 7) & 0x1f;
  const funct3 = (word >>> 12) & 7;
  const rs1Field = (word >>> 15) & 0x1f;
  const rs2Field = (word >>> 20) & 0x1f;
  const funct7 = (word >>> 25) & 0x7f;
  let definition: InstructionDefinition | undefined;
  let instruction: Instruction;

  if (opcode === OP_R) {
    definition = Object.values(INSTRUCTIONS).find((entry) => entry.format === 'R'
      && entry.opcode === opcode && entry.funct3 === funct3 && entry.funct7 === funct7);
    if (!definition) throw new RangeError(`Unsupported R-type encoding 0x${word.toString(16)}.`);
    instruction = { name: definition.name, rd: rdField, rs1: rs1Field, rs2: rs2Field };
  } else if (opcode === OP_I || opcode === OP_LOAD) {
    definition = opcode === OP_I ? INSTRUCTIONS.addi : INSTRUCTIONS.lw;
    if (funct3 !== definition.funct3) throw new RangeError(`Unsupported ${definition.name} funct3 ${funct3}.`);
    instruction = { name: definition.name, rd: rdField, rs1: rs1Field, imm: signExtend(word >>> 20, 12) };
  } else if (opcode === OP_B) {
    definition = INSTRUCTIONS.beq;
    if (funct3 !== definition.funct3) throw new RangeError(`Unsupported branch funct3 ${funct3}.`);
    const imm = (((word >>> 31) & 1) << 12)
      | (((word >>> 25) & 0x3f) << 5)
      | (((word >>> 8) & 0xf) << 1)
      | (((word >>> 7) & 1) << 11);
    instruction = { name: 'beq', rs1: rs1Field, rs2: rs2Field, imm: signExtend(imm, 13) };
  } else if (opcode === OP_STORE) {
    definition = INSTRUCTIONS.sw;
    if (funct3 !== definition.funct3) throw new RangeError(`Unsupported sw funct3 ${funct3}.`);
    const imm = ((word >>> 25) << 5) | ((word >>> 7) & 0x1f);
    instruction = { name: 'sw', rs1: rs1Field, rs2: rs2Field, imm: signExtend(imm, 12) };
  } else {
    throw new RangeError(`Unsupported opcode 0x${opcode.toString(16)}.`);
  }

  if (!definition || (mode === 'lab' && definition.scope !== 'lab')) {
    throw new RangeError(`Instruction ${definition?.name ?? 'unknown'} is not supported in ${mode} mode.`);
  }
  return {
    ...instruction,
    word: word >>> 0,
    format: definition.format,
    opcode,
    funct3,
    funct7,
    a1: rs1Field & 7,
    a2: rs2Field & 7,
    a3: rdField & 7,
  };
}

export function controls(instruction: Instruction | InstructionName): ControlSignals {
  const name = typeof instruction === 'string' ? instruction : instruction?.name;
  const definition = instructionDefinition(name as InstructionName);
  const immSrc: ControlSignals['immSrc'] = definition.format === 'I' ? '00'
    : definition.format === 'S' ? '01'
      : definition.format === 'B' ? '10' : null;
  return {
    regWrite: definition.regWrite,
    aluSrc: definition.aluSrc,
    branch: definition.branch,
    aluControl: definition.alu,
    memWrite: definition.memWrite,
    resultSrc: definition.resultSrc,
    immSrc,
  };
}

export function alu(a: number, b: number, f: ALUFunction): { y: number; zero: Bit } {
  const left = toUnsigned(a);
  const right = toUnsigned(b);
  let y: number;
  switch (f) {
    case '000': y = left + right; break;
    case '001': y = left - right; break;
    case '010': y = left & right; break;
    case '011': y = left | right; break;
    case '101': y = toSigned(left) < toSigned(right) ? 1 : 0; break;
    default: throw new RangeError(`Unsupported ALU function: ${String(f)}.`);
  }
  const result = toUnsigned(y);
  return { y: result, zero: result === 0 ? 1 : 0 };
}

export function createState(mode: CpuMode = 'lab'): CpuState {
  return { pc: 0, registers: Array<number>(8).fill(0), memory: {}, cycles: 0, mode: requireMode(mode) };
}

function validateRegisterFile(registers: number[]): void {
  if (!Array.isArray(registers) || registers.length !== 8) throw new RangeError('The processor has exactly eight physical registers.');
  for (const value of registers) {
    if (!Number.isFinite(value)) throw new RangeError('Register values must be finite 32-bit values.');
  }
}

function physicalAddress(address: number): number {
  return checkedRange(address, 0, 31, 'Register address') & 7;
}

export function readRegister(registers: number[], address: number): number {
  validateRegisterFile(registers);
  const index = physicalAddress(address);
  return index === 0 ? 0 : toUnsigned(registers[index]);
}

export function writeRegister(registers: number[], address: number, value: number, enable: boolean): number[] {
  validateRegisterFile(registers);
  if (typeof enable !== 'boolean') throw new TypeError('Register write enable must be boolean.');
  const index = physicalAddress(address);
  const next = registers.map((item) => toUnsigned(item));
  next[0] = 0;
  if (enable && index !== 0) next[index] = toUnsigned(value);
  return next;
}

function validateState(state: CpuState): void {
  if (!state || typeof state !== 'object') throw new TypeError('CPU state is required.');
  requireMode(state.mode);
  const maxPc = state.mode === 'lab' ? 0xff : MASK32;
  checkedRange(state.pc, 0, maxPc, 'PC');
  if (state.pc % 4 !== 0) throw new RangeError(`PC ${state.pc} is not word-aligned.`);
  validateRegisterFile(state.registers);
  checkedRange(state.cycles, 0, Number.MAX_SAFE_INTEGER, 'Cycle count');
  if (!state.memory || typeof state.memory !== 'object' || Array.isArray(state.memory)) {
    throw new TypeError('Memory must be an address-to-word map.');
  }
  for (const [key, value] of Object.entries(state.memory)) {
    const address = Number(key);
    checkedRange(address, 0, MASK32, 'Memory address');
    if (address % 4 !== 0) throw new RangeError(`Memory address ${address} is not word-aligned.`);
    if (!Number.isFinite(value)) throw new RangeError('Memory values must be finite 32-bit values.');
  }
}

function normalizedPc(state: CpuState, value: number): number {
  return state.mode === 'lab' ? value & 0xff : value >>> 0;
}

function stateSignature(state: CpuState): string {
  const memory = Object.entries(state.memory)
    .map(([address, value]) => [Number(address), toUnsigned(value)] as const)
    .sort(([addressA], [addressB]) => addressA - addressB);
  return JSON.stringify({
    mode: state.mode,
    pc: state.pc,
    registers: state.registers.map(toUnsigned),
    memory,
    cycles: state.cycles,
  });
}

function traceSignature(trace: CycleTrace): string {
  return JSON.stringify(trace);
}

const traceOrigin = new WeakMap<CycleTrace, { state: string; trace: string }>();

export function traceCycle(state: CpuState, word: number): CycleTrace {
  validateState(state);
  const instruction = decode(word, state.mode);
  const control = controls(instruction);
  const rd1 = readRegister(state.registers, instruction.a1);
  const rd2 = readRegister(state.registers, instruction.a2);
  const immediate = instruction.imm ?? 0;
  const aluB = control.aluSrc ? toUnsigned(immediate) : rd2;
  const { y: aluResult, zero } = alu(rd1, aluB, control.aluControl);
  const branchTaken = control.branch === 1 && zero === 1;
  const pcPlus4 = normalizedPc(state, state.pc + 4);
  const branchTarget = normalizedPc(state, state.pc + immediate);
  if (branchTaken && branchTarget % 4 !== 0) {
    throw new RangeError(`Taken branch target ${branchTarget} is not word-aligned.`);
  }
  const pcNext = branchTaken ? branchTarget : pcPlus4;
  let memoryAddress: number | null = null;
  let memoryWrite: number | null = null;
  let writeData = aluResult;
  let writeRegister: number | null = control.regWrite === 1 ? instruction.a3 : null;

  if (instruction.name === 'lw' || instruction.name === 'sw') {
    memoryAddress = aluResult;
    if (memoryAddress % 4 !== 0) throw new RangeError(`Word memory address ${memoryAddress} is not aligned.`);
    if (instruction.name === 'lw') writeData = toUnsigned(state.memory[memoryAddress] ?? 0);
    else memoryWrite = rd2;
  }
  if (writeRegister === 0) writeRegister = 0;

  const trace: CycleTrace = Object.freeze({
    instruction: Object.freeze(instruction),
    control: Object.freeze(control),
    pc: state.pc,
    romAddress: state.pc >>> 2,
    rd1,
    rd2,
    immediate,
    aluB,
    aluResult,
    zero,
    branchTaken,
    pcPlus4,
    branchTarget,
    pcNext,
    writeData,
    writeRegister,
    memoryAddress,
    memoryWrite,
  });
  traceOrigin.set(trace, { state: stateSignature(state), trace: traceSignature(trace) });
  return trace;
}

export function commitCycle(state: CpuState, trace: CycleTrace): CpuState {
  validateState(state);
  const origin = traceOrigin.get(trace);
  if (!origin || origin.trace !== traceSignature(trace)) throw new TypeError('Trace was not produced by traceCycle or has been changed.');
  if (origin.state !== stateSignature(state)) throw new Error('Cannot commit a stale trace; the CPU state changed after tracing.');
  const registers = writeRegister(state.registers, trace.writeRegister ?? 0, trace.writeData, trace.control.regWrite === 1);
  const memory = { ...state.memory };
  if (trace.memoryAddress !== null && trace.memoryWrite !== null) {
    memory[trace.memoryAddress] = toUnsigned(trace.memoryWrite);
  }
  return {
    pc: trace.pcNext,
    registers,
    memory,
    cycles: state.cycles + 1,
    mode: state.mode,
  };
}

function randomValue(rng: () => number, label: string): number {
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError(`${label} must return a number in [0, 1).`);
  return value;
}

function randomInteger(rng: () => number, min: number, max: number, label: string): number {
  return min + Math.floor(randomValue(rng, label) * (max - min + 1));
}

export function generateScenario(name: 'add' | 'addi' | 'beq' = 'add', rng: () => number = Math.random): Scenario {
  const state = createState('lab');
  state.pc = randomInteger(rng, 0, 63, 'rng') * 4;
  for (let index = 1; index < 8; index += 1) state.registers[index] = toUnsigned(randomInteger(rng, -16, 24, 'rng'));
  const rs1 = randomInteger(rng, 1, 7, 'rng');
  const rs2Candidate = randomInteger(rng, 1, 6, 'rng');
  const rs2 = rs2Candidate >= rs1 ? rs2Candidate + 1 : rs2Candidate;
  let instruction: Instruction;
  if (name === 'add') {
    instruction = { name, rd: randomInteger(rng, 0, 7, 'rng'), rs1, rs2 };
  } else if (name === 'addi') {
    instruction = { name, rd: randomInteger(rng, 0, 7, 'rng'), rs1, imm: randomInteger(rng, -64, 63, 'rng') };
  } else if (name === 'beq') {
    if (randomValue(rng, 'rng') < 0.5) state.registers[rs2] = state.registers[rs1];
    else state.registers[rs2] = toUnsigned(toSigned(state.registers[rs1]) + 1);
    instruction = { name, rs1, rs2, imm: randomInteger(rng, -4, 4, 'rng') * 4 };
  } else {
    throw new RangeError(`No lab scenario is defined for ${String(name)}.`);
  }
  return { state, instruction, word: encode(instruction) };
}

function signedLabel(value: number): string {
  return `${toSigned(value)} (${formatValue(value, 'hex')})`;
}

export function traceSteps(scenario: Scenario): ExerciseStep[] {
  const trace = traceCycle(scenario.state, scenario.word);
  const { instruction, control } = trace;
  const regName = (address: number) => REGISTER_NAMES[address] ?? `x${address}`;
  const writeOutcome = trace.writeRegister === null ? 'No register write'
    : trace.writeRegister === 0 ? 'Ignored: x0 always remains zero'
      : `${regName(trace.writeRegister)} receives ${signedLabel(trace.writeData)}`;
  const steps: ExerciseStep[] = [
    { id: 'instruction', label: 'Which instruction does the ROM word encode?', answer: `${instruction.name} (opcode ${formatValue(trace.instruction.opcode, 'hex')})`, explanation: 'The decoder identifies the operation from the opcode and, for R-type instructions, the function fields.', component: 'decoder' },
    { id: 'rom-address', label: 'Which word does the ROM select?', answer: String(trace.romAddress), explanation: `The byte PC ${trace.pc} is shifted right by two because each ROM entry is one 32-bit instruction.`, component: 'rom' },
    { id: 'format', label: 'Which instruction format was decoded?', answer: trace.instruction.format, explanation: `${instruction.name} uses the ${trace.instruction.format}-format field layout.`, component: 'decoder' },
    { id: 'rs1-address', label: 'Which physical register is on read port 1?', answer: `${regName(trace.instruction.a1)} (x${trace.instruction.a1})`, explanation: `The instruction stores a five-bit rs1 field; the lab register file uses its low three bits.`, component: 'register-file' },
    { id: 'read-rs1', label: 'What value comes from read port 1?', answer: signedLabel(trace.rd1), explanation: `Read port 1 reads ${regName(trace.instruction.a1)} combinationally; reading x0 always returns zero.`, component: 'register-file' },
    { id: 'regwrite', label: 'Does the control unit enable register writes?', answer: control.regWrite ? 'Yes' : 'No', explanation: `${instruction.name} has RegWrite=${control.regWrite}; a write takes effect only at the rising edge.`, component: 'control' },
    { id: 'branch-enable', label: 'Does the control unit identify a branch instruction?', answer: control.branch ? 'Yes' : 'No', explanation: `Branch=${control.branch} identifies the instruction family. Branch AND Zero, rather than Branch alone, determines whether beq is taken.`, component: 'control' },
    { id: 'alu-function', label: 'Which ALUControl code does the control unit generate?', answer: control.aluControl, choices: ALU_FUNCTIONS.map(({ code }) => code), explanation: `The decoder generates ALUControl=${control.aluControl}, selecting ${ALU_FUNCTIONS.find(({ code }) => code === control.aluControl)?.name} for ${instruction.name}. This code is a control output, not the instruction's funct3 field.`, component: 'control' },
    { id: 'pc-plus-four', label: 'What is PC + 4?', answer: String(trace.pcPlus4), explanation: `The next sequential instruction is four bytes later; in lab mode the eight-bit PC wraps at 256.`, component: 'pc' },
  ];
  if (instruction.name !== 'addi') {
    steps.splice(4, 0,
      { id: 'rs2-address', label: 'Which physical register is on read port 2?', answer: `${regName(trace.instruction.a2)} (x${trace.instruction.a2})`, explanation: `The ${instruction.name} instruction has an rs2 field; its five-bit encoded address is reduced to the low three physical address bits.`, component: 'register-file' },
      { id: 'read-rs2', label: 'What value comes from read port 2?', answer: signedLabel(trace.rd2), explanation: `Read port 2 reads ${regName(trace.instruction.a2)} combinationally; this value feeds the ALU for ${instruction.name}.`, component: 'register-file' },
    );
  }
  if (instruction.name !== 'beq') {
    steps.splice(5, 0, {
      id: 'rd-address', label: 'Which destination register is selected?',
      answer: trace.writeRegister === null ? 'none' : `${regName(trace.writeRegister)} (x${trace.writeRegister})`,
      explanation: 'The destination field is five bits; the physical register file uses its low three bits.', component: 'register-file',
    });
  }
  if (instruction.name === 'addi' || instruction.name === 'beq') {
    const insertion = instruction.name === 'addi' ? 5 : steps.findIndex(({ id }) => id === 'regwrite');
    steps.splice(insertion, 0, {
      id: 'immediate', label: instruction.name === 'beq' ? 'What signed branch displacement was decoded?' : 'What signed immediate was decoded?',
      answer: String(trace.immediate),
      explanation: `The ${trace.instruction.format}-format immediate is reconstructed from its instruction bits and sign-extended to 32 bits.`, component: 'immediate',
    });
  }
  const sourceIndex = steps.findIndex(({ id }) => id === 'alu-function');
  steps.splice(sourceIndex, 0, {
    id: 'alusrc-control', label: 'What ALUSrc signal selects the B operand source?', answer: String(control.aluSrc), choices: ['0', '1'],
    explanation: `ALUSrc=${control.aluSrc} selects ${control.aluSrc ? 'the sign-extended immediate' : 'RD2 from the register file'} for ${instruction.name}. ALUSrc selects the operand source; ALUControl selects the operation.`, component: 'control',
  }, {
    id: 'alusrc', label: 'Which value does the ALU use for input B?', answer: signedLabel(trace.aluB),
    explanation: `ALUSrc=${control.aluSrc ? 1 : 0}, so input B comes from ${control.aluSrc ? 'the sign-extended immediate' : 'read port 2'}.`, component: 'alu',
  });
  const resultIndex = steps.findIndex(({ id }) => id === 'pc-plus-four');
  steps.splice(resultIndex, 0,
    { id: 'alu-result', label: 'What 32-bit value does the ALU produce?', answer: signedLabel(trace.aluResult), explanation: `The ALU applies its selected operation to ${signedLabel(trace.rd1)} and ${signedLabel(trace.aluB)}.`, component: 'alu' },
    { id: 'zero-flag', label: 'Is the ALU Zero output asserted?', answer: trace.zero ? 'Yes (1)' : 'No (0)', explanation: instruction.name === 'beq' ? 'beq uses the Zero output from subtraction to determine whether the two source registers are equal.' : 'The ALU Zero output is asserted when the ADD result is zero.', component: 'alu' },
  );
  if (instruction.name === 'beq') {
    const branchIndex = steps.findIndex(({ id }) => id === 'pc-plus-four');
    steps.splice(branchIndex, 0,
      { id: 'branch-decision', label: 'Is the branch taken?', answer: trace.branchTaken ? 'Yes' : 'No', explanation: `beq is taken when Branch is enabled and subtraction produces Zero=1.`, component: 'branch' },
      { id: 'branch-target', label: 'What branch target is calculated?', answer: String(trace.branchTarget), explanation: 'The branch target is the current PC plus the signed byte displacement, then the PC width is applied.', component: 'branch' },
    );
  }
  const nextPcIndex = steps.findIndex(({ id }) => id === 'pc-plus-four') + 1;
  steps.splice(nextPcIndex, 0, {
    id: 'next-pc', label: 'What value is loaded into PC at the rising edge?', answer: String(trace.pcNext),
    explanation: `PC selects ${instruction.name === 'beq' ? 'the branch target when taken, otherwise PC + 4' : 'PC + 4'}. This update happens at the clock edge.`, component: 'pc',
  });
  if (instruction.name !== 'beq') {
    steps.push({ id: 'write-result', label: 'What happens to the destination register at the rising edge?', answer: writeOutcome, explanation: 'WD3 is available during the cycle. The enabled destination register captures that value at the rising edge; a write to x0 is ignored.', component: 'clock' });
  }
  steps.push({ id: 'clock-boundary', label: 'Has the processor state changed during this trace?', answer: 'No; stored state waits for the rising edge.', choices: ['No; stored state waits for the rising edge.', 'Yes; the ALU result immediately updates PC.'], explanation: 'Decode, register reads, muxes, ALU and PCnext settle during the cycle. Stored PC and register contents update together at the rising edge.', component: 'clock' });
  // Keep the learning phases monotonic: identify all addresses before
  // evaluating operand data, then distinguish pending values from the edge.
  const order = [
    'instruction', 'rom-address', 'format', 'rs1-address', 'rs2-address', 'rd-address', 'immediate',
    'regwrite', 'alusrc-control', 'alu-function', 'branch-enable', 'read-rs1', 'read-rs2', 'alusrc',
    'alu-result', 'zero-flag', 'branch-decision', 'pc-plus-four', 'branch-target', 'next-pc',
    'write-result', 'clock-boundary',
  ];
  return steps.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

function registerIndex(token: string, mode: CpuMode): number {
  const normalized = token.trim().toLowerCase();
  const alias = REGISTER_NAMES.indexOf(normalized);
  const numeric = /^x(\d+)$/.exec(normalized);
  const value = alias >= 0 ? alias : numeric ? Number(numeric[1]) : -1;
  if (!Number.isInteger(value) || value < 0 || value > 31) throw new SyntaxError(`Unknown register: ${token}`);
  if (mode === 'lab' && value > 7) throw new RangeError(`Lab programs may only use x0–x7; found ${token}.`);
  return value;
}

function parseImmediateToken(token: string): number {
  return toSigned(parseValue(token));
}

function splitOperands(text: string): string[] {
  return text.split(',').map((part) => part.trim());
}

interface PendingLine { source: string; mnemonic: string; operands: string[]; line: number; address: number; }

export function parseAssembly(source: string, mode: CpuMode = 'lab'): ProgramLine[] {
  requireMode(mode);
  if (typeof source !== 'string') throw new TypeError('Assembly source must be text.');
  const labels = new Map<string, number>();
  const pending: PendingLine[] = [];
  const lines = source.split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    let clean = lines[lineIndex].replace(/#.*$|\/\/.*$/, '').trim();
    if (!clean || clean === '.text') continue;
    if (clean.startsWith('.')) throw new SyntaxError(`Unsupported directive on line ${lineIndex + 1}: ${clean}`);
    let labelMatch: RegExpExecArray | null;
    while ((labelMatch = /^([A-Za-z_.$][\w.$]*):\s*/.exec(clean))) {
      const label = labelMatch[1];
      if (labels.has(label)) throw new SyntaxError(`Duplicate label "${label}" on line ${lineIndex + 1}.`);
      labels.set(label, pending.length * 4);
      clean = clean.slice(labelMatch[0].length).trim();
      if (!clean) break;
    }
    if (!clean) continue;
    const match = /^([A-Za-z][\w.]*)\s*(.*)$/.exec(clean);
    if (!match) throw new SyntaxError(`Invalid instruction on line ${lineIndex + 1}: ${clean}`);
    const mnemonic = match[1].toLowerCase();
    if (!(mnemonic in INSTRUCTIONS)) throw new SyntaxError(`Unsupported instruction or pseudo-op "${mnemonic}" on line ${lineIndex + 1}.`);
    if (mode === 'lab' && INSTRUCTIONS[mnemonic as InstructionName].scope !== 'lab') {
      throw new RangeError(`Instruction ${mnemonic} is only available in lecture mode (line ${lineIndex + 1}).`);
    }
    const operands = match[2] ? splitOperands(match[2]) : [];
    pending.push({ source: clean, mnemonic, operands, line: lineIndex + 1, address: (pending.length * 4) >>> 0 });
  }
  if (mode === 'lab' && pending.length > 64) throw new RangeError('Lab programs may contain at most 64 instructions.');

  const program: ProgramLine[] = [];
  for (const row of pending) {
    const failCount = (expected: number) => {
      if (row.operands.length !== expected || row.operands.some((part) => part.length === 0)) {
        throw new SyntaxError(`${row.mnemonic} on line ${row.line} expects ${expected} operand${expected === 1 ? '' : 's'}.`);
      }
    };
    let instruction: Instruction;
    if (['add', 'and', 'or', 'slt'].includes(row.mnemonic)) {
      failCount(3);
      instruction = {
        name: row.mnemonic as InstructionName,
        rd: registerIndex(row.operands[0], mode),
        rs1: registerIndex(row.operands[1], mode),
        rs2: registerIndex(row.operands[2], mode),
      };
    } else if (row.mnemonic === 'addi') {
      failCount(3);
      instruction = {
        name: 'addi', rd: registerIndex(row.operands[0], mode), rs1: registerIndex(row.operands[1], mode),
        imm: parseImmediateToken(row.operands[2]),
      };
    } else if (row.mnemonic === 'beq') {
      failCount(3);
      const rs1 = registerIndex(row.operands[0], mode);
      const rs2 = registerIndex(row.operands[1], mode);
      const displacement = labels.has(row.operands[2])
        ? labels.get(row.operands[2])! - row.address
        : parseImmediateToken(row.operands[2]);
      instruction = { name: 'beq', rs1, rs2, imm: displacement };
    } else {
      failCount(2);
      const memoryOperand = /^(.+)\(\s*([A-Za-z0-9]+)\s*\)$/.exec(row.operands[1]);
      if (!memoryOperand) throw new SyntaxError(`${row.mnemonic} on line ${row.line} expects offset(base).`);
      const imm = parseImmediateToken(memoryOperand[1].trim());
      const rs1 = registerIndex(memoryOperand[2], mode);
      if (row.mnemonic === 'lw') {
        instruction = { name: 'lw', rd: registerIndex(row.operands[0], mode), rs1, imm };
      } else {
        instruction = { name: 'sw', rs2: registerIndex(row.operands[0], mode), rs1, imm };
      }
    }
    try {
      const word = encode(instruction);
      program.push({ address: row.address, word, instruction, source: row.source });
    } catch (error) {
      if (error instanceof Error) throw new RangeError(`Line ${row.line}: ${error.message}`);
      throw error;
    }
  }
  return program;
}

function registerText(value: number | undefined): string {
  if (value === undefined) throw new TypeError('Instruction is missing a register operand.');
  const index = validateRegister(value, 'register operand');
  return REGISTER_NAMES[index] ?? `x${index}`;
}

export function instructionText(instruction: Instruction): string {
  const { name } = instruction;
  instructionDefinition(name);
  if (['add', 'and', 'or', 'slt'].includes(name)) {
    return `${name} ${registerText(instruction.rd)}, ${registerText(instruction.rs1)}, ${registerText(instruction.rs2)}`;
  }
  if (name === 'addi') return `addi ${registerText(instruction.rd)}, ${registerText(instruction.rs1)}, ${instruction.imm ?? ''}`;
  if (name === 'beq') return `beq ${registerText(instruction.rs1)}, ${registerText(instruction.rs2)}, ${instruction.imm ?? ''}`;
  if (name === 'lw') return `lw ${registerText(instruction.rd)}, ${instruction.imm ?? ''}(${registerText(instruction.rs1)})`;
  return `sw ${registerText(instruction.rs2)}, ${instruction.imm ?? ''}(${registerText(instruction.rs1)})`;
}

export function factorialSource(n: number): string {
  checkedRange(n, 0, 8, 'Factorial input');
  return [
    `.text`,
    `addi t0, zero, ${n}   # input n`,
    `addi t1, zero, 1      # accumulator`,
    `beq t0, zero, done`,
    `outer:`,
    `beq t0, zero, done`,
    `addi t2, zero, 0      # sum for repeated addition`,
    `addi ra, t0, 0        # multiply accumulator by t0`,
    `inner:`,
    `beq ra, zero, product_ready`,
    `add t2, t2, t1`,
    `addi ra, ra, -1`,
    `beq zero, zero, inner`,
    `product_ready:`,
    `addi t1, t2, 0`,
    `addi t0, t0, -1`,
    `beq zero, zero, outer`,
    `done:`,
    `addi t2, t1, 0        # result`,
    `stop: beq zero, zero, stop`,
  ].join('\n');
}
