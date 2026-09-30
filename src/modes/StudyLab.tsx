import { useMemo, useState } from 'react';
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
import type { CpuState, CycleTrace, ProgramLine, Topic } from '../engine';
import './study.css';

export interface StudyLabProps extends ModeProps {
  topic: 'clock' | 'oral' | 'factorial';
}

const MAX_RUN_CYCLES = 512;

type PredictionStep = {
  pc: number;
  instruction: string;
  write: string;
  t2: number;
};
type Prediction = { expected: number; after: number; trace: CycleTrace | null; history: PredictionStep[] };

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

function ClockMode({ onAttempt }: Pick<ModeProps, 'onAttempt'>) {
  const [eventIndex, setEventIndex] = useState(() => Math.floor(Math.random() * CLOCK_EVENTS.length));
  const [selected, setSelected] = useState<'combinational' | 'edge' | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const event = CLOCK_EVENTS[eventIndex];
  const correct = selected === event.answer;

  function nextEvent() {
    let next = eventIndex;
    while (CLOCK_EVENTS.length > 1 && next === eventIndex) next = Math.floor(Math.random() * CLOCK_EVENTS.length);
    setEventIndex(next);
    setSelected(null);
    setSubmitted(false);
  }

  function submit() {
    if (!selected || submitted) return;
    setSubmitted(true);
    onAttempt('clock', correct);
  }

  return (
    <div className="study-stack">
      <section className="panel study-panel">
        <div className="study-kicker">Clocking · event {eventIndex + 1} of {CLOCK_EVENTS.length}</div>
        <h2 className="section-title">When does this happen?</h2>
        <p className="study-prompt">{event.event}</p>
        <div className="study-choice-row" role="group" aria-label="Choose when the event happens">
          <button className={`button button-secondary study-choice ${selected === 'combinational' ? 'is-selected' : ''}`} disabled={submitted} onClick={() => setSelected('combinational')}>
            Immediate propagation
          </button>
          <button className={`button button-secondary study-choice ${selected === 'edge' ? 'is-selected' : ''}`} disabled={submitted} onClick={() => setSelected('edge')}>
            Rising clock edge
          </button>
        </div>
        <div className="study-timeline" aria-label="Combinational signals settle during the cycle; state updates at the rising edge">
          <div className={`study-timeline-phase ${selected === 'combinational' ? 'is-focused' : ''}`}>
            <span className="study-timeline-dot" />
            <strong>During the cycle</strong>
            <span>Addresses, control signals, mux outputs and ALU values propagate.</span>
          </div>
          <div className="study-timeline-wire" />
          <div className={`study-timeline-phase study-timeline-state ${selected === 'edge' ? 'is-focused' : ''}`}>
            <span className="study-edge-mark">↑</span>
            <strong>At the rising edge</strong>
            <span>PC and enabled register state capture their next values.</span>
          </div>
        </div>
        {submitted && (
          <div className={`feedback ${correct ? 'correct' : 'incorrect'}`} role="status">
            <strong>{correct ? 'Correct.' : `The event is ${event.answer === 'edge' ? 'at the rising edge' : 'combinational'}.`}</strong>
            <p>{event.explanation}</p>
          </div>
        )}
        <div className="study-actions">
          {!submitted ? <button className="button button-primary" disabled={!selected} onClick={submit}>Check timing</button>
            : <button className="button button-primary" onClick={nextEvent}>Next event</button>}
        </div>
      </section>
      <p className="muted study-note"><span className="study-inline-chip">WE3</span> enables a pending write; its assertion alone does not change register contents.</p>
    </div>
  );
}

