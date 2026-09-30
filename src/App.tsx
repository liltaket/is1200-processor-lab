import { useEffect, useState } from 'react';
import { ArrowRight, Binary, ChevronDown, CircuitBoard, Cpu, GitBranch, Layers3, MemoryStick, MessageSquare, Monitor, Play, Radio, RotateCcw, Shuffle } from 'lucide-react';
import type { Topic } from './engine';
import { TOPICS, loadProgress, mastery, recordAttempt, saveProgress, weakestTopic } from './learning';
import { ManualCpu } from './modes/ManualCpu';
import { ComponentLab } from './modes/ComponentLab';
import { InstructionLab } from './modes/InstructionLab';
import { BranchLab } from './modes/BranchLab';
import { StudyLab } from './modes/StudyLab';
import { Welcome } from './components/Welcome';

const icons = { datapath: Cpu, formats: Layers3, control: Radio, registers: MemoryStick, alu: CircuitBoard, branch: GitBranch, clock: RotateCcw, encoding: Binary, rom: Monitor, factorial: Play, oral: MessageSquare };
type Route = Topic | 'welcome';
type Experience = 'Practice' | 'Guided lesson';
function currentRoute(): Route {
  const value = location.hash.replace(/^#\/?/, '').split('/').pop();
  return TOPICS.find(topic => topic.id === value)?.id ?? 'welcome';
}

export default function App() {
  const [route, setRoute] = useState<Route>(currentRoute);
  const [experience, setExperience] = useState<Experience>('Practice');
  const [progress, setProgress] = useState(loadProgress);
  const [saved, setSaved] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  useEffect(() => {
    const listen = () => setRoute(currentRoute());
    window.addEventListener('hashchange', listen);
    return () => window.removeEventListener('hashchange', listen);
  }, []);
  useEffect(() => { setSaved(saveProgress(progress)); }, [progress]);
  const onAttempt = (topic: Topic, correct: boolean) => setProgress(previous => recordAttempt(previous, topic, correct));
  const props = { onAttempt, progress, guided: experience === 'Guided lesson' };
  if (route === 'welcome') return <Welcome />;
  const topic = route;
  const details = TOPICS.find(item => item.id === topic)!;
  function selectReview() {
    setReviewing(true);
    setExperience('Practice');
    location.hash = `/${weakestTopic(progress)}`;
  }
  function navigate(event: React.MouseEvent<HTMLAnchorElement>) {
    setReviewing(false);
    let ancestor: HTMLElement | null = event.currentTarget.parentElement;
    while (ancestor) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = false;
      ancestor = ancestor.parentElement;
    }
  }
  const topicLinks = TOPICS.map(item => {
    const Icon = icons[item.id];
    return <a key={item.id} href={`#/${item.id}`} onClick={navigate} className={`nav-item ${item.id === topic ? 'active' : ''}`} aria-current={item.id === topic ? 'page' : undefined}><Icon size={19} /><span>{item.label}</span></a>;
  });
  const progressDetails = <details className="progress-disclosure">
    <summary>Progress <ChevronDown size={16} /></summary>
    <p>Accuracy from your checked predictions.</p>
    <ul className="topic-progress">{TOPICS.map(item => {
      const stat = progress.topics[item.id];
      return <li key={item.id}><a href={`#/${item.id}`} onClick={navigate}>{item.label}</a><span>{stat ? `${mastery(progress, item.id)}% · ${stat.attempts} attempts` : 'Not practiced'}</span></li>;
    })}</ul>
  </details>;
  let content;
  switch (topic) {
    case 'datapath': content = <ManualCpu {...props} />; break;
    case 'alu': case 'registers': case 'control': content = <ComponentLab key={topic} topic={topic} {...props} />; break;
    case 'formats': case 'encoding': content = <InstructionLab key={topic} topic={topic} {...props} />; break;
    case 'branch': case 'rom': content = <BranchLab key={topic} topic={topic} {...props} />; break;
    case 'clock': case 'factorial': case 'oral': content = <StudyLab key={topic} topic={topic} {...props} />; break;
  }
  return <div className="app-shell cleaned-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); const main = document.getElementById('main-content'); main?.focus(); main?.scrollIntoView(); }}>Skip to practice</a>
    <aside className="sidebar" aria-label="Learning navigation">
      <a className="brand" href="#/welcome"><Cpu size={23} /><span>Processor Lab</span></a>
      <nav className="desktop-topics" aria-label="Learning topics">{topicLinks}</nav>
      <details className="topic-menu">
        <summary>Topics <ChevronDown size={18} /></summary>
        <nav aria-label="Mobile learning topics">{topicLinks}</nav>
        <button className="sidebar-action" onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); selectReview(); }}><Shuffle size={18} />Mixed review</button>
        {progressDetails}
      </details>
      <div className="sidebar-utilities">
        <button className={`sidebar-action ${reviewing ? 'active' : ''}`} onClick={selectReview}><Shuffle size={18} />Mixed review</button>
        {progressDetails}
      </div>
    </aside>
    <div className="workspace">
      <main id="main-content" tabIndex={-1}>
        <header className="page-heading">
          <h1 className="breadcrumb">{details.label}</h1>
          {(topic === 'formats' || topic === 'encoding') && <div className="experience-tabs" aria-label="Learning experience">{(['Practice', 'Guided lesson'] as Experience[]).map(item => <button key={item} className={experience === item ? 'selected' : ''} onClick={() => setExperience(item)} aria-pressed={experience === item}>{item}</button>)}</div>}
        </header>
        {!saved && <p className="storage-warning" role="status">Progress cannot be saved on this device. You can keep practicing in this session.</p>}
        {reviewing && <div className="review-note"><span>Reviewing a topic that needs practice.</span><button className="text-button" onClick={selectReview}>Next topic <ArrowRight size={16} /></button><button className="text-button" onClick={() => setReviewing(false)}>End review</button></div>}
        <div className="mode-content">{content}</div>
      </main>
    </div>
  </div>;
}
