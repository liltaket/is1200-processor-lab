import { useState } from 'react';
import { Eye, RefreshCw, RotateCcw } from 'lucide-react';
import type { ModeProps } from '../ui-types';
import {
  formatValue,
  generateScenario,
  instructionText,
  parseValue,
  traceCycle,
  toSigned,
} from '../engine';
import type { CycleTrace, Scenario } from '../engine';
import { Feedback, useCheck } from './trainerFeedback';

export interface BranchLabProps extends ModeProps {
  topic: 'branch' | 'rom';
}

type LabCase = { scenario: Scenario; trace: CycleTrace };
type BranchAnswers = { subtraction: string; zero: string; branch: string; taken: string; target: string; pcPlus4: string; nextPc: string };

const EMPTY_BRANCH_ANSWERS: BranchAnswers = { subtraction: '', zero: '', branch: '', taken: '', target: '', pcPlus4: '', nextPc: '' };

function createCase(topic: BranchLabProps['topic']): LabCase {
  const scenario = generateScenario(topic === 'branch' ? 'beq' : 'add');
  return { scenario, trace: traceCycle(scenario.state, scenario.word) };
}

function parseNumber(text: string): number | null {
  if (!text.trim()) return null;
  try {
    return parseValue(text);
  } catch {
    return null;
  }
}

function pcLabel(value: number): string {
  return `0x${value.toString(16).padStart(2, '0').toUpperCase()} (${value})`;
}