function OralMode({ onAttempt }: Pick<StudyLabProps, 'onAttempt'>) {
  const [scope, setScope] = useState<'lab' | 'lecture'>('lab');
  const [topicFilter, setTopicFilter] = useState<Topic | 'all'>('all');
  const [questionId, setQuestionId] = useState('');
  const [notes, setNotes] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState(false);
  const pool = useMemo(() => ORAL_QUESTIONS.filter((question) => question.scope === scope
    && (topicFilter === 'all' || question.topic === topicFilter)), [scope, topicFilter]);
  const question = pool.find(({ id }) => id === questionId) ?? pool[0];

  function chooseNext() {
    if (pool.length < 1) return;
    const choices = pool.filter(({ id }) => id !== question?.id);
    const next = (choices.length ? choices : pool)[Math.floor(Math.random() * (choices.length || pool.length))];
    setQuestionId(next.id);
    setNotes('');
    setRevealed(false);
    setGraded(false);
  }

  function switchFilter(change: () => void) {
    change();
    setQuestionId('');
    setNotes('');
    setRevealed(false);
    setGraded(false);
  }

  function selfGrade(understood: boolean) {
    if (!question || graded) return;
    setGraded(true);
    onAttempt(question.topic, understood);
  }

  return (
    <div className="study-stack">
      <section className="panel study-panel">
        <div className="study-toolbar">
          <label className="field study-select-wrap">Source scope
            <select className="study-select" value={scope} onChange={(event) => switchFilter(() => setScope(event.target.value as 'lab' | 'lecture'))}>
              <option value="lab">Lab 4</option><option value="lecture">Lecture 9 extension</option>
            </select>
          </label>
          <label className="field study-select-wrap">Topic
            <select className="study-select" value={topicFilter} onChange={(event) => switchFilter(() => setTopicFilter(event.target.value as Topic | 'all'))}>
              <option value="all">All topics</option>
              {Array.from(new Set(ORAL_QUESTIONS.filter((item) => item.scope === scope).map((item) => item.topic))).map((item) => (
                <option value={item} key={item}>{item[0].toUpperCase() + item.slice(1)}</option>
              ))}
            </select>
          </label>
          <button className="button button-secondary study-new" onClick={chooseNext} disabled={pool.length < 2}>New question</button>
        </div>
        {question ? <>
          <div className="study-kicker">{scope === 'lab' ? 'Lab 4 oral practice' : 'Lecture 9 extension'} · {pool.length} prompts</div>
          <h2 className="section-title">Explain it in your own words</h2>
          <p className="study-prompt">{question.prompt}</p>
          <label className="field study-notes-label" htmlFor="oral-notes">Your notes <span className="muted">(optional; reviewed by you)</span></label>
          <textarea id="oral-notes" className="study-textarea" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Try explaining the reasoning before you reveal the guide…" rows={4} />
          {revealed && (
            <div className="study-answer-card">
              <div className="study-answer-heading">Expected concepts</div>
              <div className="study-concepts">{question.concepts.map((concept) => <span className="chip" key={concept}>{concept}</span>)}</div>
              <p>{question.answer}</p>
              <small>Source: {question.source}</small>
            </div>
          )}
          {!revealed ? <button className="button button-primary" onClick={() => setRevealed(true)}>Reveal answer guide</button>
            : <div className="study-grade-row">
              <span className="muted">Self-grade your explanation</span>
              <button className="button button-secondary" onClick={() => selfGrade(false)} disabled={graded}>Needs review</button>
              <button className="button button-primary" onClick={() => selfGrade(true)} disabled={graded}>Understood</button>
              {graded && <span className="study-saved-mark">Progress recorded</span>}
            </div>}
        </> : <p className="muted">No questions are tagged for this selection.</p>}
      </section>
      <p className="muted study-note">Your notes stay in this page session. The answer guide supports your self-assessment; no automatic text grader is used.</p>
    </div>
  );
}

