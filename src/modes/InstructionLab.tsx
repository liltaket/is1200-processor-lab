import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ArrowRight, Eye, RotateCcw, Sparkles } from 'lucide-react';
import type { ModeProps } from '../ui-types';
import {
  INSTRUCTIONS,
  REGISTER_NAMES,
  decode,
  encode,
  formatValue,
  generateScenario,
  instructionText,
  parseValue,
  toSigned,
} from '../engine';
import type { DecodedInstruction, Instruction, InstructionFormat } from '../engine';
import { Feedback } from './trainerFeedback';
import type { Grade } from './trainerFeedback';
import './instruction.css';

export interface InstructionLabProps extends ModeProps {
  topic: 'formats' | 'encoding';
}

type Segment = { range: string; span: number; field: string; short: string };
type InstructionCase = { instruction: Instruction; decoded: DecodedInstruction; word: number; source: string };
type LabInstructionFormat = Extract<InstructionFormat, 'R' | 'I' | 'B'>;
type LabInstructionName = Exclude<Parameters<typeof generateScenario>[0], undefined>;

const LAB_INSTRUCTIONS: LabInstructionName[] = Object.values(INSTRUCTIONS)
  .filter((definition) => definition.scope === 'lab')
  .map((definition) => definition.name as LabInstructionName);

const SEGMENTS: Record<LabInstructionFormat, Segment[]> = {
  R: [
    { range: '31:25', span: 7, field: 'funct7', short: 'funct7' },
    { range: '24:20', span: 5, field: 'rs2', short: 'rs2' },
    { range: '19:15', span: 5, field: 'rs1', short: 'rs1' },
    { range: '14:12', span: 3, field: 'funct3', short: 'funct3' },
    { range: '11:7', span: 5, field: 'rd', short: 'rd' },
    { range: '6:0', span: 7, field: 'opcode', short: 'opcode' },
  ],
  I: [
    { range: '31:20', span: 12, field: 'imm[11:0]', short: 'imm[11:0]' },
    { range: '19:15', span: 5, field: 'rs1', short: 'rs1' },
    { range: '14:12', span: 3, field: 'funct3', short: 'funct3' },
    { range: '11:7', span: 5, field: 'rd', short: 'rd' },
    { range: '6:0', span: 7, field: 'opcode', short: 'opcode' },
  ],
  B: [
    { range: '31', span: 1, field: 'imm[12]', short: 'i12' },
    { range: '30:25', span: 6, field: 'imm[10:5]', short: 'i10:5' },
    { range: '24:20', span: 5, field: 'rs2', short: 'rs2' },
    { range: '19:15', span: 5, field: 'rs1', short: 'rs1' },
    { range: '14:12', span: 3, field: 'funct3', short: 'funct3' },
    { range: '11:8', span: 4, field: 'imm[4:1]', short: 'i4:1' },
    { range: '7', span: 1, field: 'imm[11]', short: 'i11' },
    { range: '6:0', span: 7, field: 'opcode', short: 'opcode' },
  ],
};

const FORMAT_NAMES: Record<InstructionFormat, string> = { R: 'R-type', I: 'I-type', B: 'B-type', S: 'S-type' };

function segmentsFor(format: InstructionFormat): Segment[] {
  if (format === 'S') throw new TypeError('S-type layout is a Lecture 9 extension.');
  return SEGMENTS[format];
}

function makeInstructionCase(exclude?: string): InstructionCase {
  const names = LAB_INSTRUCTIONS.filter((name) => name !== exclude);
  const name = names[Math.floor(Math.random() * names.length)] ?? 'add';
  const scenario = generateScenario(name);
  const decoded = decode(scenario.word, 'lab');
  return { instruction: scenario.instruction, decoded, word: scenario.word, source: instructionText(scenario.instruction) };
}

