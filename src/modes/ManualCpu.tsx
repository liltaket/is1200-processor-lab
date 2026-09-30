import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Clock3, Eye, RefreshCw } from 'lucide-react';
import { ALU_FUNCTIONS, REGISTER_NAMES, commitCycle, createState, encode, formatValue, generateScenario, instructionText, parseValue, traceCycle, traceSteps } from '../engine';
import type { CpuState, ExerciseStep, Scenario } from '../engine';
import type { ModeProps } from '../ui-types';
import { COMPONENT_INFO, Datapath } from '../components/Datapath';
import './manual.css';

type Base = 'decimal' | 'hex' | 'binary';
function firstScenario(): Scenario { const state = createState(); state.pc = 12; state.registers = [0, 2, 8, 3, 12, 4, 4, 1]; const instruction = { name: 'beq' as const, rs1: 5, rs2: 6, imm: -8 }; return { state, instruction, word: encode(instruction) }; }
function nextScenario(name: 'add' | 'addi' | 'beq'): Scenario { return generateScenario(name); }
const addressSteps = new Set(['rs1-address', 'rs2-address', 'rd-address']);
const numericSteps = new Set(['rom-address', 'read-rs1', 'read-rs2', 'immediate', 'alusrc-control', 'alusrc', 'alu-result', 'pc-plus-four', 'branch-target', 'next-pc']);
function choicesFor(step: ExerciseStep): string[] | undefined {
  if (step.choices) return step.choices;
  if (step.id === 'instruction') return ['add', 'addi', 'beq'];
  if (step.id === 'format') return ['R', 'I', 'B'];
  if (['regwrite', 'zero-flag', 'branch-enable', 'branch-decision'].includes(step.id)) return ['Yes', 'No'];
  if (step.id === 'alu-function') return ALU_FUNCTIONS.map(item => item.name);
  if (step.id === 'clock-boundary') return ['No; stored state waits for the rising edge.', 'Yes; the ALU result immediately updates PC.'];
  if (step.id === 'write-result') return [step.answer, 'A3 changes immediately when WD3 changes.', 'All registers receive the ALU result.'];
  return undefined;
}
export function matchesTraceAnswer(step: ExerciseStep, entered: string): boolean {
  const answer = entered.trim().toLowerCase();
  if (!answer) return false;
  if (step.id === 'instruction') return answer === step.answer.split(' ')[0].toLowerCase() || answer === step.answer.toLowerCase();
  if (addressSteps.has(step.id)) { const register = /\(x(\d+)\)/.exec(step.answer)?.[1]; return register ? [register, `x${register}`, REGISTER_NAMES[Number(register)]].includes(answer) : answer === step.answer.toLowerCase(); }
  if (numericSteps.has(step.id)) { try { return parseValue(entered) === parseValue(step.answer.split(' ')[0]); } catch { return false; } }
  if (['regwrite', 'zero-flag', 'branch-enable', 'branch-decision'].includes(step.id)) { const yes = step.answer.startsWith('Yes'); return (yes ? ['yes', '1', 'true', 'yes (1)'] : ['no', '0', 'false', 'no (0)']).includes(answer); }
  if (step.id === 'alu-function') { const operation = ALU_FUNCTIONS.find(item => item.name === step.answer || item.code === step.answer); return answer === step.answer.toLowerCase() || answer === operation?.code || answer === operation?.name.toLowerCase(); }
  return answer === step.answer.toLowerCase();
}
function phaseFor(step?: ExerciseStep): number { if (!step || step.component === 'clock') return 2; return ['instruction', 'rom-address', 'format', 'rs1-address', 'rs2-address', 'rd-address'].includes(step.id) ? 0 : 1; }