function BranchTrainer({ onAttempt }: Pick<ModeProps, 'onAttempt'>) {
  const [labCase, setLabCase] = useState<LabCase>(() => createCase('branch'));
  const [answers, setAnswers] = useState<BranchAnswers>(EMPTY_BRANCH_ANSWERS);
  const check = useCheck('branch', onAttempt);
  const { scenario, trace } = labCase;
  const subtractionValue = parseNumber(answers.subtraction);
  const targetValue = parseNumber(answers.target);
  const pcPlus4Value = parseNumber(answers.pcPlus4);
  const nextPcValue = parseNumber(answers.nextPc);
  const subtractionCorrect = subtractionValue === (trace.aluResult >>> 0);
  const targetCorrect = targetValue === (trace.branchTarget >>> 0);
  const pcPlus4Correct = pcPlus4Value === (trace.pcPlus4 >>> 0);
  const nextPcCorrect = nextPcValue === (trace.pcNext >>> 0);

  function setAnswer(key: keyof BranchAnswers, value: string) {
    setAnswers((previous) => ({ ...previous, [key]: value }));
  }

  function expectedText() {
    return `SUB result=${formatValue(trace.aluResult, 'decimal')} · Zero=${trace.zero} · Branch=${trace.control.branch} · Taken=${trace.branchTaken ? 'Yes' : 'No'} · target=${trace.branchTarget} · PC+4=${trace.pcPlus4} · PCnext=${trace.pcNext}`;
  }

  function explanationForAnswer() {
    if (!subtractionCorrect) {
      return `The ALU subtracts RD2 from RD1: ${toSigned(trace.rd1)} − ${toSigned(trace.rd2)}. The 32-bit result wraps to ${formatValue(trace.aluResult, 'decimal')} (hex ${formatValue(trace.aluResult, 'hex')}).`;
    }
    if (answers.zero !== String(trace.zero)) {
      return `Zero is 1 only when the 32-bit subtraction result is exactly zero. This SUB result is ${formatValue(trace.aluResult, 'decimal')}, so Zero=${trace.zero}.`;
    }
    if (answers.branch !== String(trace.control.branch)) {
      return `The beq decoder asserts Branch=${trace.control.branch}. Branch identifies the instruction as a conditional branch; it does not by itself say that the condition succeeded.`;
    }
    if ((answers.taken === 'yes') !== trace.branchTaken) {
      return `The operands are ${toSigned(trace.rd1)} and ${toSigned(trace.rd2)}. The ALU subtracts them, so Zero=${trace.zero}; the branch is taken only when Branch=1 AND Zero=1.`;
    }
    if (!targetCorrect) {
      return `The branch target uses the current byte PC plus the signed byte displacement: ${trace.pc} + (${trace.immediate}), with the Lab 4 PC wrapping modulo 256.`;
    }
    if (!pcPlus4Correct) {
      return `The sequential address is the current byte PC plus four: ${trace.pc} + 4 = ${trace.pcPlus4}, wrapping modulo 256 in Lab 4.`;
    }
    if (!nextPcCorrect) {
      return `The PC mux selects the target when Branch AND Zero is true; otherwise it selects PC+4. Both values wrap in the 8-bit Lab 4 PC.`;
    }
    return `The ALU subtracts the operands and reports Zero=${trace.zero}. Branch=${trace.control.branch}, so Branch AND Zero is ${trace.branchTaken ? 'true' : 'false'}. The PC mux chooses ${trace.branchTaken ? 'the target' : 'PC+4'}.`;
  }

  function componentForAnswer() {
    if (!subtractionCorrect) return 'ALU subtractor';
    if (answers.zero !== String(trace.zero)) return 'ALU Zero output';
    if (answers.branch !== String(trace.control.branch)) return 'Control decoder';
    if ((answers.taken === 'yes') !== trace.branchTaken) return 'Branch decision · ALU Zero';
    if (!targetCorrect) return 'Immediate generator · branch target adder';
    if (!pcPlus4Correct) return 'Sequential PC adder';
    if (!nextPcCorrect) return 'PC selection mux';
    return 'Control · ALU · PC path';
  }

  function submit() {
    const correct = subtractionCorrect
      && answers.zero === String(trace.zero)
      && answers.branch === String(trace.control.branch)
      && (answers.taken === 'yes') === trace.branchTaken
      && targetCorrect
      && pcPlus4Correct
      && nextPcCorrect;
    check.check(correct, expectedText(), explanationForAnswer(), componentForAnswer());
  }

  function reveal() {
    if (check.locked) return;
    setAnswers({
      subtraction: String(trace.aluResult),
      zero: String(trace.zero),
      branch: String(trace.control.branch),
      taken: trace.branchTaken ? 'yes' : 'no',
      target: String(trace.branchTarget),
      pcPlus4: String(trace.pcPlus4),
      nextPc: String(trace.pcNext),
    });
    check.reveal(
      expectedText(),
      `Branch=${trace.control.branch} identifies beq, while Taken is Branch AND Zero=${trace.branchTaken ? '1' : '0'}. The target is the current PC plus the signed byte offset; the next-PC mux selects ${trace.branchTaken ? 'the target' : 'PC+4'}.`,
      'Control · ALU · PC path',
    );
  }

  function resetAnswers() {
    setAnswers(EMPTY_BRANCH_ANSWERS);
    check.reset();
  }

  function newQuestion() {
    setLabCase(createCase('branch'));
    setAnswers(EMPTY_BRANCH_ANSWERS);
    check.fresh();
  }

  const complete = answers.subtraction.trim() !== '' && answers.zero !== ''
    && answers.branch !== '' && answers.taken !== '' && answers.target.trim() !== ''
    && answers.pcPlus4.trim() !== '' && answers.nextPc.trim() !== '';
  const outcomeRevealed = Boolean(check.grade);

  return (
    <div className="trainer-stack">
      <section className="panel trainer-panel">
        <div className="trainer-heading-row">
          <div>
            <h2 className="section-title">Calculate the next PC</h2>
            <p className="muted">Fill in the comparison and both PC paths, then check your answer.</p>
          </div>
          <button className="button button-secondary" type="button" onClick={newQuestion}><RefreshCw size={15} /> New branch</button>
        </div>

        <div className="trainer-branch-context">
          <div><span>Instruction</span><strong className="mono">{instructionText(scenario.instruction)}</strong><code>{formatValue(scenario.word, 'hex')}</code></div>
          <div><span>Byte PC</span><strong className="mono">{pcLabel(trace.pc)}</strong></div>
          <div><span>Signed byte offset</span><strong className="mono">{trace.immediate > 0 ? '+' : ''}{trace.immediate}</strong></div>
        </div>

        <div className="trainer-branch-operands" aria-label="Branch comparison inputs">
          <div><span>RD1 · x{trace.instruction.a1}</span><strong className="mono">{toSigned(trace.rd1)}</strong></div>
          <span className="trainer-branch-operator" aria-hidden="true">−</span>
          <div><span>RD2 · x{trace.instruction.a2}</span><strong className="mono">{toSigned(trace.rd2)}</strong></div>
          <span className="trainer-branch-operator" aria-hidden="true">→</span>
          <div><span>SUB result · Y</span><strong className="mono">{outcomeRevealed ? formatValue(trace.aluResult, 'decimal') : '?'}</strong></div>
          <span className="trainer-branch-operator" aria-hidden="true">→</span>
          <div><span>ALU Zero</span><strong className="mono">{outcomeRevealed ? trace.zero : '?'}</strong></div>
        </div>

        <div className="trainer-branch-exercise">

          <div className="trainer-form-grid trainer-branch-answer-grid">
            <label className="field trainer-field-label">
              <span>SUB result · ALU Y</span>
              <input className="trainer-control mono" value={answers.subtraction} onChange={(event) => setAnswer('subtraction', event.target.value)} placeholder="Decimal, 0x, or 0b" disabled={check.locked} aria-invalid={answers.subtraction !== '' && subtractionValue === null} />
            </label>
            <label className="field trainer-field-label">
              <span>ALU Zero</span>
              <select className="trainer-control" value={answers.zero} onChange={(event) => setAnswer('zero', event.target.value)} disabled={check.locked}>
                <option value="">Choose</option><option value="0">0 · nonzero result</option><option value="1">1 · zero result</option>
              </select>
            </label>
            <label className="field trainer-field-label">
              <span>Branch control enabled?</span>
              <select className="trainer-control" value={answers.branch} onChange={(event) => setAnswer('branch', event.target.value)} disabled={check.locked}>
                <option value="">Choose</option><option value="1">Yes · Branch=1</option><option value="0">No · Branch=0</option>
              </select>
            </label>
            <label className="field trainer-field-label">
              <span>Is the branch taken?</span>
              <select className="trainer-control" value={answers.taken} onChange={(event) => setAnswer('taken', event.target.value)} disabled={check.locked}>
                <option value="">Choose</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
            </label>
            <label className="field trainer-field-label">
              <span>Branch target · byte address</span>
              <input className="trainer-control mono" value={answers.target} onChange={(event) => setAnswer('target', event.target.value)} placeholder="Decimal, 0x, or 0b" disabled={check.locked} aria-invalid={answers.target !== '' && targetValue === null} />
            </label>
            <label className="field trainer-field-label">
              <span>PC+4 · byte address</span>
              <input className="trainer-control mono" value={answers.pcPlus4} onChange={(event) => setAnswer('pcPlus4', event.target.value)} placeholder="Decimal, 0x, or 0b" disabled={check.locked} aria-invalid={answers.pcPlus4 !== '' && pcPlus4Value === null} />
            </label>
            <label className="field trainer-field-label">
              <span>PCnext · byte address</span>
              <input className="trainer-control mono" value={answers.nextPc} onChange={(event) => setAnswer('nextPc', event.target.value)} placeholder="Decimal, 0x, or 0b" disabled={check.locked} aria-invalid={answers.nextPc !== '' && nextPcValue === null} />
            </label>
          </div>
          <div className="trainer-actions">
            <button className="button button-primary" type="button" onClick={submit} disabled={!complete || check.locked}>Check branch</button>
            <button className="button button-secondary" type="button" onClick={reveal} disabled={check.locked}><Eye size={15} /> Reveal answer</button>
            <button className="button button-secondary" type="button" onClick={resetAnswers}><RotateCcw size={15} /> Reset answers</button>
          </div>
          {check.assisted && !check.grade && <p className="trainer-inline-note">Practice · not scored</p>}
          <Feedback grade={check.grade} />
        </div>
      </section>

      <details className="trainer-extra"><summary>Follow the branch path</summary><section className="panel trainer-panel trainer-branch-path" aria-label="Branch and next-PC reference">
        <div className="trainer-heading-row"><div><h2 className="section-title">From comparison to next PC</h2><p className="muted">The instruction decoder, ALU, and PC mux each have a distinct role.</p></div></div>
        <div className="trainer-branch-signal-grid">
          <div><span>Control decoder</span><strong>Branch = {outcomeRevealed ? trace.control.branch : '?'}</strong><small>Marks this instruction as a branch.</small></div>
          <div><span>ALU comparison</span><strong>Zero = {outcomeRevealed ? trace.zero : '—'}</strong><small>SUB produces Zero=1 when RD1 equals RD2.</small></div>
          <div><span>Branch decision</span><strong>Taken = {outcomeRevealed ? (trace.branchTaken ? '1' : '0') : 'Branch AND Zero'}</strong><small>Branch=1 alone does not guarantee a taken branch.</small></div>
        </div>
        <div className="trainer-branch-pc-flow">
          <div><span>Sequential path</span><strong className="mono">PC+4 = {outcomeRevealed ? trace.pcPlus4 : '—'}</strong></div>
          <div><span>Branch path</span><strong className="mono">PC + offset = {outcomeRevealed ? trace.branchTarget : '—'}</strong></div>
          <div className="trainer-branch-next"><span>PC mux output</span><strong className="mono">PCnext = {outcomeRevealed ? trace.pcNext : 'your prediction'}</strong></div>
        </div>
        <ul className="trainer-branch-notes">
          <li>The B-format immediate is a signed byte displacement, added to the current instruction PC (not PC+4).</li>
          <li>The B-format low immediate bit is implicit zero. This Lab 4 model requires a taken target to be word-aligned (a multiple of four).</li>
          <li>The Lab 4 PC is 8 bits. PC+4 and PC+offset wrap modulo 256; for example, 252+8 wraps to 4.</li>
        </ul>
      </section></details>
    </div>
  );
}