function fieldDisplay(field: string, decoded: DecodedInstruction): string {
  if (field === 'opcode') return formatValue(decoded.opcode, 'hex');
  if (field === 'funct3') return decoded.funct3.toString(2).padStart(3, '0');
  if (field === 'funct7') return decoded.funct7.toString(2).padStart(7, '0');
  if (field === 'rd') return decoded.rd === undefined ? '—' : `${REGISTER_NAMES[decoded.rd] ?? `x${decoded.rd}`} (x${decoded.rd})`;
  if (field === 'rs1') return `${REGISTER_NAMES[decoded.rs1] ?? `x${decoded.rs1}`} (x${decoded.rs1})`;
  if (field === 'rs2') return decoded.rs2 === undefined ? '—' : `${REGISTER_NAMES[decoded.rs2] ?? `x${decoded.rs2}`} (x${decoded.rs2})`;
  if (field === 'imm[11:0]') return `0b${((decoded.word >>> 20) & 0xfff).toString(2).padStart(12, '0')}`;
  if (field === 'imm[12]') return String((decoded.word >>> 31) & 1);
  if (field === 'imm[10:5]') return `0b${((decoded.word >>> 25) & 0x3f).toString(2).padStart(6, '0')}`;
  if (field === 'imm[4:1]') return `0b${((decoded.word >>> 8) & 0xf).toString(2).padStart(4, '0')}`;
  if (field === 'imm[11]') return String((decoded.word >>> 7) & 1);
  if (field === 'imm') return decoded.imm === undefined ? '—' : String(decoded.imm);
  return field;
}

function fieldMap(decoded: DecodedInstruction): string {
  return segmentsFor(decoded.format).map(({ range, field }) => `${range} ${field}`).join(' · ');
}

type DragSession = {
  field: string;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
  overRange?: string;
};

