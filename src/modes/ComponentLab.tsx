import { useState } from 'react';
import { ArrowRight, Eye, RotateCcw, Sparkles, Zap } from 'lucide-react';
import type { ModeProps } from '../ui-types';
import {
  ALU_FUNCTIONS,
  INSTRUCTIONS,
  REGISTER_NAMES,
  alu,
  decode,
  formatValue,
  generateScenario,
  parseValue,
  readRegister,
  toSigned,
  toUnsigned,
  traceCycle,
  writeRegister,
} from '../engine';
import type { ALUFunction, ControlSignals, Scenario } from '../engine';
import { Feedback, useCheck } from './trainerFeedback';

export interface ComponentLabProps extends ModeProps {
  topic: 'alu' | 'registers' | 'control';
}

function BaseDisplay({ value, onChange }: { value: 'decimal' | 'hex' | 'binary'; onChange: (value: 'decimal' | 'hex' | 'binary') => void }) {
  return (
    <label className="field trainer-field-label trainer-base-select">
      <span>Number format</span>
      <select className="trainer-control" value={value} onChange={(event) => onChange(event.target.value as typeof value)}>
        <option value="decimal">Decimal</option><option value="hex">Hexadecimal</option><option value="binary">Binary</option>
      </select>
    </label>
  );
}

function parseBitPattern(text: string): number | null {
  try { return text.trim() ? parseValue(text) : null; } catch { return null; }
}

function RegisterCell({ index, value, projected, base }: { index: number; value: number; projected: number; base: 'decimal' | 'hex' | 'binary' }) {
  const changed = value !== projected;
  return (
    <div className={`trainer-register-cell ${changed ? 'is-pending' : ''}`}>
      <span>{REGISTER_NAMES[index]} <small>x{index}</small></span>
      <strong className="mono">{formatValue(value, base)}</strong>
      {changed && <small className="trainer-register-next">Edge → {formatValue(projected, base)}</small>}
    </div>
  );
}

const seedRegisters = [0, 11, -7, 24, 3, 42, -19, 8].map(toUnsigned);

interface RegisterQuestion {
  before: number[];
  address: number;
  data: number;
  enable: boolean;
  outcome: 'disabled' | 'x0' | 'write';
  after: number[];
}

function createRegisterQuestion(): RegisterQuestion {
  const before = [...seedRegisters];
  const address = Math.floor(Math.random() * 8);
  const enable = Math.random() >= 0.25;
  const current = readRegister(before, address);
  const data = toUnsigned((toSigned(current) + 31 + Math.floor(Math.random() * 25)) | 0);
  const after = writeRegister(before, address, data, enable);
  return { before, address, data, enable, after, outcome: !enable ? 'disabled' : address === 0 ? 'x0' : 'write' };
}

