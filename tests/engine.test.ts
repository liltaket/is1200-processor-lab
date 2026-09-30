import { describe, expect, it } from 'vitest';
import {
  ALU_FUNCTIONS,
  INSTRUCTIONS,
  alu,
  commitCycle,
  controls,
  createState,
  decode,
  encode,
  factorialSource,
  formatValue,
  generateScenario,
  parseAssembly,
  parseValue,
  readRegister,
  toSigned,
  toUnsigned,
  traceCycle,
  traceSteps,
  writeRegister,
} from '../src/engine';
import type { Instruction } from '../src/engine';

function seededRandom(seed = 0x1200): () => number {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1_664_525) + 1_013_904_223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function runFactorial(n: number): number {
  const program = parseAssembly(factorialSource(n), 'lab');
  const state = createState('lab');
  const words = new Map(program.map(({ address, word }) => [address, word]));
  for (let step = 0; step < 10_000; step += 1) {
    const word = words.get(state.pc);
    if (word === undefined) throw new Error(`Execution left the program at PC ${state.pc}.`);
    const trace = traceCycle(state, word);
    const next = commitCycle(state, trace);
    if (next.pc === state.pc && trace.branchTaken) return next.registers[7];
    Object.assign(state, next);
  }
  throw new Error('Factorial program did not reach its stop loop.');
}

describe('instruction encoding and decoding', () => {
  it('defines the lab subset and lecture extensions with the expected ALU functions', () => {
    expect(Object.keys(INSTRUCTIONS)).toEqual(['add', 'addi', 'beq', 'and', 'or', 'slt', 'lw', 'sw']);
    expect(ALU_FUNCTIONS.map(({ code }) => code)).toEqual(['000', '001', '010', '011', '101']);
    expect(() => decode(encode({ name: 'and', rd: 1, rs1: 2, rs2: 3 }), 'lab')).toThrow(/not supported/);
  });

  it('round-trips randomized R, I, B and S instructions including full five-bit fields', () => {
    const rng = seededRandom();
    for (let index = 0; index < 400; index += 1) {
      const rs1 = randomInt(rng, 0, 31);
      const rs2 = randomInt(rng, 0, 31);
      const rd = randomInt(rng, 0, 31);
      const choice = index % 8;
      let instruction: Instruction;
      if (choice === 0) instruction = { name: 'add' as const, rd, rs1, rs2 };
      else if (choice === 1) instruction = { name: 'and' as const, rd, rs1, rs2 };
      else if (choice === 2) instruction = { name: 'or' as const, rd, rs1, rs2 };
      else if (choice === 3) instruction = { name: 'slt' as const, rd, rs1, rs2 };
      else if (choice === 4) instruction = { name: 'addi' as const, rd, rs1, imm: randomInt(rng, -2048, 2047) };
      else if (choice === 5) instruction = { name: 'lw' as const, rd, rs1, imm: randomInt(rng, -2048, 2047) };
      else if (choice === 6) instruction = { name: 'beq' as const, rs1, rs2, imm: randomInt(rng, -2048, 2047) * 2 };
      else instruction = { name: 'sw' as const, rs1, rs2, imm: randomInt(rng, -2048, 2047) };
      const word = encode(instruction);
      const decoded = decode(word, 'lecture');
      expect(decoded.name).toBe(instruction.name);
      expect(decoded.rd).toBe(instruction.rd);
      expect(decoded.rs1).toBe(instruction.rs1);
      expect(decoded.rs2).toBe(instruction.rs2);
      expect(decoded.imm).toBe(instruction.imm);
      if (instruction.rs1 !== undefined) expect(decoded.a1).toBe(instruction.rs1 & 7);
      if (instruction.rs2 !== undefined) expect(decoded.a2).toBe(instruction.rs2 & 7);
      if (instruction.rd !== undefined) expect(decoded.a3).toBe(instruction.rd & 7);
    }
  });

  it('enforces exact immediate and register field bounds', () => {
    expect(encode({ name: 'addi', rd: 31, rs1: 31, imm: -2048 })).toBeGreaterThan(0);
    expect(encode({ name: 'beq', rs1: 1, rs2: 2, imm: -4096 })).toBeGreaterThan(0);
    expect(encode({ name: 'beq', rs1: 1, rs2: 2, imm: 4094 })).toBeGreaterThan(0);
    expect(() => encode({ name: 'addi', rd: 32, rs1: 0, imm: 0 })).toThrow();
    expect(() => encode({ name: 'addi', rd: 1, rs1: 0, imm: -2049 })).toThrow();
    expect(() => encode({ name: 'addi', rd: 1, rs1: 0, imm: 2048 })).toThrow();
    expect(() => encode({ name: 'beq', rs1: 0, rs2: 0, imm: -4098 })).toThrow();
    expect(() => encode({ name: 'beq', rs1: 0, rs2: 0, imm: 4096 })).toThrow();
    expect(() => encode({ name: 'beq', rs1: 0, rs2: 0, imm: 3 })).toThrow(/multiple of 2/);
  });
});

