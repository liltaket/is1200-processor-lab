import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Binary, ChevronDown, CircuitBoard, Cpu, GitBranch, Layers3, ListChecks, MemoryStick, MessageSquare, Monitor, Play, Radio, RotateCcw } from 'lucide-react';
import type { Topic } from './engine';
import { TOPICS, createProgress, loadProgress, recordAttempt, saveProgress } from './learning';
import { LESSON_COUNTS, lessonStats, useCourse } from './course';
import { ManualCpu } from './modes/ManualCpu';
import { ComponentLab } from './modes/ComponentLab';
import { InstructionLab } from './modes/InstructionLab';
import { BranchLab } from './modes/BranchLab';
import { StudyLab } from './modes/StudyLab';
import { Welcome } from './components/Welcome';
import './course.css';

const icons = { datapath: Cpu, formats: Layers3, control: Radio, registers: MemoryStick, alu: CircuitBoard, branch: GitBranch, clock: RotateCcw, encoding: Binary, rom: Monitor, factorial: Play, oral: MessageSquare };
type Route = Topic | 'welcome' | 'progress';
type Experience = 'Practice' | 'Guided lesson';
function currentRoute(): Route {
  const value = location.hash.replace(/^#\/?/, '').split('/').pop();
  return value === 'progress' ? 'progress' : TOPICS.find(topic => topic.id === value)?.id ?? 'welcome';
}

export default function App() {
  const [route, setRoute] = useState<Route>(currentRoute);
  const [experience, setExperience] = useState<Experience>('Practice');
  const [progress, setProgress] = useState(loadProgress);
  const [saved, setSaved] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const course = useCourse();
  const nextButton = useRef<HTMLButtonElement>(null);
  const focusExercise = useRef(false);
  const topic = route === 'welcome' || route === 'progress' ? 'datapath' : route;
  const cursor = course.progress[topic].cursor;
  const status = course.progress[topic].results[cursor] ?? 0;
  const finished = cursor >= LESSON_COUNTS[topic];
  const stats = lessonStats(course.progress, topic);
  const total = TOPICS.reduce((sum, item) => sum + LESSON_COUNTS[item.id], 0);
  const solved = TOPICS.reduce((sum, item) => sum + lessonStats(course.progress, item.id).solved, 0);
  useEffect(() => {
    const listen = () => { focusExercise.current = true; document.querySelector<HTMLDetailsElement>('.topic-menu')?.removeAttribute('open'); window.scrollTo({ top: 0 }); setRoute(currentRoute()); setConfirmReset(false); setResetMessage(''); };
    window.addEventListener('hashchange', listen);
    return () => window.removeEventListener('hashchange', listen);
  }, []);
  useEffect(() => { setSaved(saveProgress(progress)); }, [progress]);
  useEffect(() => {
    if (status && route !== 'welcome' && route !== 'progress') nextButton.current?.focus({ preventScroll: true });
  }, [status, route]);
  useEffect(() => {
    if (focusExercise.current) { document.getElementById('main-content')?.focus(); focusExercise.current = false; }
  }, [cursor, route, course.epoch]);
  const onAttempt = (topic: Topic, correct: boolean) => setProgress(previous => recordAttempt(previous, topic, correct));
  const props = { onAttempt, progress, guided: experience === 'Guided lesson' };
  if (route === 'welcome') return <Welcome />;
  const details = TOPICS.find(item => item.id === topic)!;
  function navigate(event: React.MouseEvent<HTMLAnchorElement>) {
    focusExercise.current = true;
    let ancestor: HTMLElement | null = event.currentTarget.parentElement;
    while (ancestor) { if (ancestor instanceof HTMLDetailsElement) ancestor.open = false; ancestor = ancestor.parentElement; }
  }
  const topicLinks = TOPICS.map(item => {
    const Icon = icons[item.id];
    return <a key={item.id} href={`#/${item.id}`} onClick={navigate} className={`nav-item ${item.id === route ? 'active' : ''}`} aria-current={item.id === route ? 'page' : undefined}><Icon size={19} /><span>{item.label}</span></a>;
  });
  const progressLink = <a href="#/progress" onClick={navigate} className={`sidebar-action ${route === 'progress' ? 'active' : ''}`} aria-current={route === 'progress' ? 'page' : undefined}><ListChecks size={19} />Progress <span className="nav-count">{solved}/{total}</span></a>;
  function nextExercise() { focusExercise.current = true; course.goTo(topic, cursor + 1); window.scrollTo({ top: 0 }); }
  function focusReset() { requestAnimationFrame(() => document.getElementById('reset-progress')?.focus()); }
  function resetAll() { course.reset(); setProgress(createProgress()); setConfirmReset(false); setResetMessage('All saved progress has been reset.'); focusReset(); }
  let content;
  switch (topic) {
    case 'datapath': content = <ManualCpu {...props} />; break;
    case 'alu': case 'registers': case 'control': content = <ComponentLab topic={topic} {...props} />; break;
    case 'formats': case 'encoding': content = <InstructionLab topic={topic} {...props} />; break;
    case 'branch': case 'rom': content = <BranchLab topic={topic} {...props} />; break;
    case 'clock': case 'factorial': case 'oral': content = <StudyLab topic={topic} {...props} />; break;
  }
  const nextTopic = TOPICS[(TOPICS.findIndex(item => item.id === topic) + 1) % TOPICS.length];
  return <div className="app-shell cleaned-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); const main = document.getElementById('main-content'); main?.focus(); main?.scrollIntoView(); }}>Skip to practice</a>
    <aside className="sidebar" aria-label="Learning navigation">
      <a className="brand" href="#/welcome"><Cpu size={23} /><span>Processor Lab</span></a>
      <nav className="desktop-topics" aria-label="Learning topics">{topicLinks}</nav>
      <details className="topic-menu" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); event.stopPropagation(); } }}>
        <summary>Topics <ChevronDown size={18} /></summary>
        <nav aria-label="Mobile learning topics">{topicLinks}</nav>{progressLink}
      </details>
      <div className="sidebar-utilities">{progressLink}</div>
    </aside>
    <div className="workspace">
      <main id="main-content" tabIndex={-1}>
        <header className="page-heading"><h1 className="breadcrumb">{route === 'progress' ? 'Your progress' : details.label}</h1>
          {route !== 'progress' && !finished && (topic === 'formats' || topic === 'encoding') && <div className="experience-tabs" aria-label="Learning experience">{(['Practice', 'Guided lesson'] as Experience[]).map(item => <button key={item} className={experience === item ? 'selected' : ''} onClick={() => setExperience(item)} aria-pressed={experience === item}>{item}</button>)}</div>}
        </header>
        {(!saved || !course.saved) && <p className="storage-warning" role="status">Progress cannot be saved on this device. You can keep practicing in this session.</p>}
        {route === 'progress' ? <section className="course-overview" aria-label="Saved exercises">
          <div className="course-total"><strong>{solved} <span>of {total} solved</span></strong><progress aria-label="Solved exercises" max={total} value={solved} /></div>
          <p className="progress-key">Solved = correct prediction or self-rated understanding. Reviewed = completed with help or marked for review. Saved in a cookie on this device.</p>
          <div className="course-topics">{TOPICS.map(item => { const stat = lessonStats(course.progress, item.id); return <details className="course-topic" key={item.id}><summary><span>{item.label}</span><span>{stat.solved}/{stat.total} solved{stat.reviewed ? ` · ${stat.reviewed} reviewed` : ''}<ChevronDown size={16} /></span></summary><div className="exercise-grid">{course.progress[item.id].results.map((result, index) => <a className={`exercise-link result-${result}`} key={index} href={`#/${item.id}`} onClick={event => { course.goTo(item.id, index); navigate(event); }} aria-label={`${item.label}, exercise ${index + 1}: ${result === 2 ? 'solved' : result === 1 ? 'reviewed' : 'not started'}`}><span>{index + 1}</span><span>{result === 2 ? 'Solved' : result === 1 ? 'Reviewed' : 'Not started'}</span></a>)}</div></details>; })}</div>
          <div className="course-reset">{confirmReset ? <><p>Reset all saved progress? This clears solved exercises and prediction history.</p><div className="toolbar"><button autoFocus className="button button-secondary" onClick={() => { setConfirmReset(false); focusReset(); }}>Cancel</button><button className="button reset-confirm" onClick={resetAll}>Reset all progress</button></div></> : <button id="reset-progress" className="button button-secondary" onClick={() => { setConfirmReset(true); setResetMessage(''); }}><RotateCcw size={17} />Reset progress</button>}<p role="status">{resetMessage}</p></div>
        </section> : finished ? <section className="series-finished panel"><h2>Series complete</h2><p>{stats.solved} of {stats.total} solved{stats.reviewed ? ` · ${stats.reviewed} reviewed with help` : ''}.</p><div className="toolbar"><button className="button button-secondary" onClick={() => { focusExercise.current = true; const index = course.progress[topic].results.findIndex(result => result !== 2); course.goTo(topic, index < 0 ? 0 : index); }}>Review series</button><a className="button button-primary" href={`#/${nextTopic.id}`} onClick={navigate}>Next topic <ArrowRight size={17} /></a><a className="button button-secondary" href="#/progress" onClick={navigate}>View progress</a></div></section> : <>
          <div className={`lesson-position ${status ? 'is-ready' : ''}`}><span>Exercise {cursor + 1} of {stats.total}{status > 0 && <strong>{status === 2 ? 'Solved' : 'Reviewed with help'}</strong>}</span>{status > 0 ? <button ref={nextButton} className="button button-primary" onClick={nextExercise}>{cursor + 1 === stats.total ? 'Finish series' : 'Next exercise'}<ArrowRight size={18} /></button> : <a href="#/progress" onClick={navigate}>{stats.solved}/{stats.total} solved <ArrowRight size={15} /></a>}</div>
          <div className="mode-content" key={`${topic}:${cursor}:${course.epoch}`}>{content}</div>
        </>}
      </main>
    </div>
  </div>;
}