export function ManualCpu({ onAttempt }: ModeProps) {
  const [scenario, setScenario] = useState<Scenario>(firstScenario);
  const [name, setName] = useState<'add' | 'addi' | 'beq'>('beq');
  const [base, setBase] = useState<Base>('decimal');
  const trace = useMemo(() => traceCycle(scenario.state, scenario.word), [scenario]);
  const steps = useMemo(() => traceSteps(scenario), [scenario]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [attempted, setAttempted] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | 'assisted' | null>(null);
  const [next, setNext] = useState<CpuState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const answerForm = useRef<HTMLFormElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const focusRequested = useRef(false);
  const step = steps[index];
  const done = index >= steps.length;
  const resolved = feedback === 'correct' || feedback === 'assisted';
  const activePhase = next ? 2 : phaseFor(step);
  const choices = step ? choicesFor(step) : undefined;
  const info = selected ? COMPONENT_INFO[selected] : undefined;
  useEffect(() => { if (focusRequested.current) { answerForm.current?.querySelector<HTMLElement>('input, .choice')?.focus(); focusRequested.current = false; } }, [index]);
  useEffect(() => { if (resolved) continueButton.current?.focus(); }, [resolved]);
  function reset(nextName = name) { setScenario(nextScenario(nextName)); setIndex(0); setInput(''); setRevealed(new Set()); setAttempted(new Set()); setFeedback(null); setNext(null); setSelected(null); }
  function record(correct: boolean) { if (!attempted.has(step.id)) { onAttempt('datapath', correct); setAttempted(previous => new Set(previous).add(step.id)); } }
  function check() {
    if (!step || resolved) return;
    const correct = matchesTraceAnswer(step, input);
    record(correct); setFeedback(correct ? 'correct' : 'incorrect');
    if (correct) setRevealed(previous => new Set(previous).add(step.id));
  }
  function reveal() { if (!step || resolved) return; record(false); setFeedback('assisted'); setRevealed(previous => new Set(previous).add(step.id)); }
  function advance() { focusRequested.current = true; setIndex(value => value + 1); setInput(''); setFeedback(null); }
  const diagramRevealed = new Set(revealed);
  if (scenario.instruction.name !== 'beq' && revealed.has('branch-enable')) diagramRevealed.add('branch-decision');
  return <>
    <div className="trace-context"><div className="instruction-context"><code>{instructionText(scenario.instruction)}</code><span className="machine-word mono">{formatValue(scenario.word, 'hex')}</span></div><div className="context-pc"><span className="context-label">{next ? 'PC before edge' : 'Byte PC'}</span><code>0x{scenario.state.pc.toString(16).padStart(2, '0').toUpperCase()}</code></div><div className="toolbar trace-tools"><label className="compact-select">Instruction<select aria-label="Instruction scenario" value={name} onChange={event => { const value = event.target.value as typeof name; setName(value); reset(value); }}><option value="add">add</option><option value="addi">addi</option><option value="beq">beq</option></select><ChevronDown size={13} /></label><button className="button button-secondary" onClick={() => reset()}><RefreshCw size={14} />New values</button></div></div>
    <div className="manual-layout"><section className="schematic-panel panel" aria-label="Processor datapath"><div className="schematic-header"><h2>{next ? 'Trace before the edge' : 'Datapath'}</h2><div className="radix-tabs" aria-label="Data display format">{(['decimal', 'hex', 'binary'] as Base[]).map(item => <button key={item} aria-pressed={base === item} className={base === item ? 'selected' : ''} onClick={() => setBase(item)}>{item === 'decimal' ? 'Dec' : item === 'hex' ? 'Hex' : 'Bin'}</button>)}</div></div><div className="diagram-legend"><span><i className="legend-data" />Data · 32 bits</span><span><i className="legend-control" />Control</span><span><i className="legend-state" />Clocked state</span></div>{base === 'binary' && <p className="binary-note">Wire labels show the low byte. Expand signal values below for all 32 bits.</p>}<Datapath trace={trace} revealed={diagramRevealed} base={base} onSelect={id => setSelected(previous => previous === id ? null : id)} />{info && <div className="component-explanation"><div><strong>{info.title}</strong><span>{info.kind}</span></div><p>{info.text}</p><button className="text-button" onClick={() => setSelected(null)}>Close explanation</button></div>}<div className="state-boundary"><Clock3 size={15} /><span>{next ? 'Rising edge applied' : 'Before rising edge'}</span></div></section>
      <section className="answer-panel panel" aria-label="Manual trace exercise"><div className="step-counter"><span>{done ? 'Ready for the edge' : `Step ${index + 1} of ${steps.length}`}</span><span>{['Decode', 'Evaluate', 'Rising edge'][activePhase]}</span></div><div className="trace-progress" role="progressbar" aria-label="Trace completion" aria-valuenow={revealed.size} aria-valuemin={0} aria-valuemax={steps.length}><div style={{ width: `${revealed.size / steps.length * 100}%` }} /></div>
        {step ? <form ref={answerForm} onSubmit={event => { event.preventDefault(); if (resolved) advance(); else check(); }}><h2>{step.label}</h2>{choices ? <div className={`answer-choices ${choices.some(item => item.length > 24) ? 'long-choices' : ''}`}>{choices.map(choice => <button key={choice} type="button" className={`choice ${input === choice ? 'selected' : ''}`} aria-pressed={input === choice} disabled={resolved} onClick={() => { setInput(choice); setFeedback(null); }}>{choice}</button>)}</div> : <label className="field"><span>Your prediction</span><input aria-label="Your prediction" value={input} autoComplete="off" spellCheck={false} placeholder={addressSteps.has(step.id) ? 'e.g. t0 or x5' : 'Decimal, 0x… or 0b…'} onChange={event => { setInput(event.target.value); setFeedback(null); }} disabled={resolved} /></label>}
          {feedback && <div className={`feedback ${feedback === 'correct' ? 'correct' : feedback === 'incorrect' ? 'incorrect' : 'assisted'}`} aria-live="polite"><strong>{feedback === 'correct' ? 'Correct' : feedback === 'incorrect' ? 'Try again' : 'Answer revealed · practice'}</strong><p className="expected-answer">{step.answer}</p><p>{step.explanation}</p></div>}
          <button ref={continueButton} className="button button-primary check-button" disabled={!resolved && !input.trim()} type="submit">{resolved ? <>Continue <ArrowRight size={16} /></> : <>Check prediction <ArrowRight size={16} /></>}</button>{!resolved && <button type="button" className="reveal-button" onClick={reveal}><Eye size={15} />Show answer and reasoning</button>}</form> : <div className="edge-summary"><span className="edge-icon"><Clock3 size={28} /></span><h2>{next ? 'One cycle, completed.' : 'The next state is ready.'}</h2><p>{next ? 'The rising edge updated the stored state. Compare the register values below, then try another instruction.' : 'You have traced the combinational calculations. PC and registers still hold their original values.'}</p><div className="pending-pc"><span>PC</span><code>{scenario.state.pc}</code><ArrowRight size={16} /><code>{trace.pcNext}</code><span>{next ? 'committed' : 'pending'}</span></div>{next ? <button className="button button-primary" onClick={() => reset()}>Trace another instruction <RefreshCw size={15} /></button> : <button className="button button-primary" onClick={() => setNext(commitCycle(scenario.state, trace))}><Clock3 size={16} />Tick rising edge</button>}</div>}
      </section>
    <section className="register-state panel"><div className="register-heading"><h2>{next ? 'State after rising edge' : 'Current register state'}</h2></div><div className="register-grid">{REGISTER_NAMES.map((register, i) => { const value = (next ?? scenario.state).registers[i]; const changed = !!next && value !== scenario.state.registers[i]; return <div className={`register-cell ${changed ? 'changed' : ''}`} key={register}><div><span>{register}</span><small>x{i}</small></div><code title={formatValue(value, base)}>{formatValue(value, base)}</code>{changed && <small>was {formatValue(scenario.state.registers[i], base)}</small>}</div>; })}</div></section></div>
    <details className="signal-details"><summary>Signal values <ChevronDown size={14} /></summary><table className="signal-table"><thead><tr><th>Signal</th><th>Value</th><th>Component</th></tr></thead><tbody>{steps.filter(item => revealed.has(item.id)).map(item => <tr key={item.id}><th>{item.label}</th><td className="mono">{numericSteps.has(item.id) ? formatValue(parseValue(item.answer.split(' ')[0]), base) : item.answer}</td><td>{item.component}</td></tr>)}</tbody></table>{revealed.size === 0 && <p className="muted">Values appear here as you work through the trace.</p>}</details>
  </>;
}
