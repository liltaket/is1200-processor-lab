import { useMemo, useRef, useState } from 'react';
import { useLesson } from '../course';
import { NumberAnswer } from '../components/NumberAnswer';
import {
  CLOCK_EVENTS,
  ORAL_QUESTIONS,
} from '../learning';
import type { ModeProps } from '../ui-types';
import {
  commitCycle,
  createState,
  decode,
  factorialSource,
  formatValue,
  instructionText,
  parseAssembly,
  parseValue,
  REGISTER_NAMES,
  toSigned,
  traceCycle,
} from '../engine';
import type { CpuState, CycleTrace, ProgramLine } from '../engine';
import './study.css';

export interface StudyLabProps extends ModeProps {
  topic: 'clock' | 'oral' | 'factorial';
}
type StudyLesson = ReturnType<typeof useLesson>;

const MAX_RUN_CYCLES = 512;
const FACTORIAL_INPUTS = [0, 3, 8] as const;

type PredictionStep = {
  pc: number;
  instruction: string;
  write: string;
  t2: number;
};
type Prediction = { expected: number; after: number; trace: CycleTrace | null; history: PredictionStep[] };

function sameProgram(left: ProgramLine[], right: ProgramLine[]): boolean {
  return left.length === right.length && left.every((line, index) =>
    line.address === right[index].address && line.word === right[index].word);
}

function makeAssemblyProgram(source: string): ProgramLine[] {
  const program = parseAssembly(source, 'lab');
  if (program.length === 0) throw new SyntaxError('Add at least one supported instruction.');
  validateLabRegisterFields(program);
  return program;
}

function validateLabRegisterFields(program: ProgramLine[]): void {
  for (const [index, line] of program.entries()) {
    for (const [field, register] of Object.entries(line.instruction)) {
      if (['rd', 'rs1', 'rs2'].includes(field) && typeof register === 'number' && register > 7) {
        throw new RangeError(`Instruction ${index + 1} uses x${register}; Lab 4 programs may only use x0–x7.`);
      }
    }
  }
}