describe('numeric values, register file, and ALU', () => {
  it('parses bounded numeric forms and formats the same 32-bit bit pattern', () => {
    expect(parseValue('-2147483648')).toBe(0x8000_0000);
    expect(parseValue('0xffffffff')).toBe(0xffff_ffff);
    expect(parseValue('0b10101')).toBe(21);
    expect(formatValue(0x8000_0000)).toBe('-2147483648');
    expect(formatValue(0x8000_0000, 'hex')).toBe('0x80000000');
    expect(formatValue(5, 'binary')).toBe(`0b${'0'.repeat(29)}101`);
    expect(toSigned(0xffff_ffff)).toBe(-1);
    expect(toUnsigned(-1)).toBe(0xffff_ffff);
    for (const invalid of ['', '1.5', 'Infinity', '12oops', '0x', '0b102', '2147483648', '-2147483649']) {
      expect(() => parseValue(invalid)).toThrow();
    }
  });

  it('maps five-bit encoded register fields to the low-three-bit physical file', () => {
    const registers = [0, 11, 22, 33, 44, 55, 66, 77];
    expect(readRegister(registers, 13)).toBe(55);
    const next = writeRegister(registers, 15, 0x1_0000_0005, true);
    expect(next).not.toBe(registers);
    expect(next[7]).toBe(5);
    expect(next[0]).toBe(0);
    expect(writeRegister(registers, 8, 99, true)[0]).toBe(0);
  });

  it('wraps 32-bit arithmetic and implements signed SLT', () => {
    expect(alu(0xffff_ffff, 1, '000')).toEqual({ y: 0, zero: 1 });
    expect(alu(0x7fff_ffff, 1, '000').y).toBe(0x8000_0000);
    expect(alu(0x8000_0000, 0x7fff_ffff, '101').y).toBe(1);
    expect(alu(0x7fff_ffff, 0x8000_0000, '101').y).toBe(0);
    expect(alu(0b1100, 0b1010, '010').y).toBe(0b1000);
    expect(alu(0b1100, 0b1010, '011').y).toBe(0b1110);
  });
});

