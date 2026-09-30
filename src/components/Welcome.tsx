import { ArrowRight, Cpu } from 'lucide-react';

export function Welcome() {
  return <main className="welcome-page">
    <a className="welcome-brand" href="#/welcome"><Cpu size={25} />Processor Lab</a>
    <div className="welcome-layout">
      <div className="welcome-content">
        <h1>Welcome to<br />the lab.</h1>
        <p>Trace an instruction, predict the signals, and tick the clock.</p>
        <a className="button button-primary welcome-open" href="#/datapath">Open lab <ArrowRight size={20} /></a>
      </div>
      <svg className="welcome-circuit" viewBox="0 0 490 370" role="img" aria-label="PC selects an instruction, registers feed the ALU, and its result returns to the register file.">
        <path className="welcome-data-path" d="M93 173H128M226 173H259M356 173H385M455 173H472V288H307V210" />
        <path className="welcome-control-path" d="M177 136V76H422V135M307 76V136" />
        <circle cx="307" cy="76" r="3" />
        <g className="welcome-state-node"><rect x="38" y="136" width="55" height="74" rx="8" /><text x="66" y="179">PC</text></g>
        <g className="welcome-normal-node"><rect x="128" y="136" width="98" height="74" rx="8" /><text x="177" y="179">Instruction</text></g>
        <g className="welcome-state-node"><rect x="259" y="136" width="97" height="74" rx="8" /><text x="307" y="179">Registers</text></g>
        <g className="welcome-alu-node"><path d="M385 126L455 143V202L385 219V189L399 173L385 158Z" /><text x="424" y="179">ALU</text></g>
      </svg>
    </div>
    <nav className="welcome-shortcuts" aria-label="Start with a component">
      <a href="#/formats">Instruction fields <ArrowRight size={17} /></a>
      <a href="#/alu">ALU <ArrowRight size={17} /></a>
      <a href="#/factorial">Programs <ArrowRight size={17} /></a>
    </nav>
  </main>;
}