function makeHexProgram(source: string): ProgramLine[] {
  const cleaned = source
    .replace(/^\s*v2\.0\s+raw\s*/i, '')
    .replace(/#.*$/gm, '')
    .replace(/\/\/.*$/gm, '')
    .trim();
  if (!cleaned) throw new SyntaxError('The hex file does not contain any instruction words.');
  const tokens = cleaned.split(/[\s,]+/).filter(Boolean);
  const program: ProgramLine[] = tokens.map((token, index) => {
    const normalized = token.replace(/^0x/i, '');
    if (!/^[\da-f]{1,8}$/i.test(normalized)) {
      throw new SyntaxError(`Expected one 32-bit hexadecimal word per token; found “${token}”.`);
    }
    const word = Number.parseInt(normalized, 16) >>> 0;
    const instruction = decode(word, 'lab');
    return {
      address: index * 4,
      word,
      instruction: { name: instruction.name, rd: instruction.rd, rs1: instruction.rs1, rs2: instruction.rs2, imm: instruction.imm },
      source: instructionText(instruction),
    };
  });
  if (program.length > 64) throw new RangeError('Lab ROM accepts at most 64 instruction words.');
  validateLabRegisterFields(program);
  return program;
}

function isHexText(source: string, fileName: string): boolean {
  if (/\.hex$/i.test(fileName) || /^\s*v2\.0\s+raw\b/i.test(source)) return true;
  const words = source.replace(/#.*$/gm, '').replace(/\/\/.*$/gm, '').trim();
  if (!words) return false;
  const tokens = words.split(/[\s,]+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => /^(?:0x)?[\da-f]{1,8}$/i.test(token));
}

function initialProgram(n: number): { source: string; program: ProgramLine[]; state: CpuState } {
  const source = factorialSource(n);
  const program = makeAssemblyProgram(source);
  const memory = Object.fromEntries(program.map((line) => [line.address, line.word]));
  const state = { ...createState('lab'), memory };
  return { source, program, state };
}

function predict(program: ProgramLine[], state: CpuState, steps: number): Prediction {
  let nextState = state;
  let finalTrace: CycleTrace | null = null;
  const history: PredictionStep[] = [];
  for (let index = 0; index < steps; index += 1) {
    const line = program.find(({ address }) => address === nextState.pc);
    if (!line) throw new RangeError(`PC ${formatValue(nextState.pc, 'hex')} is outside the loaded program.`);
    finalTrace = traceCycle(nextState, line.word);
    nextState = commitCycle(nextState, finalTrace);
    let write = 'No register write';
    if (finalTrace.control.regWrite === 1 && finalTrace.writeRegister !== null) {
      const registerName = REGISTER_NAMES[finalTrace.writeRegister] ?? `x${finalTrace.writeRegister}`;
      write = finalTrace.writeRegister === 0
        ? `x0 write ignored (data ${toSigned(finalTrace.writeData)})`
        : `${registerName} ← ${toSigned(finalTrace.writeData)}`;
    }
    history.push({
      pc: finalTrace.pc,
      instruction: instructionText(finalTrace.instruction),
      write,
      t2: toSigned(nextState.registers[7]),
    });
  }
  return { expected: toSigned(nextState.registers[7]), after: nextState.pc, trace: finalTrace, history };
}

function ClockMode({ onAttempt, lesson }: Pick<ModeProps, 'onAttempt'> & { lesson: StudyLesson }) {
  const [selected, setSelected] = useState<'combinational' | 'edge' | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const event = CLOCK_EVENTS[lesson.index];
  const correct = selected === event.answer;

  function submit() {
    if (!selected || submitted) return;
    setSubmitted(true);
    if (lesson.status !== 2) {
      onAttempt('clock', correct);
      lesson.complete(correct ? 'solved' : 'reviewed');
    }
  }

  return (
    <div className="study-stack">
      <section className="panel study-panel">
        <h2 className="section-title">When does the event happen?</h2>
        <p className="study-prompt">{event.event}</p>
        <div className="study-choice-row" role="group" aria-label="Choose when the event happens">
          <button className={`button button-secondary study-choice ${selected === 'combinational' ? 'is-selected' : ''}`} aria-pressed={selected === 'combinational'} disabled={submitted} onClick={() => setSelected('combinational')}>
            Immediate propagation
          </button>
          <button className={`button button-secondary study-choice ${selected === 'edge' ? 'is-selected' : ''}`} aria-pressed={selected === 'edge'} disabled={submitted} onClick={() => setSelected('edge')}>
            Rising clock edge
          </button>
        </div>
        {submitted && (
          <div className={`feedback ${correct ? 'correct' : 'incorrect'}`} role="status">
            <strong>{correct ? 'Correct.' : `The event is ${event.answer === 'edge' ? 'at the rising edge' : 'combinational'}.`}</strong>
            <p>{event.explanation}</p>
          </div>
        )}
        <div className="study-actions">
          {!submitted && <button className="button button-primary" disabled={!selected} onClick={submit}>Check timing</button>}
        </div>
      </section>
    </div>
  );
}

function OralMode({ onAttempt, lesson }: Pick<StudyLabProps, 'onAttempt'> & { lesson: StudyLesson }) {
  const [notes, setNotes] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState(false);
  const question = ORAL_QUESTIONS[lesson.index];
  const scopeLabel = question.scope === 'lab' ? 'Lab 4' : 'Lecture 9 extension';

  function selfGrade(understood: boolean) {
    if (!question || graded) return;
    setGraded(true);
    if (lesson.status !== 2) {
      onAttempt(question.topic, understood);
      lesson.complete(understood ? 'solved' : 'reviewed');
    }
  }

  return (
    <div className="study-stack">
      <section className="panel study-panel">
        <div className="study-toolbar">
          <span className="chip">{scopeLabel}</span>
          <details className="study-example-details">
            <summary>Choose question</summary>
            <select aria-label="Choose oral question" className="study-select" value={lesson.index} onChange={(event) => lesson.goTo(Number(event.target.value))}>
              {ORAL_QUESTIONS.map((item, index) => (
                <option value={index} key={item.id}>{item.scope === 'lab' ? 'Lab 4' : 'Lecture 9'} · {item.prompt}</option>
              ))}
            </select>
          </details>
        </div>
        {question ? <>
          <h2 className="study-prompt">{question.prompt}</h2>
          <label className="field study-notes-label" htmlFor="oral-notes">Your answer</label>
          <textarea id="oral-notes" className="study-textarea" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Write your answer…" rows={4} />
          {revealed && (
            <div className="study-answer-card">
              <div className="study-answer-heading">Expected concepts and model answer</div>
              <div className="study-concepts">{question.concepts.map((concept) => <span className="chip" key={concept}>{concept}</span>)}</div>
              <p>{question.answer}</p>
              <details className="study-source-details"><summary>Source</summary><p>{question.source}</p></details>
            </div>
          )}
          {!revealed ? <button className="button button-primary" onClick={() => setRevealed(true)}>Reveal answer guide</button>
            : <div className="study-grade-row">
              <button className="button button-secondary" onClick={() => selfGrade(false)} disabled={graded}>Needs review</button>
              <button className="button button-primary" onClick={() => selfGrade(true)} disabled={graded}>Understood</button>
            </div>}
        </> : <p className="muted">No question at this lesson position.</p>}
      </section>
    </div>
  );
}

function FactorialMode({ onAttempt, lesson }: Pick<ModeProps, 'onAttempt'> & { lesson: StudyLesson }) {
  const lessonN = FACTORIAL_INPUTS[lesson.index] ?? FACTORIAL_INPUTS[0];
  const [source, setSource] = useState(() => factorialSource(lessonN));
  const [program, setProgram] = useState<ProgramLine[]>(() => makeAssemblyProgram(factorialSource(lessonN)));
  const [state, setState] = useState<CpuState>(() => initialProgram(lessonN).state);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [lastTrace, setLastTrace] = useState<CycleTrace | null>(null);
  const [changed, setChanged] = useState<number[]>([]);
  const [predictionSteps, setPredictionSteps] = useState(1);
  const [predictionInput, setPredictionInput] = useState('');
  const [predictionResult, setPredictionResult] = useState<Prediction | null>(null);
  const [halted, setHalted] = useState(false);
  const [sourceDirty, setSourceDirty] = useState(false);
  const [isAuthoredExample, setIsAuthoredExample] = useState(true);
  const [assistedPredictionKey, setAssistedPredictionKey] = useState<string | null>(null);
  const courseAssisted = useRef(false);
  const [scoredPredictionKey, setScoredPredictionKey] = useState<string | null>(null);
  const currentLine = program.find(({ address }) => address === state.pc);
  const currentRomIndex = state.pc >>> 2;
  const predictionKey = `${state.cycles}:${state.pc}:${predictionSteps}:${program.map(({ address, word }) => `${address}-${word}`).join(',')}`;
  const expectedPrediction = useMemo(() => {
    try { return predict(program, state, predictionSteps).expected; }
    catch { return null; }
  }, [program, state, predictionSteps]);
  const exactSharedExample = isAuthoredExample && !sourceDirty
    && source === factorialSource(lessonN)
    && sameProgram(program, makeAssemblyProgram(factorialSource(lessonN)));

  function commitLoaded(nextSource: string, nextProgram: ProgramLine[], detail: string, authoredExample: boolean) {
    const memory = Object.fromEntries(nextProgram.map((line) => [line.address, line.word]));
    setProgram(nextProgram);
    setSource(nextSource);
    setState({ ...createState('lab'), memory });
    setLastTrace(null);
    setChanged([]);
    setPredictionResult(null);
    setPredictionInput('');
    setHalted(false);
    setSourceDirty(false);
    setIsAuthoredExample(authoredExample);
    setAssistedPredictionKey(null);
    setScoredPredictionKey(null);
    setIsError(false);
    setMessage(detail);
  }

  function loadExample(nextN = lessonN) {
    try {
      const nextSource = factorialSource(nextN);
      const nextProgram = makeAssemblyProgram(nextSource);
      commitLoaded(nextSource, nextProgram, `Example loaded for n=${nextN}.`, true);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    try {
      const text = await file.text();
      const isHex = isHexText(text, file.name);
      const nextProgram = isHex ? makeHexProgram(text) : makeAssemblyProgram(text);
      const visibleSource = isHex ? nextProgram.map(({ source: line }) => line).join('\n') : text;
      commitLoaded(visibleSource, nextProgram, `${file.name} loaded.`, false);
    } catch (error) {
      setIsError(true);
      setMessage(`File was not loaded: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function stepOnce() {
    if (halted) return;
    if (sourceDirty) {
      setIsError(true);
      setMessage('Assemble the edited source before stepping the processor.');
      return;
    }
    if (!currentLine) {
      setIsError(true);
      setMessage(`No instruction is loaded at PC ${formatValue(state.pc, 'hex')}. The current state was not changed.`);
      return;
    }
    try {
      const trace = traceCycle(state, currentLine.word);
      const next = commitCycle(state, trace);
      const changedRegisters = state.registers.flatMap((value, index) => next.registers[index] !== value ? [index] : []);
      const stopSelfLoop = trace.instruction.name === 'beq' && trace.branchTaken && trace.pcNext === trace.pc;
      setLastTrace(trace);
      setChanged(changedRegisters);
      setState(next);
      setHalted(stopSelfLoop);
      if (stopSelfLoop && exactSharedExample && lesson.status === 0) lesson.complete('reviewed');
      setIsError(false);
      setMessage(stopSelfLoop
        ? `Stop loop reached after ${next.cycles} clock cycles. t2 = ${toSigned(next.registers[7])}.`
        : `Clock edge committed. PC ${formatValue(trace.pc, 'hex')} → ${formatValue(next.pc, 'hex')}${trace.branchTaken ? ' · branch taken' : ''}.`);
    } catch (error) {
      setIsError(true);
      setMessage(`Trace failed: ${error instanceof Error ? error.message : String(error)}. State was not changed.`);
    }
  }

  function runToStop() {
    if (sourceDirty) {
      setIsError(true);
      setMessage('Assemble the edited source before running the processor.');
      return;
    }
    let working = state;
    let finalTrace: CycleTrace | null = null;
    const changedIndexes = new Set<number>();
    let stopped = false;
    try {
      for (let count = 0; count < MAX_RUN_CYCLES; count += 1) {
        const line = program.find(({ address }) => address === working.pc);
        if (!line) throw new RangeError(`PC ${formatValue(working.pc, 'hex')} is outside the loaded program.`);
        const trace = traceCycle(working, line.word);
        const next = commitCycle(working, trace);
        next.registers.forEach((value, index) => { if (value !== working.registers[index]) changedIndexes.add(index); });
        finalTrace = trace;
        working = next;
        if (trace.instruction.name === 'beq' && trace.branchTaken && trace.pcNext === trace.pc) {
          stopped = true;
          break;
        }
      }
      setState(working);
      setLastTrace(finalTrace);
      setChanged([...changedIndexes]);
      setHalted(stopped);
      setIsError(!stopped);
      setMessage(stopped
        ? `Stop loop reached after ${working.cycles} total clock cycles. t2 = ${toSigned(working.registers[7])}.`
        : `Stopped after ${MAX_RUN_CYCLES} instructions without finding a self-branching stop loop.`);
      if (stopped && exactSharedExample && lesson.status === 0) lesson.complete('reviewed');
    } catch (error) {
      setIsError(true);
      setMessage(`Run stopped before changing the visible state: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function checkPrediction() {
    if (sourceDirty) {
      setIsError(true);
      setMessage('Assemble the edited source before making a prediction.');
      return;
    }
    try {
      const result = predict(program, state, predictionSteps);
      setPredictionResult(result);
      const entered = toSigned(parseValue(predictionInput));
      const correct = entered === result.expected;
      const alreadyScored = scoredPredictionKey === predictionKey;
      const assisted = assistedPredictionKey === predictionKey;
      if (!correct || assisted) courseAssisted.current = true;
      if (!alreadyScored && lesson.status !== 2) {
        if (!assisted) {
          onAttempt('factorial', correct);
          if (exactSharedExample) lesson.complete(correct && !courseAssisted.current ? 'solved' : 'reviewed');
        }
        setScoredPredictionKey(predictionKey);
      } else if (!alreadyScored) {
        setScoredPredictionKey(predictionKey);
      }
      setIsError(!correct);
      const status = correct
        ? `Correct. After ${predictionSteps} instruction${predictionSteps === 1 ? '' : 's'}, t2 will be ${result.expected}.`
        : `Not quite. The next instruction edges produce t2=${result.expected} after ${predictionSteps} instruction${predictionSteps === 1 ? '' : 's'}.`;
      setMessage(`${status} The CPU state has not advanced.${assisted || alreadyScored ? ' This assisted or repeated check was not counted as a new attempt.' : ''}`);
    } catch (error) {
      setPredictionResult(null);
      setIsError(true);
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function predictValue() {
    if (sourceDirty) {
      setIsError(true);
      setMessage('Assemble the edited source before previewing its result.');
      return;
    }
    try {
      const result = predict(program, state, predictionSteps);
      setPredictionResult(result);
      setPredictionInput(String(result.expected));
      setAssistedPredictionKey(predictionKey);
      courseAssisted.current = true;
      if (exactSharedExample) lesson.complete('reviewed');
    } catch (error) {
      setPredictionResult(null);
      setIsError(true);
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function reset() {
    const memory = Object.fromEntries(program.map((line) => [line.address, line.word]));
    setState({ ...createState('lab'), memory });
    setLastTrace(null);
    setChanged([]);
    setPredictionResult(null);
    setPredictionInput('');
    setHalted(false);
    setAssistedPredictionKey(null);
    setScoredPredictionKey(null);
    setMessage('Processor reset to PC=0 and zeroed registers.');
    setIsError(false);
  }

  const lastOutcome = lastTrace
    ? lastTrace.control.branch ? lastTrace.branchTaken ? 'taken' : 'not taken' : 'not a branch'
    : '—';

  return (
    <div className="study-stack">
      <section className="panel study-panel">
        <div className="study-toolbar study-factorial-toolbar">
          <label className="field study-select-wrap">Example input n
            <select className="study-select" value={lesson.index} onChange={(event) => lesson.goTo(Number(event.target.value))}>
              {FACTORIAL_INPUTS.map((value, index) => <option value={index} key={value}>{value}</option>)}
            </select>
          </label>
          <details className="study-example-details">
            <summary>Example program</summary>
            <p>This sample uses repeated addition; it is an authored example, not the course’s canonical program.</p>
            <button className="button button-secondary" onClick={() => loadExample()}>Load example</button>
          </details>
        </div>
        <div className="study-cpu-column">
          <div className="study-cpu-heading">
            <h2 className="section-title">Current state</h2>
            <span className={`chip ${halted ? 'study-stop-chip' : ''}`}>{halted ? 'Stop loop' : `${state.cycles} cycles`}</span>
          </div>
          <div className="study-cpu-readouts">
            <div><span>PC (byte address)</span><strong className="mono">{formatValue(state.pc, 'hex')}</strong></div>
            <div><span>ROM word</span><strong className="mono">{currentRomIndex}</strong></div>
            <div><span>t2</span><strong className="mono">{toSigned(state.registers[7])}</strong></div>
          </div>
          <div className="study-instruction-card">
            <span>Instruction</span>
            {currentLine ? <><strong className="mono">{currentLine.source}</strong><small className="mono">{formatValue(currentLine.word, 'hex')}</small></>
              : <strong className="study-outside-program">No instruction at this address</strong>}
          </div>
          <div className="study-actions study-sim-actions">
            <button className="button button-primary study-tick-button" onClick={stepOnce} disabled={halted || !currentLine || sourceDirty}>Tick rising edge</button>
            <button className="button button-secondary" onClick={runToStop} disabled={halted || !currentLine || sourceDirty}>Run to stop</button>
            <button className="button button-secondary" onClick={reset}>Reset</button>
          </div>
          <div className="register-grid study-register-grid">
            {REGISTER_NAMES.map((name, index) => (
              <div className={`study-register ${changed.includes(index) ? 'is-changed' : ''}`} key={name}>
                <span>{name}</span><strong className="mono">{toSigned(state.registers[index])}</strong>
                {changed.includes(index) && <small>changed</small>}
              </div>
            ))}
          </div>
          {lastTrace && <details className="study-edge-details"><summary>Last edge</summary><div className="study-last-trace">
            <div><span>Last branch</span><strong>{lastOutcome}</strong></div>
            <div><span>PC next</span><strong className="mono">{lastTrace ? formatValue(lastTrace.pcNext, 'hex') : '—'}</strong></div>
            <div><span>Last instruction</span><strong className="mono">{lastTrace ? instructionText(lastTrace.instruction) : '—'}</strong></div>
          </div></details>}
        </div>
        {message && <div className={`feedback ${isError ? 'incorrect' : 'correct'} study-status`} role="status">{message}</div>}
        <details className="study-disclosure">
          <summary>Edit program</summary>
          <div className="study-disclosure-body">
            <p>Only <code>add</code>, <code>addi</code>, <code>beq</code> and x0–x7 are accepted.</p>
            <label className="field study-notes-label" htmlFor="factorial-source">Assembly source</label>
            <textarea id="factorial-source" className="study-textarea study-code-area mono" value={source} onChange={(event) => { setSource(event.target.value); setSourceDirty(true); setIsAuthoredExample(false); }} rows={12} spellCheck={false} />
            <div className="study-actions study-program-actions">
              <button className="button button-primary" onClick={() => {
                try {
                  setProgram(makeAssemblyProgram(source));
                  setSourceDirty(false);
                  setAssistedPredictionKey(null);
                  setScoredPredictionKey(null);
                  setIsError(false);
                  setMessage('Program assembled. Current PC and registers are preserved.');
                }
                catch (error) { setIsError(true); setMessage(error instanceof Error ? error.message : String(error)); }
              }}>Assemble edits</button>
              <label className="button button-secondary study-file-button">Import .S or hex
                <input type="file" accept=".s,.S,.txt,.hex,text/plain" onChange={(event) => { void importFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
              </label>
            </div>
          </div>
        </details>
      </section>
      <details className="panel study-prediction-panel study-disclosure">
        <summary>Predict future state</summary>
        <div className="study-disclosure-body">
          <label className="field study-select-wrap">Instructions ahead
            <select className="study-select" value={predictionSteps} onChange={(event) => { setPredictionSteps(Number(event.target.value)); setPredictionResult(null); }}>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <form className="study-prediction-controls" onSubmit={(event) => { event.preventDefault(); checkPrediction(); }}>
            <NumberAnswer label="Predicted t2" value={predictionInput} onChange={setPredictionInput}
              expected={expectedPrediction ?? 0} disabled={sourceDirty || expectedPrediction === null || lesson.status === 2} />
            <button className="button button-primary" type="submit" disabled={sourceDirty || expectedPrediction === null || lesson.status === 2}>Check</button>
          </form>
          <details className="study-source-details">
            <summary>Reveal answer</summary>
            <button className="button button-secondary" onClick={predictValue} disabled={sourceDirty || expectedPrediction === null}>Show value and trace</button>
          </details>
          {predictionResult && <div className="study-prediction-detail">
            <span>t2 = <strong className="mono">{predictionResult.expected}</strong></span>
            <span>PC after edges = <strong className="mono">{formatValue(predictionResult.after, 'hex')}</strong></span>
            <div className="study-prediction-history-wrap">
              <ol className="study-prediction-history" aria-label="State changes at each predicted rising edge">
                {predictionResult.history.map((step, index) => (
                  <li key={`${step.pc}-${index}`}>
                    <dl>
                      <div><dt>Rising edge</dt><dd>{index + 1}</dd></div>
                      <div><dt>PC</dt><dd className="mono">{formatValue(step.pc, 'hex')}</dd></div>
                      <div><dt>Instruction</dt><dd className="mono">{step.instruction}</dd></div>
                      <div><dt>Register write</dt><dd>{step.write}</dd></div>
                      <div><dt>t2 after edge</dt><dd className="mono">{step.t2}</dd></div>
                    </dl>
                  </li>
                ))}
              </ol>
              <p className="study-prediction-explanation">t2 changes only when a rising edge writes x7. Writes to other registers leave it unchanged; the self-branching stop loop writes no register and holds the architectural state.</p>
            </div>
          </div>}
        </div>
      </details>
    </div>
  );
}

export function StudyLab(props: StudyLabProps) {
  const lesson = useLesson(props.topic);
  if (props.topic === 'clock') return <ClockMode onAttempt={props.onAttempt} lesson={lesson} />;
  if (props.topic === 'oral') return <OralMode onAttempt={props.onAttempt} lesson={lesson} />;
  return <FactorialMode onAttempt={props.onAttempt} lesson={lesson} />;
}