function FieldStrip({
  decoded,
  placements,
  setPlacements,
  disabled = false,
  showCorrect = false,
  showHints = false,
}: {
  decoded: DecodedInstruction;
  placements: Record<string, string>;
  setPlacements: (next: Record<string, string>) => void;
  disabled?: boolean;
  showCorrect?: boolean;
  showHints?: boolean;
}) {
  const segments = segmentsFor(decoded.format);
  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [needsPan, setNeedsPan] = useState(false);
  useEffect(() => {
    const element = stripRef.current;
    if (!element) return;
    const measure = () => setNeedsPan(element.scrollWidth > element.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  const draggingRef = useRef<DragSession | null>(null);
  const movedRef = useRef(false);
  const [dragging, setDragging] = useState<DragSession | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState('Select a field chip, then choose a bit range.');
  const fieldOptions = [...new Set(segments.map(({ field }) => field))].sort();
  const remainingFields = fieldOptions.filter((field) => !Object.values(placements).includes(field));
  const revealMap = showCorrect || showHints;

  function updateDrag(next: DragSession | null) {
    draggingRef.current = next;
    setDragging(next);
  }

  function assignField(field: string, range: string) {
    if (disabled) return;
    const target = segments.find((segment) => segment.range === range);
    if (!target) return;
    const originRange = segments.find((segment) => placements[segment.range] === field)?.range;
    if (originRange === range) {
      setSelectedField(null);
      setLiveStatus(`${field} is already in bits ${range}.`);
      return;
    }

    const displaced = placements[range];
    const next = { ...placements };
    if (originRange) delete next[originRange];
    if (displaced) delete next[range];
    next[range] = field;
    setPlacements(next);
    setSelectedField(null);
    setLiveStatus(displaced
      ? `Moved ${field} to bits ${range}; ${displaced} returned to the field bank.`
      : originRange
        ? `Moved ${field} from bits ${originRange} to bits ${range}.`
        : `Placed ${field} in bits ${range}.`);
  }

  function toggleFieldSelection(field: string) {
    if (disabled) return;
    if (selectedField === field) {
      setSelectedField(null);
      setLiveStatus(`${field} selection cleared.`);
    } else {
      setSelectedField(field);
      setLiveStatus(`${field} selected. Choose a bit range to place or move it.`);
    }
  }

  function activateRange(range: string) {
    if (disabled) return;
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    if (selectedField) {
      assignField(selectedField, range);
      return;
    }
    const placed = placements[range];
    if (placed) {
      setSelectedField(placed);
      setLiveStatus(`${placed} selected from bits ${range}. Choose another range to move it.`);
    } else {
      setLiveStatus('Select a field chip first, then activate a bit range.');
    }
  }

  function startDrag(field: string, event: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled || !event.isPrimary || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    movedRef.current = false;
    updateDrag({
      field,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    });
  }

  function pointerRangeAt(x: number, y: number): string | undefined {
    const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-slot-range]');
    return hit && rootRef.current?.contains(hit) ? hit.dataset.slotRange : undefined;
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const active = draggingRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const moved = active.moved || Math.hypot(event.clientX - active.startX, event.clientY - active.startY) > 7;
    movedRef.current = moved;
    updateDrag({
      ...active,
      x: event.clientX,
      y: event.clientY,
      moved,
      overRange: moved ? pointerRangeAt(event.clientX, event.clientY) : undefined,
    });
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const active = draggingRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const moved = active.moved || Math.hypot(event.clientX - active.startX, event.clientY - active.startY) > 7;
    const range = moved ? pointerRangeAt(event.clientX, event.clientY) : undefined;
    if (range) {
      movedRef.current = true;
      assignField(active.field, range);
    } else if (moved) {
      movedRef.current = true;
      setLiveStatus(`Drop ${active.field} on a bit range. The field remains where it started.`);
    }
    updateDrag(null);
    if (moved) window.setTimeout(() => { movedRef.current = false; }, 0);
  }

  function cancelPointerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const active = draggingRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    updateDrag(null);
    movedRef.current = false;
    setLiveStatus(`Drag cancelled. ${active.field} remains where it started.`);
  }

  return (
    <div
      ref={rootRef}
      className="instruction-field-placement"
      aria-describedby={disabled ? undefined : "instruction-field-help instruction-field-keyboard-help"}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={cancelPointerDrag}
    >
      <p id="instruction-field-help" className="instruction-placement-help">Drag a field onto its bit range, or select a field and tap a range.</p>
      <p id="instruction-field-keyboard-help" className="instruction-visually-hidden">Keyboard: focus a field chip and press Enter to select it, then focus a range and press Enter to place it. Focus an occupied range and press Enter to select its field for moving.</p>
      {!disabled && remainingFields.length > 0 && <div className="instruction-field-bank" role="group" aria-label="Available instruction fields">
        <div className="instruction-field-bank-items">
          {remainingFields.map((field) => <button
            type="button"
            key={field}
            className={`instruction-field-chip ${selectedField === field ? 'is-selected' : ''}`}
            aria-pressed={selectedField === field}
            onPointerDown={(event) => startDrag(field, event)}
            onClick={() => {
              if (movedRef.current) { movedRef.current = false; return; }
              toggleFieldSelection(field);
            }}
          >{field}</button>)}
        </div>
      </div>}
      <div ref={stripRef} className="instruction-field-strip-scroll" role="region" aria-label="Scrollable 32-bit field layout" tabIndex={0}>
        <div className={`instruction-bit-strip ${decoded.format === 'B' ? 'instruction-b-strip' : ''}`} role="group" aria-label={`${FORMAT_NAMES[decoded.format]} instruction bit fields`}>
          {segments.map((segment) => {
            const placed = placements[segment.range] ?? '';
            const showExpected = revealMap;
            const shortPlaced = segments.find(({ field }) => field === placed)?.short;
            const label = showExpected ? segment.short : shortPlaced || '?';
            const isCorrect = showCorrect && placed === segment.field;
            const isIncorrect = showCorrect && Boolean(placed) && placed !== segment.field;
            const overTarget = dragging?.overRange === segment.range;
            return <button
              type="button"
              key={segment.range}
              data-slot-range={segment.range}
              className={`instruction-bit-slot ${placed ? 'is-filled' : ''} ${overTarget ? 'is-drop-target' : ''} ${selectedField && placed === selectedField ? 'is-moving' : ''} ${isCorrect ? 'is-correct' : ''} ${isIncorrect ? 'is-incorrect' : ''} ${showHints && !showCorrect ? 'has-hint' : ''}`}
              style={{ gridColumn: `span ${segment.span}` }}
              aria-pressed={Boolean(placed && selectedField === placed)}
              aria-label={`Bits ${segment.range}; ${showExpected ? `field ${segment.field}` : placed ? `assigned ${placed}` : 'empty range'}`}
              title={showExpected ? `Bits ${segment.range} · ${segment.field}` : `Instruction bits ${segment.range}`}
              disabled={disabled}
              onPointerDown={(event) => { if (placed) startDrag(placed, event); }}
              onClick={() => activateRange(segment.range)}
            ><span className="instruction-bit-range">{segment.range}</span><strong>{label}</strong></button>;
          })}
        </div>
      </div>
      {needsPan && <p className="instruction-pan-note">Scroll sideways for all bit ranges.</p>}
      {dragging?.moved && <div className="instruction-drag-ghost" aria-hidden="true" style={{ left: dragging.x + 12, top: dragging.y + 12 }}>{dragging.field}</div>}
      <p className="instruction-placement-status instruction-visually-hidden" role="status" aria-live="polite">{liveStatus}</p>
      {decoded.format === 'B' && <details className="instruction-how-fields"><summary>How fields work</summary><p>B-type keeps the register and control fields in their usual positions, while the signed branch displacement is split across the word. Its lowest displacement bit is implicit zero because offsets are even.</p></details>}
    </div>
  );
}

type OperandField = { key: 'rd' | 'rs1' | 'rs2' | 'imm'; label: string; kind: 'register' | 'immediate'; value: number };

function operandsFor(decoded: DecodedInstruction): OperandField[] {
  const register = (key: 'rd' | 'rs1' | 'rs2', value: number | undefined): OperandField | null => value === undefined ? null : { key, label: key, kind: 'register', value };
  const immediate: OperandField | null = decoded.imm === undefined ? null : { key: 'imm', label: 'signed immediate', kind: 'immediate', value: decoded.imm };
  return decoded.name === 'add'
    ? [register('rd', decoded.rd), register('rs1', decoded.rs1), register('rs2', decoded.rs2)].filter((field): field is OperandField => field !== null)
    : decoded.name === 'addi'
      ? [register('rd', decoded.rd), register('rs1', decoded.rs1), immediate].filter((field): field is OperandField => field !== null)
      : [register('rs1', decoded.rs1), register('rs2', decoded.rs2), immediate].filter((field): field is OperandField => field !== null);
}

function registerLabel(register: number): string {
  return REGISTER_NAMES[register] ?? `x${register}`;
}

function operandExpected(decoded: DecodedInstruction): string {
  return operandsFor(decoded).map(({ key, value, kind }) => `${key}=${kind === 'register' ? `${registerLabel(value)} (x${value})` : value}`).join(', ');
}

function operandAnswersMatch(decoded: DecodedInstruction, values: Record<string, string>): boolean {
  return operandsFor(decoded).every(({ key, value, kind }) => {
    const raw = values[key] ?? '';
    if (!raw) return false;
    if (kind === 'register') return Number(raw) === value;
    try { return toSigned(parseValue(raw)) === value; } catch { return false; }
  });
}

function OperandEditor({ decoded, values, setValues, disabled = false }: {
  decoded: DecodedInstruction;
  values: Record<string, string>;
  setValues: (next: Record<string, string>) => void;
  disabled?: boolean;
}) {
  return <div className="trainer-operand-grid">{operandsFor(decoded).map(({ key, label, kind }) => <label className="field trainer-field-label" key={key}><span>{label}</span>{kind === 'register' ? <select className="trainer-control" value={values[key] ?? ''} onChange={(event) => setValues({ ...values, [key]: event.target.value })} disabled={disabled}><option value="">Choose a register</option>{REGISTER_NAMES.map((name, index) => <option key={name} value={index}>{name} · x{index}</option>)}</select> : <input className="trainer-control mono" value={values[key] ?? ''} onChange={(event) => setValues({ ...values, [key]: event.target.value })} placeholder="signed value or 0x/0b" disabled={disabled} />}</label>)}</div>;
}

function localFormatGrade(correct: boolean, expected: string, why: string, component: string, revealed = false): Grade {
  return { correct, expected, explanation: why, component, revealed, counted: false };
}

function FormatsMode({ onAttempt, guided }: Pick<ModeProps, 'onAttempt' | 'guided'>) {
  const [example, setExample] = useState(() => makeInstructionCase());
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [grade, setGrade] = useState<Grade | null>(null);
  const [locked, setLocked] = useState(false);
  const [assisted, setAssisted] = useState(false);
  const [layoutKey, setLayoutKey] = useState(0);
  const segments = segmentsFor(example.decoded.format);
  const correct = segments.every(({ range, field }) => placements[range] === field);
  const placementsReady = segments.every(({ range }) => Boolean(placements[range]));
  const expected = fieldMap(example.decoded);
  const why = example.decoded.format === 'B'
    ? 'A B-type instruction scatters its signed immediate across the high bit, bits 30:25, bits 11:8, and bit 7. The low displacement bit is implicit zero; the register and opcode fields keep their own positions.'
    : `${FORMAT_NAMES[example.decoded.format]} fields occupy fixed positions. Compare the named segment ranges and field roles; register ports use the instruction fields shown by the decoder.`;

  function fresh() {
    setExample(makeInstructionCase(example.decoded.name)); setPlacements({}); setGrade(null); setLocked(false); setAssisted(false); setLayoutKey((value) => value + 1);
  }

  function reset() {
    setPlacements({}); setGrade(null); setLocked(false); setAssisted(true); setLayoutKey((value) => value + 1);
  }

  function submit() {
    if (locked) return;
    const counted = !assisted && !guided;
    if (counted) onAttempt('formats', correct);
    setGrade({ correct, expected, explanation: why, component: 'Instruction decoder · bit-field selection', counted });
    setLocked(true);
    setLayoutKey((value) => value + 1);
    if (!correct) setAssisted(true);
  }

  function reveal() {
    if (locked) return;
    setGrade(localFormatGrade(false, expected, why, 'Instruction decoder · bit-field selection', true));
    setLocked(true); setAssisted(true); setLayoutKey((value) => value + 1);
  }

  return (
    <div className="instruction-lab trainer-stack">
      <section className="panel trainer-panel">
        <div className="trainer-heading-row"><div><h2 className="section-title">Place the instruction fields</h2>{guided && <span className="instruction-guided-badge">Guided · unscored</span>}</div><button className="button button-secondary" onClick={fresh}><Sparkles size={15} /> New instruction</button></div>
        <div className="trainer-instruction-sample"><code className="mono">{example.source}</code><span>{FORMAT_NAMES[example.decoded.format]}</span></div>
        <FieldStrip key={`${example.word}-${layoutKey}`} decoded={example.decoded} placements={placements} setPlacements={setPlacements} disabled={locked} showCorrect={Boolean(grade)} showHints={guided} />
        <div className="trainer-actions"><button className="button button-primary" onClick={submit} disabled={locked || !placementsReady}>Check layout</button><button className="button button-secondary" onClick={reveal} disabled={locked}><Eye size={15} /> Reveal answer</button><button className="button button-secondary" onClick={reset}><RotateCcw size={15} /> Reset</button></div>
        {assisted && !grade && <p className="instruction-round-status">This reset round is unscored.</p>}
        <Feedback grade={grade} />
      </section>
      {grade && <section className="panel trainer-panel trainer-afterword"><h2 className="section-title">Decoded operands</h2><div className="trainer-field-values">{segments.map(({ field }) => <div key={field}><span>{field}</span><strong className="mono">{fieldDisplay(field, example.decoded)}</strong></div>)}</div></section>}
    </div>
  );
}

type Stage = 0 | 1 | 2 | 3 | 4;
type EncodeAnswers = { family: string; opcode: string; operands: Record<string, string>; placements: Record<string, string>; hex: string };
const blankEncodeAnswers = (): EncodeAnswers => ({ family: '', opcode: '', operands: {}, placements: {}, hex: '' });

function EncodingMode({ onAttempt, guided }: Pick<ModeProps, 'onAttempt' | 'guided'>) {
  const [example, setExample] = useState(() => makeInstructionCase());
  const [stage, setStage] = useState<Stage>(0);
  const [answers, setAnswers] = useState<EncodeAnswers>(blankEncodeAnswers);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [locked, setLocked] = useState(false);
  const [assisted, setAssisted] = useState(false);
  const [layoutKey, setLayoutKey] = useState(0);
  const opFields = operandsFor(example.decoded);
  const encodedWord = encode(example.instruction);
  const opcodeOptions = [...new Set(LAB_INSTRUCTIONS.map((name) => formatValue(INSTRUCTIONS[name].opcode, 'hex')))];
  const expectHex = formatValue(encodedWord, 'hex');
  const layoutSegments = segmentsFor(example.decoded.format);
  const placementComplete = layoutSegments.every(({ range, field }) => answers.placements[range] === field);
  const placementReady = layoutSegments.every(({ range }) => Boolean(answers.placements[range]));
  const currentExpected = stage === 0 ? FORMAT_NAMES[example.decoded.format]
    : stage === 1 ? formatValue(example.decoded.opcode, 'hex')
      : stage === 2 ? operandExpected(example.decoded)
        : stage === 3 ? fieldMap(example.decoded)
          : expectHex;
  const currentComponent = stage === 0 ? 'Instruction format decoder'
    : stage === 1 ? 'Opcode field'
      : stage === 2 ? 'Register and immediate fields'
        : stage === 3 ? 'Instruction bit-field layout'
          : 'Complete instruction word';
  const currentWhy = stage === 0 ? `${example.decoded.name} uses the ${FORMAT_NAMES[example.decoded.format]} layout.`
    : stage === 1 ? `The ${FORMAT_NAMES[example.decoded.format]} ${example.decoded.name} definition assigns opcode ${formatValue(example.decoded.opcode, 'hex')}. This is the encoded family field.`
      : stage === 2 ? 'Register operands keep their rs1/rs2/rd roles. Immediate operands are signed; the format determines where their bits go.'
        : stage === 3 ? example.decoded.format === 'B' ? 'B immediate bits are scattered; bit 0 is implicit zero. The other fields keep their positions across R, I and B formats.' : 'Register and function fields occupy the positions defined by the selected instruction format.'
          : 'The complete instruction word combines its opcode, operands, function bits and format-specific immediate layout.';
  const operandsComplete = opFields.every(({ key }) => Boolean(answers.operands[key]));
  const fullWord = parseHexWord(answers.hex);
  const stageTitles = ['Choose the format', 'Identify the opcode', 'Read the operands', 'Place the fields', 'Enter the full word'];

  function isCorrect(): boolean {
    if (stage === 0) return answers.family === example.decoded.format;
    if (stage === 1) return answers.opcode === formatValue(example.decoded.opcode, 'hex');
    if (stage === 2) return operandAnswersMatch(example.decoded, answers.operands);
    if (stage === 3) return placementComplete;
    return fullWord === encodedWord;
  }

  function submit() {
    if (locked) return;
    const correct = isCorrect();
    const counted = !assisted && !guided;
    if (counted) onAttempt('encoding', correct);
    setGrade({ correct, expected: currentExpected, explanation: currentWhy, component: currentComponent, counted });
    setLocked(true);
    setLayoutKey((value) => value + 1);
    if (!correct) setAssisted(true);
  }

  function reveal() {
    if (locked) return;
    setGrade(localFormatGrade(false, currentExpected, currentWhy, currentComponent, true));
    setLocked(true); setAssisted(true); setLayoutKey((value) => value + 1);
  }

  function nextStage() {
    if (!grade || stage === 4) return;
    setStage((stage + 1) as Stage); setGrade(null); setLocked(false); setLayoutKey((value) => value + 1);
  }

  function reset() {
    setStage(0); setAnswers(blankEncodeAnswers()); setGrade(null); setLocked(false); setAssisted(true); setLayoutKey((value) => value + 1);
  }

  function fresh() {
    setExample(makeInstructionCase(example.decoded.name)); setStage(0); setAnswers(blankEncodeAnswers()); setGrade(null); setLocked(false); setAssisted(false); setLayoutKey((value) => value + 1);
  }

  const stageReady = stage === 0 ? Boolean(answers.family)
    : stage === 1 ? Boolean(answers.opcode)
      : stage === 2 ? operandsComplete
      : stage === 3 ? placementReady
          : fullWord !== null;

  return (
    <div className="instruction-lab trainer-stack">
      <section className="panel trainer-panel">
        <div className="trainer-heading-row"><div><h2 className="section-title">Build an instruction word</h2>{guided && <span className="instruction-guided-badge">Guided · unscored</span>}</div><button className="button button-secondary" onClick={fresh}><Sparkles size={15} /> New instruction</button></div>
        <div className="instruction-stage-head"><div><span>Step {stage + 1} of 5</span><h3>{stageTitles[stage]}</h3></div><div className="instruction-stage-progress" role="progressbar" aria-label="Encoding progress" aria-valuemin={1} aria-valuemax={5} aria-valuenow={stage + 1}><span style={{ width: `${((stage + 1) / 5) * 100}%` }} /></div></div>
        <div className="trainer-instruction-sample"><code className="mono">{example.source}</code></div>
        {stage === 0 && <label className="field trainer-field-label"><span>Instruction format family</span><select className="trainer-control" value={answers.family} onChange={(event) => setAnswers({ ...answers, family: event.target.value })} disabled={locked}><option value="">Choose R, I or B</option>{(['R', 'I', 'B'] as InstructionFormat[]).map((format) => <option key={format} value={format}>{FORMAT_NAMES[format]}</option>)}</select></label>}
        {stage === 1 && <label className="field trainer-field-label"><span>Encoded opcode field</span><select className="trainer-control mono" value={answers.opcode} onChange={(event) => setAnswers({ ...answers, opcode: event.target.value })} disabled={locked}><option value="">Choose the seven-bit opcode</option>{opcodeOptions.map((opcode) => <option key={opcode} value={opcode}>{opcode}</option>)}</select></label>}
        {stage === 2 && <><p className="instruction-prompt">Enter the register and immediate operands shown in the instruction.</p><OperandEditor decoded={example.decoded} values={answers.operands} setValues={(operands) => setAnswers({ ...answers, operands })} disabled={locked} /></>}
        {stage === 3 && <FieldStrip key={`${example.word}-${stage}-${layoutKey}`} decoded={example.decoded} placements={answers.placements} setPlacements={(placements) => setAnswers({ ...answers, placements })} disabled={locked} showCorrect={Boolean(grade)} showHints={guided} />}
        {stage === 4 && <label className="field trainer-field-label"><span>Complete 32-bit instruction · hexadecimal</span><input className="trainer-control mono" value={answers.hex} onChange={(event) => setAnswers({ ...answers, hex: event.target.value })} placeholder="0x00000000" disabled={locked} aria-invalid={Boolean(answers.hex) && fullWord === null} /></label>}
        <div className="trainer-actions">
          <button className="button button-primary" onClick={submit} disabled={!stageReady || locked}>Check answer</button>
          <button className="button button-secondary" onClick={reveal} disabled={locked}><Eye size={15} /> Reveal answer</button>
          <button className="button button-secondary" onClick={reset}><RotateCcw size={15} /> Reset</button>
        </div>
        {assisted && !grade && <p className="instruction-round-status">This round is unscored after a reset, reveal, or incorrect answer.</p>}
        <Feedback grade={grade} />
        {grade && stage < 4 && <button className="button button-primary trainer-next-step" onClick={nextStage}>Next step <ArrowRight size={15} /></button>}
        {grade && stage === 4 && <><div className="trainer-final-word"><span>Complete 32-bit instruction word</span><strong className="mono">{expectHex}</strong><code>{formatValue(encodedWord, 'binary')}</code></div><div className="instruction-encoded-fields" aria-label="Encoded instruction fields">{layoutSegments.map(({ range, field }) => <div key={range}><span>Bits {range} · {field}</span><strong className="mono">{fieldDisplay(field, example.decoded)}</strong></div>)}</div></>}
      </section>
    </div>
  );
}

function parseHexWord(text: string): number | null {
  if (!/^\s*0x[\da-f]{1,8}\s*$/i.test(text)) return null;
  try { return parseValue(text); } catch { return null; }
}

export function InstructionLab(props: InstructionLabProps) {
  if (props.topic === 'encoding') return <EncodingMode onAttempt={props.onAttempt} guided={props.guided} />;
  return <FormatsMode onAttempt={props.onAttempt} guided={props.guided} />;
}