describe('datapath tracing and rising-edge commits', () => {
  it('supplies controls for each instruction class', () => {
    expect(controls('add')).toMatchObject({ regWrite: 1, aluSrc: 0, branch: 0, aluControl: '000', immSrc: null });
    expect(controls('addi')).toMatchObject({ regWrite: 1, aluSrc: 1, immSrc: '00' });
    expect(controls('beq')).toMatchObject({ regWrite: 0, branch: 1, aluControl: '001', immSrc: '10' });
    expect(controls('lw')).toMatchObject({ regWrite: 1, resultSrc: 1, memWrite: 0 });
    expect(controls('sw')).toMatchObject({ regWrite: 0, resultSrc: 0, memWrite: 1, immSrc: '01' });
  });

  it('keeps traces pure, delays writes, wraps the lab PC, and rejects stale snapshots', () => {
    const state = createState();
    state.pc = 252;
    const trace = traceCycle(state, encode({ name: 'addi', rd: 5, rs1: 0, imm: 9 }));
    expect(trace).toMatchObject({ romAddress: 63, pcPlus4: 0, writeData: 9, writeRegister: 5 });
    expect(Object.isFrozen(trace)).toBe(true);
    expect(Object.isFrozen(trace.instruction)).toBe(true);
    expect(state.pc).toBe(252);
    expect(state.registers[5]).toBe(0);
    const next = commitCycle(state, trace);
    expect(next.pc).toBe(0);
    expect(next.registers[5]).toBe(9);
    state.registers[6] = 1;
    expect(() => commitCycle(state, trace)).toThrow(/stale/);
    expect(() => traceCycle({ ...createState(), pc: 2 }, encode({ name: 'addi', rd: 1, rs1: 0, imm: 1 }))).toThrow(/aligned/);
    const oddTarget = encode({ name: 'beq', rs1: 0, rs2: 0, imm: 2 });
    expect(() => traceCycle(createState(), oddTarget)).toThrow(/Taken branch target/);
    const backwards = createState();
    backwards.pc = 8;
    expect(traceCycle(backwards, encode({ name: 'beq', rs1: 0, rs2: 0, imm: -4 }))).toMatchObject({ branchTaken: true, branchTarget: 4, pcNext: 4 });
  });

  it('isolates lecture loads and stores in a word-addressed memory map', () => {
    const state = createState('lecture');
    state.registers[1] = 100;
    state.registers[7] = 0xdead_beef;
    const store = traceCycle(state, encode({ name: 'sw', rs1: 1, rs2: 7, imm: 8 }));
    expect(store).toMatchObject({ memoryAddress: 108, memoryWrite: 0xdead_beef, writeRegister: null });
    const afterStore = commitCycle(state, store);
    expect(afterStore.memory[108]).toBe(0xdead_beef);
    const load = traceCycle(afterStore, encode({ name: 'lw', rd: 13, rs1: 1, imm: 8 }));
    expect(load).toMatchObject({ memoryAddress: 108, writeRegister: 5, writeData: 0xdead_beef });
    expect(commitCycle(afterStore, load).registers[5]).toBe(0xdead_beef);
  });

  it('derives at least fifteen explanation questions from the actual trace', () => {
    const scenario = { state: createState(), instruction: { name: 'beq' as const, rs1: 0, rs2: 0, imm: 4 }, word: encode({ name: 'beq', rs1: 0, rs2: 0, imm: 4 }) };
    const steps = traceSteps(scenario);
    expect(steps.length).toBeGreaterThanOrEqual(15);
    expect(steps.find(({ id }) => id === 'branch-decision')?.answer).toBe('Yes');
    expect(steps.find(({ id }) => id === 'next-pc')?.answer).toBe('4');
    expect(steps.every(({ explanation, answer }) => Boolean(explanation && answer))).toBe(true);
    const addiSteps = traceSteps({ state: createState(), instruction: { name: 'addi', rd: 5, rs1: 0, imm: 3 }, word: encode({ name: 'addi', rd: 5, rs1: 0, imm: 3 }) });
    expect(addiSteps.some(({ id }) => id === 'rs2-address' || id === 'read-rs2')).toBe(false);
    expect(addiSteps.some(({ id }) => id === 'branch-target')).toBe(false);
    expect(steps.some(({ id }) => id === 'rd-address' || id === 'write-result')).toBe(false);
  });

  it('generates readable, aligned scenarios with distinct beq operands and both outcomes', () => {
    for (const rng of [() => 0, seededRandom(2026)]) {
      const generated = generateScenario('beq', rng);
      expect(generated.state.pc % 4).toBe(0);
      expect(generated.state.registers.slice(1).every((value) => Math.abs(toSigned(value)) <= 24)).toBe(true);
      expect(generated.instruction.name).toBe('beq');
      expect(generated.instruction.rs1).not.toBe(generated.instruction.rs2);
      expect(() => traceCycle(generated.state, generated.word)).not.toThrow();
    }
    const taken = generateScenario('beq', () => 0);
    const notTaken = generateScenario('beq', () => 0.99);
    expect(traceCycle(taken.state, taken.word).branchTaken).toBe(true);
    expect(traceCycle(notTaken.state, notTaken.word).branchTaken).toBe(false);
    expect(taken.instruction.imm).toBe(-16);
    expect(notTaken.instruction.imm).toBe(16);
    expect(() => generateScenario('add', () => 1)).toThrow(/\[0, 1\)/);
  });
});

describe('assembly programs and factorial lesson', () => {
  it('resolves labels to signed byte offsets and accepts only real instructions', () => {
    const program = parseAssembly('.text\nstart: addi t0, zero, 2\nbeq t0, zero, start\nstop: beq zero, zero, stop');
    expect(program.map(({ address }) => address)).toEqual([0, 4, 8]);
    expect(program[1].instruction.imm).toBe(-4);
    expect(program[2].instruction.imm).toBe(0);
    expect(() => parseAssembly('j somewhere')).toThrow(/pseudo-op/);
    expect(() => parseAssembly('.data')).toThrow(/directive/);
    expect(() => parseAssembly('add x1, x8, x2')).toThrow(/x0–x7/);
    expect(() => parseAssembly('and t0, t1, t2', 'lab')).toThrow(/lecture mode/);
    expect(() => parseAssembly(`.text\n${Array.from({ length: 65 }, () => 'addi t0, t0, 0').join('\n')}`)).toThrow(/64 instructions/);
    expect(parseAssembly('add x10, x13, x15', 'lecture')[0].instruction.rs1).toBe(13);
  });

  it.each([[0, 1], [3, 6], [8, 40_320]])('computes %i! with repeated addition and leaves the result in t2', (n, expected) => {
    expect(runFactorial(n)).toBe(expected);
  });

  it('keeps the required first input instruction and final self-loop', () => {
    for (const n of [0, 3, 8]) {
      const program = parseAssembly(factorialSource(n));
      expect(program[0].instruction).toEqual({ name: 'addi', rd: 5, rs1: 0, imm: n });
      const last = program.at(-1)?.instruction;
      expect(last).toMatchObject({ name: 'beq', rs1: 0, rs2: 0, imm: 0 });
    }
    expect(() => factorialSource(-1)).toThrow();
    expect(() => factorialSource(9)).toThrow();
  });
});