function FactorialMode({ onAttempt }: Pick<ModeProps, 'onAttempt'>) {
  const [inputN, setInputN] = useState(0);
  const [source, setSource] = useState(() => factorialSource(0));
  const [program, setProgram] = useState<ProgramLine[]>(() => makeAssemblyProgram(factorialSource(0)));
  const [state, setState] = useState<CpuState>(() => initialProgram(0).state);
  const [message, setMessage] = useState('Authored demonstration loaded. Step through it or predict the next result.');
  const [isError, setIsError] = useState(false);
  const [lastTrace, setLastTrace] = useState<CycleTrace | null>(null);
  const [changed, setChanged] = useState<number[]>([]);
  const [predictionSteps, setPredictionSteps] = useState(1);
  const [predictionInput, setPredictionInput] = useState('');
  const [predictionResult, setPredictionResult] = useState<Prediction | null>(null);
  const [halted, setHalted] = useState(false);
  const [sourceDirty, setSourceDirty] = useState(false);
  const [assistedPredictionKey, setAssistedPredictionKey] = useState<string | null>(null);
  const [scoredPredictionKey, setScoredPredictionKey] = useState<string | null>(null);
  const currentLine = program.find(({ address }) => address === state.pc);
  const currentRomIndex = state.pc >>> 2;
  const predictionKey = `${state.cycles}:${state.pc}:${predictionSteps}:${program.map(({ address, word }) => `${address}-${word}`).join(',')}`;

  function commitLoaded(nextSource: string, nextProgram: ProgramLine[], detail: string) {
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
    setAssistedPredictionKey(null);
    setScoredPredictionKey(null);
    setIsError(false);
    setMessage(detail);
  }

  function loadExample(nextN = inputN) {
    try {
      const nextSource = factorialSource(nextN);
      const nextProgram = makeAssemblyProgram(nextSource);
      setInputN(nextN);
      commitLoaded(nextSource, nextProgram, `Authored demonstration loaded for n=${nextN}. This is an example program, not a course-provided canonical listing.`);
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
      commitLoaded(visibleSource, nextProgram, `${file.name} loaded and validated in Lab 4 mode.`);
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
      if (!alreadyScored) {
        if (!assisted) onAttempt('factorial', correct);
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
          <label className="field study-select-wrap">Demonstration input n
            <select className="study-select" value={inputN} onChange={(event) => loadExample(Number(event.target.value))}>
              {Array.from({ length: 9 }, (_, value) => <option value={value} key={value}>{value}! demonstration{[0, 3, 8].includes(value) ? ' · lab test input' : ''}</option>)}
            </select>
          </label>
          <label className="button button-secondary study-file-button">Import .S or hex .txt
            <input type="file" accept=".s,.S,.txt,.hex,text/plain" onChange={(event) => { void importFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          </label>
          <button className="button button-secondary" onClick={reset}>Reset processor</button>
        </div>
        <div className="study-authored-note"><strong>Authored demonstration:</strong> the sample uses repeated addition and supports n=0–8, including the required 0!, 3!, and 8! tests. Edit or import your own program to study your solution. The workbench pauses at a stop loop; the real processor would keep executing that self-branch.</div>
        <div className="study-factorial-layout">
          <div className="study-program-column">
            <label className="field study-notes-label" htmlFor="factorial-source">Lab 4 assembly · `add`, `addi`, `beq` · x0–x7</label>
            <textarea id="factorial-source" className="study-textarea study-code-area mono" value={source} onChange={(event) => { setSource(event.target.value); setSourceDirty(true); }} rows={16} spellCheck={false} />
            <div className="study-actions study-program-actions">
              <button className="button button-secondary" onClick={() => {
                try {
                  setProgram(makeAssemblyProgram(source));
                  setSourceDirty(false);
                  setAssistedPredictionKey(null);
                  setScoredPredictionKey(null);
                  setIsError(false);
                  setMessage('Edited source assembled. Current registers and PC were preserved.');
                }
                catch (error) { setIsError(true); setMessage(error instanceof Error ? error.message : String(error)); }
              }}>Assemble edits</button>
              <button className="button button-primary" onClick={stepOnce} disabled={halted || !currentLine || sourceDirty}>Tick one instruction</button>
              <button className="button button-secondary" onClick={runToStop} disabled={halted || !currentLine || sourceDirty}>Run to stop loop</button>
            </div>
          </div>
          <div className="study-cpu-column">
            <div className="study-cpu-heading">
              <div><div className="study-kicker">Lab 4 processor</div><h2 className="section-title">Current state</h2></div>
              <span className={`chip ${halted ? 'study-stop-chip' : ''}`}>{halted ? 'Stop loop' : `${state.cycles} cycles`}</span>
            </div>
            <div className="study-cpu-readouts">
              <div><span>PC (byte address)</span><strong className="mono">{formatValue(state.pc, 'hex')}</strong></div>
              <div><span>ROM word</span><strong className="mono">{currentRomIndex}</strong></div>
              <div><span>t2</span><strong className="mono">{toSigned(state.registers[7])}</strong></div>
            </div>
            <div className="study-instruction-card">
              <span>Instruction at current PC</span>
              {currentLine ? <><strong className="mono">{currentLine.source}</strong><small className="mono">{formatValue(currentLine.word, 'hex')}</small></>
                : <strong className="study-outside-program">No instruction at this address</strong>}
            </div>
            <div className="register-grid study-register-grid">
              {REGISTER_NAMES.map((name, index) => (
                <div className={`study-register ${changed.includes(index) ? 'is-changed' : ''}`} key={name}>
                  <span>{name}</span><strong className="mono">{toSigned(state.registers[index])}</strong>
                  {changed.includes(index) && <small>changed</small>}
                </div>
              ))}
            </div>
            <div className="study-last-trace">
              <div><span>Last branch</span><strong>{lastOutcome}</strong></div>
              <div><span>PC next</span><strong className="mono">{lastTrace ? formatValue(lastTrace.pcNext, 'hex') : '—'}</strong></div>
              <div><span>Last instruction</span><strong className="mono">{lastTrace ? instructionText(lastTrace.instruction) : '—'}</strong></div>
            </div>
          </div>
        </div>
        <div className={`feedback ${isError ? 'incorrect' : 'correct'} study-status`} role="status">{message}</div>
      </section>
      <section className="panel study-panel study-prediction-panel">
        <div><div className="study-kicker">Before the next edge</div><h2 className="section-title">Predict t2 after the next instructions</h2></div>
        <div className="study-prediction-controls">
          <label className="field study-select-wrap">Instructions to simulate
            <select className="study-select" value={predictionSteps} onChange={(event) => { setPredictionSteps(Number(event.target.value)); setPredictionResult(null); }}>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <label className="field study-prediction-value">Your predicted t2
            <input className="study-input mono" value={predictionInput} onChange={(event) => setPredictionInput(event.target.value)} inputMode="numeric" placeholder="e.g. 0" />
          </label>
          <button className="button button-primary" onClick={checkPrediction} disabled={sourceDirty}>Check prediction</button>
          <button className="button button-secondary" onClick={predictValue} disabled={sourceDirty}>Show expected value</button>
        </div>
        {predictionResult && <div className="study-prediction-detail">
          <span>Engine prediction <strong className="mono">t2 = {predictionResult.expected}</strong></span>
          <span>After these edges PC would be <strong className="mono">{formatValue(predictionResult.after, 'hex')}</strong></span>
          <span className="muted">Prediction did not update the visible CPU state.</span>
          <div className="study-prediction-history-wrap">
            <table className="study-prediction-history">
              <caption>Predicted instruction-by-instruction state after each rising edge</caption>
              <thead><tr><th scope="col">Edge</th><th scope="col">PC</th><th scope="col">Instruction</th><th scope="col">Register write</th><th scope="col">t2 after edge</th></tr></thead>
              <tbody>{predictionResult.history.map((step, index) => (
                <tr key={`${step.pc}-${index}`}>
                  <th scope="row">{index + 1}</th>
                  <td className="mono">{formatValue(step.pc, 'hex')}</td>
                  <td className="mono">{step.instruction}</td>
                  <td>{step.write}</td>
                  <td className="mono">{step.t2}</td>
                </tr>
              ))}</tbody>
            </table>
            <p className="study-prediction-explanation">t2 changes only when a rising edge writes x7. Writes to other registers leave it unchanged; the self-branching stop loop writes no register and holds the architectural state.</p>
          </div>
        </div>}
      </section>
    </div>
  );
}

export function StudyLab(props: StudyLabProps) {
  if (props.topic === 'clock') return <ClockMode onAttempt={props.onAttempt} />;
  if (props.topic === 'oral') return <OralMode onAttempt={props.onAttempt} />;
  return <FactorialMode onAttempt={props.onAttempt} />;
}
