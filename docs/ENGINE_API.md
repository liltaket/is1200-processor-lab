# Shared processor API contract

All UI imports from `src/engine/index.ts`. Numeric data is unsigned 32-bit internally; `toSigned` interprets signed values. Branch/addi immediates are signed byte displacements/integers. Lab PC arithmetic wraps to eight bits. Lecture uses 32-bit PC, still eight registers so extensions don't silently expand the lab register set.

Required exports:

```ts
export * from './types';
INSTRUCTIONS: Record<InstructionName, InstructionDefinition>
REGISTER_NAMES: readonly string[] // zero, ra, sp, gp, tp, t0, t1, t2
ALU_FUNCTIONS: {code: ALUFunction; name: string}[]
toUnsigned(n: number): number
toSigned(n: number): number
formatValue(n: number, base?: 'decimal'|'hex'|'binary'): string
parseValue(text: string): number // strict finite signed decimal / 0x / 0b parser; throw invalid
encode(instruction: Instruction): number // valid standard 5-bit register fields, strict ranges
decode(word: number, mode?: CpuMode): DecodedInstruction // a1/a2/a3 low 3; throw unsupported
controls(instruction: Instruction | InstructionName): ControlSignals
alu(a: number,b: number,f: ALUFunction): {y:number;zero:Bit}
createState(mode?: CpuMode): CpuState
readRegister(registers:number[],address:number): number
writeRegister(registers:number[],address:number,value:number,enable:boolean): number[] // fresh array, x0=0
traceCycle(state:CpuState,word:number): CycleTrace // no mutations
commitCycle(state:CpuState,trace:CycleTrace): CpuState // edge only; validate stale trace
generateScenario(name?: 'add'|'addi'|'beq',rng?:()=>number): Scenario
traceSteps(scenario:Scenario): ExerciseStep[] // all decode/control/data/PC/rising edge answers & why
parseAssembly(source:string,mode?:CpuMode): ProgramLine[] // label resolution, add/addi/beq and extensions; forbid >7 operands for lab programs; max 64 instructions in lab; .text/comments allowed, no pseudo ops
instructionText(instruction:Instruction): string
factorialSource(n:number): string // illustrative, n=0..8; first addi t0,zero,n; stop self-loop
```

Every UI must call these functions for semantics. Components may generate input values but may not reimplement execution or encoding.