function RomTrainer({ onAttempt }: Pick<ModeProps, 'onAttempt'>) {
  const [labCase, setLabCase] = useState<LabCase>(() => createCase('rom'));
  const [answer, setAnswer] = useState('');
  const check = useCheck('rom', onAttempt);
  const { trace } = labCase;
  const validNumber = parseNumber(answer);

  function expectedText() {
    return `ROM word ${trace.romAddress} is fetched at byte PC ${trace.pc}; it contains ${formatValue(trace.instruction.word, 'hex')} (${trace.instruction.name}).`;
  }

  function submit() {
    check.check(validNumber === trace.romAddress, expectedText(),
      `The PC is byte-addressed and each instruction is one 32-bit word (four bytes), so ${trace.pc} ÷ 4 selects ROM word ${trace.romAddress}.`,
      'PC · instruction ROM');
  }

  function reveal() {
    if (check.locked) return;
    setAnswer(String(trace.romAddress));
    check.reveal(String(trace.romAddress),
      `PC ${trace.pc} is a byte address. Dividing by four selects ROM word ${trace.romAddress}; that word decodes as ${trace.instruction.name}.`,
      'PC · instruction ROM');
  }

  function resetAnswer() {
    setAnswer('');
    check.reset();
  }

  function newQuestion() {
    setLabCase(createCase('rom'));
    setAnswer('');
    check.fresh();
  }

  return (
    <div className="trainer-stack">
      <section className="panel trainer-panel">
        <div className="trainer-heading-row">
          <div>
            <h2 className="section-title">Find the instruction ROM word</h2>
            <p className="muted">The processor PC is byte-addressed; the instruction ROM is indexed by 32-bit words.</p>
          </div>
          <button className="button button-secondary" type="button" onClick={newQuestion}><RefreshCw size={15} /> New fetch</button>
        </div>

        <div className="trainer-rom-fetch">
          <div className="trainer-rom-address"><span>Byte PC</span><strong className="mono">{pcLabel(trace.pc)}</strong></div>
          <div className="trainer-rom-arrow" aria-hidden="true">→</div>
          <div className="trainer-rom-address"><span>ROM word index</span><strong className="mono">{check.grade ? trace.romAddress : '?'}</strong></div>
        </div>

        <div className="trainer-rom-question">
          <label className="field trainer-field-label">
            <span>Which ROM word index does this PC select?</span>
          <input className="trainer-control mono" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Decimal, 0x, or 0b" disabled={check.locked} aria-invalid={answer !== '' && validNumber === null}  />
          </label>
          <div className="trainer-actions">
            <button className="button button-primary" type="button" onClick={submit} disabled={answer.trim() === '' || validNumber === null || check.locked}>Check ROM address</button>
            <button className="button button-secondary" type="button" onClick={reveal} disabled={check.locked}><Eye size={15} /> Reveal answer</button>
            <button className="button button-secondary" type="button" onClick={resetAnswer}><RotateCcw size={15} /> Reset answer</button>
          </div>
          {check.assisted && !check.grade && <p className="trainer-inline-note">Practice · not scored</p>}
          <Feedback grade={check.grade} />
        </div>
      </section>

      <details className="trainer-extra"><summary>Why divide by four?</summary><section className="panel trainer-panel trainer-rom-explainer">
        <div className="trainer-heading-row"><div><h2 className="section-title">Byte addresses and word indices</h2><p className="muted">The PC points to bytes. The ROM stores one complete 32-bit instruction per entry.</p></div></div>
        <div className="trainer-rom-equation"><span className="mono">ROM address = PC ÷ 4 = PC &gt;&gt; 2</span><span>For example, byte PC 12 selects ROM word 3.</span></div>
        <p className="trainer-inline-note">Lab 4 instruction PCs are aligned to four bytes, so the low two PC bits are zero. Dividing by four selects the word stored at that address.</p>
      </section></details>
    </div>
  );
}

export function BranchLab({ topic, onAttempt }: BranchLabProps) {
  return topic === 'branch' ? <BranchTrainer onAttempt={onAttempt} /> : <RomTrainer onAttempt={onAttempt} />;
}
