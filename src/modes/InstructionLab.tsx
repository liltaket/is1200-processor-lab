import { useState } from 'react';
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
  const [selectedSlot, setSelectedSlot] = useState(segments[0]?.range ?? '');
  const active = segments.find(({ range }) => range === selectedSlot) ?? segments[0];
  const expected = showHints || showCorrect ? active?.field ?? '' : '';
  const assignment = placements[selectedSlot] ?? '';
  const fieldOptions = [...new Set(segments.map(({ field }) => field))];

  function choose(field: string) {
    setPlacements({ ...placements, [selectedSlot]: field });
  }

  return (
    <div className="trainer-field-strip-wrap">
      <div className="trainer-field-strip-scroll" role="region" aria-label="Scrollable 32-bit field layout" tabIndex={0}>
        <div className="trainer-field-strip" role="group" aria-label={`${FORMAT_NAMES[decoded.format]} instruction bit fields`}>
          {segments.map((segment) => {
            const placed = placements[segment.range] ?? '';
            const show = showHints || showCorrect;
            const shortPlaced = segments.find(({ field }) => field === placed)?.short;
            const label = show ? segment.short : shortPlaced || '?';
            const correct = showCorrect || (disabled && placed === segment.field);
            return <button
              type="button"
              key={segment.range}
              className={`trainer-bit-slot ${selectedSlot === segment.range ? 'is-selected' : ''} ${correct ? 'is-correct' : ''} ${disabled && !showCorrect && placed && placed !== segment.field ? 'is-incorrect' : ''}`}
              style={{ gridColumn: `span ${segment.span}` }}
              aria-pressed={selectedSlot === segment.range}
              aria-label={`Bits ${segment.range}; ${show ? `field ${segment.field}` : placed ? `assigned ${placed}` : 'no field assigned'}`}
              title={show ? `Instruction bits ${segment.range} · ${segment.field}` : `Instruction bits ${segment.range}`}
              onClick={() => setSelectedSlot(segment.range)}
            ><span className="trainer-bit-range">{segment.range}</span><strong>{label}</strong></button>;
          })}
        </div>
      </div>
      <div className="trainer-slot-editor">
        <span className="trainer-slot-selection">Selected slot: <strong>bits {selectedSlot}</strong>{expected && <> · expected <strong>{expected}</strong></>}</span>
        <label className="field trainer-field-label"><span>Place a field in bits {selectedSlot}</span><select className="trainer-control" value={assignment} onChange={(event) => choose(event.target.value)} disabled={disabled}><option value="">Choose a field</option>{fieldOptions.map((field) => <option key={field} value={field}>{field}</option>)}</select></label>
      </div>
      {(showHints || disabled) && <div className="trainer-segment-reference" aria-label="Bit ranges and field names">
        {segments.map(({ range, field }) => <span key={range}><b>{range}</b> {field}</span>)}
      </div>}
      {decoded.format === 'B' && (showHints || disabled) && <p className="trainer-inline-note"><strong>B immediate:</strong> imm[12], imm[10:5], imm[4:1] and imm[11] are scattered across the word. Bit 0 is implicit zero because branch offsets are even byte displacements.</p>}
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
  const segments = segmentsFor(example.decoded.format);
  const correct = segments.every(({ range, field }) => placements[range] === field);
  const placementsReady = segments.every(({ range }) => Boolean(placements[range]));
  const expected = fieldMap(example.decoded);
  const why = example.decoded.format === 'B'
    ? 'A B-type instruction scatters its signed immediate across the high bit, bits 30:25, bits 11:8, and bit 7. The low displacement bit is implicit zero; the register and opcode fields keep their own positions.'
    : `${FORMAT_NAMES[example.decoded.format]} fields occupy fixed positions. Compare the named segment ranges and field roles; register ports use the instruction fields shown by the decoder.`;

  function fresh() {
    setExample(makeInstructionCase(example.decoded.name)); setPlacements({}); setGrade(null); setLocked(false); setAssisted(false);
  }

  function reset() {
    setPlacements({}); setGrade(null); setLocked(false); setAssisted(true);
  }

  function submit() {
    if (locked) return;
    const counted = !assisted && !guided;
    if (counted) onAttempt('formats', correct);
    setGrade({ correct, expected, explanation: why, component: 'Instruction decoder · bit-field selection', counted });
    setLocked(true);
    if (!correct) setAssisted(true);
  }

  function reveal() {
    if (locked) return;
    setGrade(localFormatGrade(false, expected, why, 'Instruction decoder · bit-field selection', true));
    setLocked(true); setAssisted(true);
  }

  return (
    <div className="trainer-stack">
      <section className="panel trainer-panel">
        <div className="trainer-heading-row"><div><h2 className="section-title">Place the instruction fields</h2><p className="muted">Click a bit range, then choose the field that belongs there. The strip reads from bit 31 down to bit 0.</p></div><button className="button button-secondary" onClick={fresh}><Sparkles size={15} /> New instruction</button></div>
        <div className="trainer-instruction-sample"><span className="trainer-sample-mnemonic">{example.decoded.name}</span><code className="mono">{example.source}</code><span>{FORMAT_NAMES[example.decoded.format]}</span></div>
        <FieldStrip key={example.word} decoded={example.decoded} placements={placements} setPlacements={setPlacements} disabled={locked} showCorrect={Boolean(grade)} showHints={guided} />
        {guided && <p className="trainer-inline-note">Guided hints show every field range. This round is not scored toward mastery. For B-type, the immediate is a reconstruction rule, not one contiguous slice.</p>}
        <div className="trainer-actions"><button className="button button-primary" onClick={submit} disabled={locked || !placementsReady}>Check field positions</button><button className="button button-secondary" onClick={reveal} disabled={locked}><Eye size={15} /> Reveal layout</button><button className="button button-secondary" onClick={reset}><RotateCcw size={15} /> Reset layout</button></div>
        {assisted && !grade && <p className="trainer-inline-note">Reset round is practice only. Start a new instruction for a scored check.</p>}
        <Feedback grade={grade} />
      </section>
      {grade && <section className="panel trainer-panel trainer-afterword"><h2 className="section-title">Decoded operands</h2><div className="trainer-field-values">{segments.map(({ field }) => <div key={field}><span>{field}</span><strong className="mono">{fieldDisplay(field, example.decoded)}</strong></div>)}</div><p className="muted">The field names describe instruction bits. A1/A2/A3 are physical register addresses derived from register fields; the register file values are data on the read ports.</p></section>}
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
          : 'Canonical instruction encoder';
  const currentWhy = stage === 0 ? `${example.decoded.name} uses the ${FORMAT_NAMES[example.decoded.format]} layout.`
    : stage === 1 ? `The ${FORMAT_NAMES[example.decoded.format]} ${example.decoded.name} definition assigns opcode ${formatValue(example.decoded.opcode, 'hex')}. This is the encoded family field.`
      : stage === 2 ? 'Register operands keep their declared rs1/rs2/rd roles. Immediate operands are signed values that the encoder packs according to the format.'
        : stage === 3 ? example.decoded.format === 'B' ? 'B immediate bits are scattered; bit 0 is implicit zero. The other fields keep their positions across R, I and B formats.' : 'Register and function fields occupy the positions defined by the selected instruction format.'
          : 'The complete instruction word combines its opcode, operands, function bits and format-specific immediate layout.';
  const operandsComplete = opFields.every(({ key }) => Boolean(answers.operands[key]));
  const fullWord = parseHexWord(answers.hex);
  const stageLabels = ['Format', 'Opcode', 'Operands', 'Field placement', '32-bit word'];

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
    if (!correct) setAssisted(true);
  }

  function reveal() {
    if (locked) return;
    setGrade(localFormatGrade(false, currentExpected, currentWhy, currentComponent, true));
    setLocked(true); setAssisted(true);
  }

  function nextStage() {
    if (!grade || stage === 4) return;
    setStage((stage + 1) as Stage); setGrade(null); setLocked(false);
  }

  function reset() {
    setStage(0); setAnswers(blankEncodeAnswers()); setGrade(null); setLocked(false); setAssisted(true);
  }

  function fresh() {
    setExample(makeInstructionCase(example.decoded.name)); setStage(0); setAnswers(blankEncodeAnswers()); setGrade(null); setLocked(false); setAssisted(false);
  }

  const stageReady = stage === 0 ? Boolean(answers.family)
    : stage === 1 ? Boolean(answers.opcode)
      : stage === 2 ? operandsComplete
      : stage === 3 ? placementReady
          : fullWord !== null;

  return (
    <div className="trainer-stack">
      <section className="panel trainer-panel">
        <div className="trainer-heading-row"><div><h2 className="section-title">Build the encoding in five passes</h2><p className="muted">First identify the instruction family; then enter the fields and let the shared encoder verify the word.</p></div><button className="button button-secondary" onClick={fresh}><Sparkles size={15} /> New instruction</button></div>
        <ol className="trainer-stage-list" aria-label="Encoding practice steps">{stageLabels.map((label, index) => <li key={label} className={`${index === stage ? 'is-current' : ''} ${index < stage ? 'is-done' : ''}`}><span>{index + 1}</span>{label}</li>)}</ol>
        <div className="trainer-instruction-sample"><span className="trainer-sample-mnemonic">{example.decoded.name}</span><code className="mono">{example.source}</code><span>{stage === 0 ? 'Identify the format family.' : `Round ${stage + 1} of 5 · ${stageLabels[stage]}`}</span></div>
        {stage === 0 && <label className="field trainer-field-label"><span>Instruction format family</span><select className="trainer-control" value={answers.family} onChange={(event) => setAnswers({ ...answers, family: event.target.value })} disabled={locked}><option value="">Choose R, I or B</option>{(['R', 'I', 'B'] as InstructionFormat[]).map((format) => <option key={format} value={format}>{FORMAT_NAMES[format]}</option>)}</select></label>}
        {stage === 1 && <label className="field trainer-field-label"><span>Encoded opcode field</span><select className="trainer-control mono" value={answers.opcode} onChange={(event) => setAnswers({ ...answers, opcode: event.target.value })} disabled={locked}><option value="">Choose the seven-bit opcode</option>{opcodeOptions.map((opcode) => <option key={opcode} value={opcode}>{opcode}</option>)}</select></label>}
        {stage === 2 && <><p className="trainer-inline-note">Select the register operands and enter the signed immediate, if this instruction has one.</p><OperandEditor decoded={example.decoded} values={answers.operands} setValues={(operands) => setAnswers({ ...answers, operands })} disabled={locked} /></>}
        {guided && <p className="trainer-inline-note">Guided build: checks are not scored toward mastery. Advance through the steps to see how named fields make the encoded word.</p>}
        {stage === 3 && <><p className="trainer-inline-note">Click each bit slot, then assign its field. You can use the keyboard with the buttons and native field selector.</p><FieldStrip key={`${example.word}-${stage}`} decoded={example.decoded} placements={answers.placements} setPlacements={(placements) => setAnswers({ ...answers, placements })} disabled={locked} showCorrect={Boolean(grade)} /></>}
        {stage === 4 && <label className="field trainer-field-label"><span>Complete 32-bit instruction · hexadecimal</span><input className="trainer-control mono" value={answers.hex} onChange={(event) => setAnswers({ ...answers, hex: event.target.value })} placeholder="0x00000000" disabled={locked} aria-invalid={Boolean(answers.hex) && fullWord === null} /></label>}
        <div className="trainer-actions">
          <button className="button button-primary" onClick={submit} disabled={!stageReady || locked}>{stage === 4 ? 'Check 32-bit word' : `Check ${stageLabels[stage].toLowerCase()}`}</button>
          <button className="button button-secondary" onClick={reveal} disabled={locked}><Eye size={15} /> Reveal this step</button>
          <button className="button button-secondary" onClick={reset}><RotateCcw size={15} /> Reset example</button>
        </div>
        {assisted && !grade && <p className="trainer-inline-note">Practice reset or reveal used: later checks are unscored. Start a new instruction for a fresh scored round.</p>}
        <Feedback grade={grade} />
        {grade && stage < 4 && <button className="button button-primary trainer-next-step" onClick={nextStage}>Continue to {stageLabels[stage + 1]} <ArrowRight size={15} /></button>}
        {grade && stage === 4 && <div className="trainer-final-word"><span>Complete 32-bit instruction word</span><strong className="mono">{expectHex}</strong><code>{formatValue(encodedWord, 'binary')}</code></div>}
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
