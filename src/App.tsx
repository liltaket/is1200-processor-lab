import { useEffect, useState } from 'react';
import { ArrowRight, Binary, BookOpen, ChevronRight, CircuitBoard, Cpu, GitBranch, Layers3, MemoryStick, MessageSquare, Monitor, Play, Radio, RotateCcw } from 'lucide-react';
import type { Topic } from './engine';
import { TOPICS, loadProgress, mastery, recordAttempt, saveProgress, weakestTopic } from './learning';
import { ManualCpu } from './modes/ManualCpu';
import { ComponentLab } from './modes/ComponentLab';
import { InstructionLab } from './modes/InstructionLab';
import { BranchLab } from './modes/BranchLab';
import { StudyLab } from './modes/StudyLab';

const icons = { datapath: Cpu, formats: Layers3, control: Radio, registers: MemoryStick, alu: CircuitBoard, branch: GitBranch, clock: RotateCcw, encoding: Binary, rom: Monitor, factorial: Play, oral: MessageSquare };
type Experience = 'Guided lesson' | 'Practice' | 'Mixed review' | 'Oral exam';
function hashTopic(): Topic { const value = location.hash.replace(/^#\/?/, '').split('/').pop(); return TOPICS.find(t => t.id === value)?.id ?? 'datapath'; }

export default function App() {
  const [topic, setTopic] = useState<Topic>(hashTopic);
  const [experience, setExperience] = useState<Experience>('Guided lesson');
  const [progress, setProgress] = useState(loadProgress);
  const [saved, setSaved] = useState(true);
  useEffect(() => { const listen = () => setTopic(hashTopic()); window.addEventListener('hashchange', listen); return () => window.removeEventListener('hashchange', listen); }, []);
  useEffect(() => { setSaved(saveProgress(progress)); }, [progress]);
  const onAttempt = (selected: Topic, correct: boolean) => setProgress(p => recordAttempt(p, selected, correct));
  const props = { onAttempt, progress, guided: experience === 'Guided lesson' };
  const details = TOPICS.find(t => t.id === topic)!;
  const attempts = Object.values(progress.topics).reduce((total, item) => total + (item?.attempts ?? 0), 0);
  function selectExperience(next: Experience) {
    setExperience(next);
    if (next === 'Oral exam') location.hash = '/oral';
    if (next === 'Mixed review') location.hash = `/${weakestTopic(progress)}`;
  }
  let content;
  switch (topic) {
    case 'datapath': content = <ManualCpu {...props} />; break;
    case 'alu': case 'registers': case 'control': content = <ComponentLab key={topic} topic={topic} {...props} />; break;
    case 'formats': case 'encoding': content = <InstructionLab key={topic} topic={topic} {...props} />; break;
    case 'branch': case 'rom': content = <BranchLab key={topic} topic={topic} {...props} />; break;
    case 'clock': case 'factorial': case 'oral': content = <StudyLab key={topic} topic={topic} {...props} />; break;
  }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); const main = document.getElementById('main-content'); main?.focus(); main?.scrollIntoView(); }}>Skip to practice</a>
    <aside className="sidebar" aria-label="Learning topics">
      <a className="brand" href="#/datapath"><span className="brand-mark"><Cpu size={23} /></span><span>Processor Lab<small>KTH · IS1200</small></span></a>
      <div className="course-label">Your workbench <span>Lab 4</span></div>
      <p className="mobile-nav-hint">Scroll for all 11 topics <span aria-hidden="true">→</span></p>
      <nav>{TOPICS.map(item => { const Icon = icons[item.id]; const stat = progress.topics[item.id]; return <a key={item.id} href={`#/${item.id}`} className={`nav-item ${item.id === topic ? 'active' : ''}`} aria-current={item.id === topic ? 'page' : undefined}><Icon size={18} /><span>{item.label}</span>{stat && stat.attempts > 0 ? <span className="nav-dot" title={`${mastery(progress, item.id)}% correct`} /> : null}</a>; })}</nav>
      <div className="sidebar-footer"><BookOpen size={17} /><p>Built around your course.<span>Lab 4 · Lecture 9 · RISC-V sheet</span></p></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb">Workbench <ChevronRight size={14} /><span>{details.label}</span></div><div className="save-status"><span className={saved ? 'status-dot' : 'status-dot failed'} />{saved ? 'Progress saved on this device' : 'Storage unavailable · session only'}</div></header>
      <main id="main-content" tabIndex={-1}>
        <div className="page-heading"><div><h1>{topic === 'datapath' ? 'Be the processor.' : details.label}</h1><p>{details.description}</p></div><div className="scope-tag"><span>Lab 4 processor</span><strong>add · addi · beq</strong></div></div>
        <div className="experience-bar"><div className="experience-tabs" aria-label="Learning experience">{(['Guided lesson', 'Practice', 'Mixed review', 'Oral exam'] as Experience[]).map(item => <button key={item} className={experience === item ? 'selected' : ''} onClick={() => selectExperience(item)} aria-pressed={experience === item}>{item}</button>)}</div><span className="session-summary">{attempts} attempt{attempts === 1 ? '' : 's'} <span>·</span> {progress.streak} correct in a row</span></div>
        <details className="progress-disclosure"><summary>Review your practice progress <ChevronRight size={13} /></summary><p>Accuracy estimates reflect your attempts on this device. Revealed answers count as assisted practice; these estimates are not an exam grade.</p><table><thead><tr><th>Topic</th><th>Attempts</th><th>Correct</th><th>Accuracy estimate</th></tr></thead><tbody>{TOPICS.map(item => { const stat = progress.topics[item.id]; return <tr key={item.id}><th><a href={`#/${item.id}`}>{item.label}</a></th><td>{stat?.attempts ?? 0}</td><td>{stat?.correct ?? 0}</td><td>{stat ? `${mastery(progress, item.id)}%` : 'Not practiced'}</td></tr>; })}</tbody></table></details>
        {experience === 'Mixed review' && <div className="review-note"><span>Mixed review prioritizes topics with less practice or lower accuracy.</span><button className="text-button" onClick={() => { const next = weakestTopic(progress); location.hash = `/${next}`; }}>Next review topic <ArrowRight size={14} /></button></div>}
        {props.guided && topic !== 'datapath' && <div className="guided-topic-note"><strong>Guided lesson.</strong> {details.description} Make a prediction first, then read the component’s reasoning before trying new values.</div>}
        <div className="mode-content">{content}</div>
        <footer className="workspace-footer"><span>Understand the path. Then tick the clock.</span><span>8 registers · 32-bit data · 8-bit PC</span></footer>
      </main>
    </div>
  </div>;
}
