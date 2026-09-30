export type InstructionName = 'add' | 'addi' | 'beq' | 'and' | 'or' | 'slt' | 'lw' | 'sw';
export type CpuMode = 'lab' | 'lecture';
export type InstructionFormat = 'R' | 'I' | 'B' | 'S';
export type ALUFunction = '000' | '001' | '010' | '011' | '101';
export type Bit = 0 | 1;
export interface InstructionDefinition {
  name: InstructionName; format: InstructionFormat; opcode: number; funct3: number; funct7?: number;
  alu: ALUFunction; regWrite: Bit; aluSrc: Bit; branch: Bit; memWrite: Bit; resultSrc: Bit;
  syntax: string; scope: CpuMode;
}
export interface Instruction {
  name: InstructionName; rd?: number; rs1: number; rs2?: number; imm?: number;
}
export interface DecodedInstruction extends Instruction {
  word: number; format: InstructionFormat; opcode: number; funct3: number; funct7: number;
  a1: number; a2: number; a3: number;
}
export interface ControlSignals {
  regWrite: Bit; aluSrc: Bit; branch: Bit; aluControl: ALUFunction;
  memWrite: Bit; resultSrc: Bit; immSrc: '00' | '01' | '10' | null;
}
export interface CpuState { pc: number; registers: number[]; memory: Record<number, number>; cycles: number; mode: CpuMode; }
export interface CycleTrace {
  instruction: DecodedInstruction; control: ControlSignals; pc: number; romAddress: number;
  rd1: number; rd2: number; immediate: number; aluB: number; aluResult: number; zero: Bit;
  branchTaken: boolean; pcPlus4: number; branchTarget: number; pcNext: number; writeData: number;
  writeRegister: number | null; memoryAddress: number | null; memoryWrite: number | null;
}
export interface Scenario { state: CpuState; instruction: Instruction; word: number; }
export type Topic = 'datapath' | 'formats' | 'control' | 'registers' | 'alu' | 'branch' | 'clock' | 'encoding' | 'rom' | 'factorial' | 'oral';
export interface ExerciseStep { id: string; label: string; answer: string; explanation: string; component: string; choices?: string[]; }
export interface ProgramLine { address: number; word: number; instruction: Instruction; source: string; }