function RegisterFileLab({ onAttempt }: Pick<ModeProps, 'onAttempt'>) {
  const [registers, setRegisters] = useState<number[]>(() => [...seedRegisters]);
  const [a1, setA1] = useState(5);
  const [a2, setA2] = useState(6);
  const [a3, setA3] = useState(7);
  const [wdText, setWdText] = useState('99');
  const [we3, setWe3] = useState(true);
  const [cycles, setCycles] = useState(0);
  const [base, setBase] = useState<'decimal' | 'hex' | 'binary'>('decimal');
  const [edgeNote, setEdgeNote] = useState('');
  const [question, setQuestion] = useState(createRegisterQuestion);
  const [prediction, setPrediction] = useState('');
  const check = useCheck('registers', onAttempt);
  const wd = parseBitPattern(wdText);
  const projected = wd === null ? registers : writeRegister(registers, a3, wd, we3);
  const rd1 = readRegister(registers, a1);
  const rd2 = readRegister(registers, a2);

  const predictionOptions = [
    { value: 'disabled', label: 'No write: WE3 is off' },
    { value: 'x0', label: 'Ignored: x0 stays zero' },
    { value: 'write', label: `Write ${REGISTER_NAMES[question.address]} (x${question.address})` },
  ];
  const predictionExpected = question.outcome === 'write'
    ? `${REGISTER_NAMES[question.address]} (x${question.address}) changes from ${formatValue(readRegister(question.before, question.address), base)} to ${formatValue(readRegister(question.after, question.address), base)}.`
    : question.outcome === 'x0' ? 'The write is ignored; x0 remains zero.' : 'No register changes because WE3 is 0.';
  const predictionWhy = question.outcome === 'write'
    ? `WE3=1 and A3 selects x${question.address}; the rising edge stores WD3 there.`
    : question.outcome === 'x0' ? 'The register file hardwires x0 to zero and ignores every write to address 0.' : 'With WE3=0, the rising edge does not write any register.';

  function commitEdge() {
    if (wd === null) return;
    setRegisters(writeRegister(registers, a3, wd, we3));
    setCycles((value) => value + 1);
    setEdgeNote(!we3 ? 'Rising edge observed. WE3=0, so the register file held its values.'
      : a3 === 0 ? 'Rising edge observed. A3=x0 was ignored; x0 remains zero.'
        : `Rising edge observed. ${REGISTER_NAMES[a3]} now stores WD3.`);
  }

  function resetExperiment() {
    setRegisters([...seedRegisters]);
    setA1(5); setA2(6); setA3(7); setWdText('99'); setWe3(true); setCycles(0);
    setEdgeNote('Register file reset. Reads are live; the next write still waits for the rising edge.');
  }

  function resetQuestion() {
    setPrediction('');
    check.reset();
  }

  function newQuestion() {
    setQuestion(createRegisterQuestion()); setPrediction(''); check.fresh();
  }

  function submitPrediction() {
    if (!prediction || check.locked) return;
    const labels = Object.fromEntries(predictionOptions.map(({ value, label }) => [value, label]));
    check.check(prediction === question.outcome, `${labels[question.outcome]}. ${predictionExpected}`, predictionWhy, 'Register file write port and clock edge');
  }

  function revealPrediction() {
    const labels = Object.fromEntries(predictionOptions.map(({ value, label }) => [value, label]));
    check.reveal(`${labels[question.outcome]}. ${predictionExpected}`, predictionWhy, 'Register file write port and clock edge');
  }

  return (
    <div className="trainer-stack">
      <section className="panel trainer-panel">
        <div className="trainer-heading-row">
          <div><h2 className="section-title">Read registers and tick a write</h2></div>
          <BaseDisplay value={base} onChange={setBase} />
        </div>
        <div className="trainer-register-layout">
          <div className="trainer-experiment">
            <div className="trainer-form-grid trainer-register-addresses">
              <label className="field trainer-field-label"><span>A1 · read address 1</span><select className="trainer-control" value={a1} onChange={(event) => setA1(Number(event.target.value))}>{REGISTER_NAMES.map((name, index) => <option key={name} value={index}>{name} · x{index}</option>)}</select></label>
              <label className="field trainer-field-label"><span>A2 · read address 2</span><select className="trainer-control" value={a2} onChange={(event) => setA2(Number(event.target.value))}>{REGISTER_NAMES.map((name, index) => <option key={name} value={index}>{name} · x{index}</option>)}</select></label>
            </div>
            <div className="trainer-read-ports" aria-live="polite">
              <div><span>RD1 · selected data</span><strong className="mono">{formatValue(rd1, base)}</strong><small>{REGISTER_NAMES[a1]} · x{a1}</small></div>
              <div><span>RD2 · selected data</span><strong className="mono">{formatValue(rd2, base)}</strong><small>{REGISTER_NAMES[a2]} · x{a2}</small></div>
            </div>
            <div className="trainer-write-stage">
              <label className="field trainer-field-label"><span>A3 · write address</span><select className="trainer-control" value={a3} onChange={(event) => setA3(Number(event.target.value))}>{REGISTER_NAMES.map((name, index) => <option key={name} value={index}>{name} · x{index}</option>)}</select></label>
              <label className="field trainer-field-label"><span>WD3 · write data</span><input className="trainer-control mono" value={wdText} onChange={(event) => setWdText(event.target.value)} aria-invalid={wd === null} aria-describedby={wd === null ? "register-wd-help" : undefined} /></label>
              <label className="trainer-switch"><input type="checkbox" checked={we3} onChange={(event) => setWe3(event.target.checked)} /><span>WE3 enabled</span></label>
              <button className="button button-primary" onClick={commitEdge} disabled={wd === null}><Zap size={16} /> Rising edge</button>
            </div>
            {wd === null && <p id="register-wd-help" className="trainer-inline-note is-error">Enter a decimal, 0x hexadecimal, or 0b binary value.</p>}
            <div className="trainer-current-state">
              <div className="trainer-subheading"><strong>Register file</strong><span>Cycle {cycles}</span></div>
              <div className="register-grid trainer-register-grid">{registers.map((value, index) => <RegisterCell key={index} index={index} value={value} projected={projected[index]} base={base} />)}</div>
            </div>
            {edgeNote && <p className="trainer-inline-note" aria-live="polite">{edgeNote}</p>}
            <button className="button button-secondary trainer-reset-experiment" onClick={resetExperiment}><RotateCcw size={15} /> Reset register file</button>
          </div>
        </div>
      </section>

      <details className="trainer-extra"><summary>Practice a write</summary><section className="panel trainer-panel trainer-predictor">
        <div className="trainer-heading-row"><div><h2 className="section-title">Predict the next rising edge</h2><p className="muted">This exercise uses the values shown below.</p></div><button className="button button-secondary" onClick={newQuestion}><Sparkles size={15} /> New question</button></div>
        <div className="trainer-prediction-signals"><span>A3 <strong>x{question.address}</strong></span><span>WD3 <strong className="mono">{formatValue(question.data, base)}</strong></span><span>WE3 <strong>{question.enable ? '1 · enabled' : '0 · disabled'}</strong></span><span>Before <strong className="mono">{formatValue(readRegister(question.before, question.address), base)}</strong></span></div>
        <label className="field trainer-field-label trainer-prediction-answer"><span>What does the next rising edge do?</span><select className="trainer-control" value={prediction} onChange={(event) => setPrediction(event.target.value)} disabled={check.locked}><option value="">Choose the register-file outcome</option>{predictionOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="trainer-actions"><button className="button button-primary" onClick={submitPrediction} disabled={!prediction || check.locked}>Check prediction</button><button className="button button-secondary" onClick={revealPrediction} disabled={check.locked}><Eye size={15} /> Reveal answer</button><button className="button button-secondary" onClick={resetQuestion}><RotateCcw size={15} /> Reset answer</button></div>
        <Feedback grade={check.grade} />
      </section></details>
    </div>
  );
}

const DEFAULT_A = '2147483647';
const DEFAULT_B = '1';
const DEFAULT_FUNCTION: ALUFunction = '000';

function AluLab({ onAttempt }: Pick<ModeProps, 'onAttempt'>) {
  const [aText, setAText] = useState(DEFAULT_A);
  const [bText, setBText] = useState(DEFAULT_B);
  const [functionCode, setFunctionCode] = useState<ALUFunction>(DEFAULT_FUNCTION);
  const [base, setBase] = useState<'decimal' | 'hex' | 'binary'>('decimal');
  const [predictedY, setPredictedY] = useState('');
  const [predictedZero, setPredictedZero] = useState('');
  const check = useCheck('alu', onAttempt);
  const parsedA = parseBitPattern(aText);
  const parsedB = parseBitPattern(bText);
  const result = parsedA === null || parsedB === null ? null : alu(parsedA, parsedB, functionCode);
  const logicalDontCare = functionCode === '010' || functionCode === '011' || functionCode === '101';
  const subtraction = functionCode === '001';
  const functionName = ALU_FUNCTIONS.find(({ code }) => code === functionCode)?.name ?? functionCode;
  const predictionValue = parseBitPattern(predictedY);

  function resetQuestion() {
    setAText(DEFAULT_A); setBText(DEFAULT_B); setFunctionCode(DEFAULT_FUNCTION); setPredictedY(''); setPredictedZero(''); check.reset();
  }

  function newQuestion() {
    const nextA = toUnsigned(Math.floor(Math.random() * 65) - 32);
    const nextB = toUnsigned(Math.floor(Math.random() * 65) - 32);
    const nextFunction = ALU_FUNCTIONS[Math.floor(Math.random() * ALU_FUNCTIONS.length)].code;
    setAText(String(toSigned(nextA))); setBText(String(toSigned(nextB))); setFunctionCode(nextFunction);
    setPredictedY(''); setPredictedZero(''); check.fresh();
  }

  function expectedText() {
    if (!result) return 'Enter valid 32-bit A and B values.';
    return logicalDontCare
      ? `Y = ${formatValue(result.y, base)}. Zero is don't-care for ${functionName}; the reference model reports ${result.zero}.`
      : `Y = ${formatValue(result.y, base)} and Zero = ${result.zero}.`;
  }

  function explanation() {
    if (functionCode === '101') return `SLT compares signed A (${parsedA === null ? '?' : toSigned(parsedA)}) with signed B (${parsedB === null ? '?' : toSigned(parsedB)}); Y is 1 exactly when A < B. Zero is a don't-care for SLT.`;
    if (functionCode === '010') return "AND forms Y by taking the bitwise AND of A and B. Zero is a don't-care for AND under the Lab 4 contract.";
    if (functionCode === '011') return "OR forms Y by taking the bitwise OR of A and B. Zero is a don't-care for OR under the Lab 4 contract.";
    if (subtraction) return 'SUB computes A + (~B) + 1. The control signal inverts every B bit through XOR and supplies carry-in 1; Zero is asserted when the 32-bit result is zero.';
    return 'ADD passes B through the conditional XOR with control 0 and uses carry-in 0. The 32-bit result wraps, and Zero is asserted exactly when Y is zero.';
  }

  function submit() {
    if (!result || predictionValue === null || check.locked) return;
    const zeroMatches = logicalDontCare || predictedZero === String(result.zero);
    const outputNote = `Your Y ${predictionValue === result.y ? 'matches' : 'does not match'} the ALU result${logicalDontCare ? '.' : `; your Zero ${predictedZero === String(result.zero) ? 'matches' : 'does not match'} the arithmetic Zero output.`}`;
    check.check(predictionValue === result.y && zeroMatches, expectedText(), `${outputNote} ${explanation()}`, 'ALU · operation, 32-bit result and Zero output');
  }

  function reveal() {
    if (!result) return;
    check.reveal(expectedText(), explanation(), 'ALU · operation, 32-bit result and Zero output');
  }

  const xorControl = subtraction ? 1 : 0;
  const carryIn = subtraction ? 1 : 0;

  return (
    <div className="trainer-stack">
      <section className="panel trainer-panel">
        <div className="trainer-heading-row"><div><h2 className="section-title">Calculate Y and Zero</h2></div><BaseDisplay value={base} onChange={setBase} /></div>
        <div className="trainer-form-grid trainer-alu-controls">
          <label className="field trainer-field-label"><span>A · 32-bit operand</span><input className="trainer-control mono" value={aText} onChange={(event) => setAText(event.target.value)} aria-invalid={parsedA === null} disabled={check.locked} /></label>
          <label className="field trainer-field-label"><span>B · 32-bit operand</span><input className="trainer-control mono" value={bText} onChange={(event) => setBText(event.target.value)} aria-invalid={parsedB === null} disabled={check.locked} /></label>
          <label className="field trainer-field-label"><span>F · ALU function</span><select className="trainer-control" value={functionCode} onChange={(event) => setFunctionCode(event.target.value as ALUFunction)} disabled={check.locked}>{ALU_FUNCTIONS.map(({ code, name }) => <option key={code} value={code}>{code} · {name}</option>)}</select></label>
        </div>
        {(parsedA === null || parsedB === null) && <p className="trainer-inline-note is-error" role="status">Enter 32-bit values for A and B: decimal, 0x hexadecimal, or 0b binary.</p>}
        <div className="trainer-form-grid trainer-prediction-controls">
          <label className="field trainer-field-label"><span>Predicted Y</span><input className="trainer-control mono" value={predictedY} onChange={(event) => setPredictedY(event.target.value)} placeholder={base === 'hex' ? '0x…' : base === 'binary' ? '0b…' : 'signed decimal'} disabled={check.locked} /></label>
          <label className="field trainer-field-label"><span>Predicted Zero {logicalDontCare ? '· don’t-care' : ''}</span><select className="trainer-control" value={predictedZero} onChange={(event) => setPredictedZero(event.target.value)} disabled={check.locked || logicalDontCare}><option value="">{logicalDontCare ? 'Not scored for this F' : 'Choose 0 or 1'}</option><option value="0">0 · not zero</option><option value="1">1 · zero</option></select></label>
        </div>
        <div className="trainer-actions"><button className="button button-primary" onClick={submit} disabled={predictionValue === null || (!logicalDontCare && !predictedZero) || !result || check.locked}>Check outputs</button><button className="button button-secondary" onClick={reveal} disabled={!result || check.locked}><Eye size={15} /> Reveal answer</button><button className="button button-secondary" onClick={resetQuestion}><RotateCcw size={15} /> Reset question</button><button className="button button-secondary" onClick={newQuestion}><Sparkles size={15} /> New values</button></div>
        {check.assisted && !check.grade && <p className="trainer-inline-note">Practice · not scored</p>}
        <Feedback grade={check.grade} />
        <details className="trainer-extra"><summary>See the operation</summary>        <div className="trainer-alu-path" role="img" aria-label={subtraction ? 'Subtraction path: A plus B inverted by XOR control 1 plus carry-in 1.' : `Selected ALU operation: ${functionName}.`}>
          {functionCode === '000' || subtraction ? <>
            <div className="trainer-alu-node"><span>A</span><strong className="mono">{parsedA === null ? 'invalid' : formatValue(parsedA, base)}</strong></div>
            <span className="trainer-path-symbol">+</span>
            <div className="trainer-alu-node"><span>B</span><strong className="mono">{parsedB === null ? 'invalid' : formatValue(parsedB, base)}</strong></div>
            <span className="trainer-path-arrow">→</span>
            <div className={`trainer-xor-node ${subtraction ? 'is-active' : ''}`}><span>B XOR {`{32{${xorControl}}}`}</span><strong>{subtraction ? '~B' : 'B passes through'}</strong></div>
            <span className="trainer-path-symbol">+</span>
            <div className="trainer-carry-node"><span>Carry-in</span><strong>{carryIn}</strong></div>
            <span className="trainer-path-arrow">→</span>
            <div className="trainer-alu-node trainer-alu-output"><span>Y</span><strong className="mono">{check.grade && result ? formatValue(result.y, base) : '?'}</strong></div>
          </> : <div className="trainer-logic-path"><strong>{functionName}</strong><span>{functionCode === '101' ? check.grade && parsedA !== null && parsedB !== null ? `Signed comparison: ${toSigned(parsedA)} < ${toSigned(parsedB)} → Y=${result?.y}.` : 'SLT compares A and B as signed 32-bit integers. Predict whether A is less than B.' : 'The selected bitwise function operates on all 32 bits.'}</span><span className="trainer-path-arrow">→</span><strong>Y = {check.grade && result ? formatValue(result.y, base) : '?'}</strong></div>}
        </div>
        <p className="trainer-inline-note">{subtraction ? 'For SUB, XOR control=1 flips each B bit and carry-in=1 completes two’s-complement subtraction.' : functionCode === '000' ? 'For ADD, XOR control=0 leaves B unchanged and carry-in=0.' : 'AND, OR and signed SLT use their selected logic/comparison path. Zero is a don’t-care for these three functions in the Lab 4 ALU contract.'}</p>
</details>
      </section>
    </div>
  );
}

interface ControlCase { scenario: Scenario; name: 'add' | 'addi' | 'beq'; signals: ControlSignals; decodedOpcode: number; funct3: number; }

function createControlCase(exclude?: string): ControlCase {
  const names = (['add', 'addi', 'beq'] as const).filter((name) => name !== exclude);
  const name = names[Math.floor(Math.random() * names.length)] ?? 'add';
  const scenario = generateScenario(name);
  const decoded = decode(scenario.word, 'lab');
  const trace = traceCycle(scenario.state, scenario.word);
  return { scenario, name, signals: trace.control, decodedOpcode: decoded.opcode, funct3: decoded.funct3 };
}

type ControlAnswer = { opcode: string; regWrite: string; aluSrc: string; branch: string; aluControl: string };
const blankControl: ControlAnswer = { opcode: '', regWrite: '', aluSrc: '', branch: '', aluControl: '' };

function ControlLab({ onAttempt }: Pick<ModeProps, 'onAttempt'>) {
  const [example, setExample] = useState(() => createControlCase());
  const [answer, setAnswer] = useState<ControlAnswer>(blankControl);
  const check = useCheck('control', onAttempt);
  const expectedOpcode = formatValue(example.decodedOpcode, 'hex');
  const expected = {
    opcode: expectedOpcode,
    regWrite: String(example.signals.regWrite),
    aluSrc: String(example.signals.aluSrc),
    branch: String(example.signals.branch),
    aluControl: example.signals.aluControl,
  };

  function setField(field: keyof ControlAnswer, value: string) {
    setAnswer((previous) => ({ ...previous, [field]: value }));
  }

  function submit() {
    if (check.locked || Object.values(answer).some((value) => !value)) return;
    const correct = (Object.keys(expected) as (keyof ControlAnswer)[]).every((field) => answer[field] === expected[field]);
    const details = `For ${example.name}, RegWrite=${expected.regWrite} ${expected.regWrite === '1' ? 'enables the destination register write' : 'is off because beq has no destination write'}; ALUSrc=${expected.aluSrc} ${expected.aluSrc === '1' ? 'selects the immediate' : 'selects RD2'}; Branch=${expected.branch} ${expected.branch === '1' ? 'marks this instruction as beq' : 'keeps the branch path disabled'}; ALUControl=${expected.aluControl} selects ${expected.aluControl === '001' ? 'SUB to compare the beq operands' : 'ADD'}. Opcode/funct3 are encoded fields, separate from the generated controls.`;
    check.check(correct, `Opcode ${expected.opcode}; RegWrite ${expected.regWrite}; ALUSrc ${expected.aluSrc}; Branch ${expected.branch}; ALUControl ${expected.aluControl}.`, details, 'Instruction decoder and control unit');
  }

  function reveal() {
    check.reveal(`Opcode ${expected.opcode}; RegWrite ${expected.regWrite}; ALUSrc ${expected.aluSrc}; Branch ${expected.branch}; ALUControl ${expected.aluControl}.`, 'The opcode/funct3 values are encoded fields. The decoder turns the instruction into control outputs. In particular, all three lab instructions have funct3=000, but beq selects SUB (ALUControl=001).', 'Instruction decoder and control unit');
  }

  function resetQuestion() {
    setAnswer(blankControl);
    check.reset();
  }

  function newQuestion() {
    setExample(createControlCase(example.name)); setAnswer(blankControl); check.fresh();
  }

  const opcodeOptions = (['add', 'addi', 'beq'] as const).map((name) => ({ value: formatValue(INSTRUCTIONS[name].opcode, 'hex'), label: `${formatValue(INSTRUCTIONS[name].opcode, 'hex')} · ${name}` }));
  const controlRows: { key: keyof ControlAnswer; title: string; component: string; help: string }[] = [
    { key: 'opcode', title: 'Encoded opcode', component: 'Instruction bits', help: 'A field in the 32-bit word; this is not generated by the control unit.' },
    { key: 'regWrite', title: 'RegWrite', component: 'Register file control', help: 'Enables the A3/WD3 write on the rising edge.' },
    { key: 'aluSrc', title: 'ALUSrc', component: 'ALU input mux', help: 'Chooses read-port RD2 or the immediate for ALU input B.' },
    { key: 'branch', title: 'Branch', component: 'Branch control', help: 'Marks a beq instruction; it does not by itself mean the branch is taken.' },
    { key: 'aluControl', title: 'ALUControl', component: 'ALU control', help: 'Selects ADD or SUB independently of the encoded opcode and funct3 fields.' },
  ];

  return (
    <div className="trainer-stack">
      <section className="panel trainer-panel">
        <div className="trainer-heading-row"><div><h2 className="section-title">Set the control signals</h2></div><button className="button button-secondary" onClick={newQuestion}><Sparkles size={15} /> New instruction</button></div>
        <div className="trainer-instruction-sample"><span className="trainer-sample-mnemonic">{example.name}</span><code className="mono">{formatValue(example.scenario.word, 'hex')}</code><span>funct3 <strong className="mono">{example.funct3.toString(2).padStart(3, '0')}</strong></span></div>
        <div className="trainer-control-grid">
          {controlRows.map((row) => <label className="field trainer-field-label" key={row.key}><span>{row.title}</span><select className="trainer-control" value={answer[row.key]} onChange={(event) => setField(row.key, event.target.value)} disabled={check.locked}><option value="">Select {row.title}</option>{row.key === 'opcode' ? opcodeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>) : row.key === 'aluControl' ? ALU_FUNCTIONS.map(({ code, name }) => <option key={code} value={code}>{code} · {name}</option>) : <><option value="0">{row.key === 'aluSrc' ? '0 · RD2' : row.key === 'regWrite' ? '0 · no write' : '0 · off'}</option><option value="1">{row.key === 'aluSrc' ? '1 · immediate' : row.key === 'regWrite' ? '1 · write' : '1 · enabled'}</option></>}</select></label>)}
        </div>
        <div className="trainer-actions"><button className="button button-primary" onClick={submit} disabled={check.locked || Object.values(answer).some((value) => !value)}>Check controls</button><button className="button button-secondary" onClick={reveal} disabled={check.locked}><Eye size={15} /> Reveal controls</button><button className="button button-secondary" onClick={resetQuestion}><RotateCcw size={15} /> Reset answers</button></div>
        {check.assisted && !check.grade && <p className="trainer-inline-note">Practice · not scored</p>}
        <Feedback grade={check.grade} />
      </section>
      <details className="trainer-extra"><summary>How the decoder works</summary><section className="panel trainer-panel">
        <h2 className="section-title">Instruction fields are not control outputs</h2>
        <div className="trainer-compare-table">
          <div><strong>Encoded instruction field</strong><span>opcode = {expectedOpcode}</span><span>funct3 = {example.funct3.toString(2).padStart(3, '0')}</span><small>Read from the 32-bit instruction word.</small></div>
          <ArrowRight size={19} aria-hidden="true" />
          <div><strong>Generated ALU control</strong><span>ALUControl = {check.grade ? expected.aluControl : 'hidden until your check'}</span><small>Chosen by the decoder for the operation the ALU must perform.</small></div>
        </div>
        <table className="signal-table trainer-signal-table"><thead><tr><th scope="col">Signal</th><th scope="col">Expected</th><th scope="col">What it controls</th></tr></thead><tbody>{controlRows.slice(1).map((row) => <tr key={row.key}><th scope="row">{row.title}</th><td className="mono">{check.grade ? expected[row.key] : '—'}</td><td>{row.help}</td></tr>)}</tbody></table>
      </section></details>
    </div>
  );
}

export function ComponentLab(props: ComponentLabProps) {
  if (props.topic === 'registers') return <RegisterFileLab onAttempt={props.onAttempt} />;
  if (props.topic === 'alu') return <AluLab onAttempt={props.onAttempt} />;
  return <ControlLab onAttempt={props.onAttempt} />;
}
