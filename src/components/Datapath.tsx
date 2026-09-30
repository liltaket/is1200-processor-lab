import { formatValue } from '../engine';
import type { CycleTrace } from '../engine';

export const COMPONENT_INFO: Record<string, { title: string; kind: string; text: string }> = {
  pc: { title: 'Program counter', kind: 'Sequential · 8 bits', text: 'PC stores the current byte address. The PC mux computes PCnext during the cycle; PC captures it only at the rising edge. Lab addresses wrap at 256.' },
  rom: { title: 'Instruction ROM', kind: 'Combinational · 32-bit words', text: 'The ROM receives PC >> 2. A byte address of 12 selects word 3, because each instruction contains four bytes.' },
  decoder: { title: 'Instruction fields', kind: 'Combinational · bit selection', text: 'The instruction contains opcode, register fields and function bits. rs1 supplies A1, rs2 supplies A2, and rd supplies A3 where applicable. Lab ports use the low three bits of each register address.' },
  control: { title: 'Control unit', kind: 'Combinational · generated signals', text: 'The decoder interprets opcode and function fields to generate RegWrite, ALUSrc, Branch and ALUControl. Encoded funct3 is not an ALUControl signal.' },
  'register-file': { title: 'Register file', kind: 'Combinational reads · clocked writes', text: 'A1/A2 select register addresses. RD1/RD2 are the selected data values, available before ticking. WE3 enables the WD3 write to A3 at the rising edge. x0 always reads zero and ignores writes.' },
  immediate: { title: 'Immediate path', kind: 'Combinational · sign extension', text: 'addi has a signed I-type immediate. beq reconstructs the scattered B-type bits, including an implicit low zero. Branch displacements are bytes relative to the current PC.' },
  mux: { title: 'ALUSrc mux', kind: 'Combinational · operand selection', text: 'ALUSrc=0 selects RD2. ALUSrc=1 selects the immediate. The mux selects the ALU operand, while ALUControl selects the operation.' },
  alu: { title: 'Arithmetic logic unit', kind: 'Combinational · 32-bit data', text: 'The ALU applies the generated operation to A and B. add/addi use ADD; beq uses SUB. Zero is one when the arithmetic result is zero.' },
  branch: { title: 'Branch decision', kind: 'Combinational · Branch AND Zero', text: 'Branch identifies a beq instruction. Only Branch AND Zero means the branch is taken. The target is current PC plus signed byte displacement, not PC+4 plus displacement.' },
  'pc-mux': { title: 'PC mux', kind: 'Combinational · next-state selection', text: 'The mux selects the branch target when Branch AND Zero is one, otherwise PC+4. This output is the pending PCnext; it does not update PC by itself.' },
};

interface DatapathProps { trace: CycleTrace; revealed: Set<string>; base?: 'decimal' | 'hex' | 'binary'; onSelect?: (id: string) => void; }
export function Datapath({ trace, revealed, base = 'decimal', onSelect }: DatapathProps) {
  const known = (key: string) => revealed.has(key);
  const value = (key: string, n: number, short = false) => {
    if ((['rs2-address', 'read-rs2'].includes(key) && trace.control.aluSrc === 1) || (key === 'immediate' && trace.instruction.imm === undefined) || (key === 'branch-target' && !trace.control.branch)) return 'unused';
    if (!known(key)) return '?';
    if (short) return String(n);
    if (base === 'binary') return `0b…${(n >>> 0).toString(2).padStart(32, '0').slice(-8)}`;
    if (base === 'hex') return `0x${(n >>> 0).toString(16)}`;
    return formatValue(n, base);
  };
  const active = (key: string, used = true) => !used ? 'wire inactive-wire' : known(key) ? 'wire is-revealed' : 'wire';
  const control = (key: string, used = true) => !used ? 'wire control-wire inactive-wire' : known(key) ? 'wire control-wire is-revealed' : 'wire control-wire';
  const click = (id: string) => ({ role: 'button' as const, tabIndex: 0, onClick: () => onSelect?.(id), onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(id); } }, 'aria-label': `Explore ${COMPONENT_INFO[id]?.title ?? id}` });
  const tag = (x: number, y: number, title: string, text: string, cls = '') => <g className={`wire-tag ${cls}`} transform={`translate(${x} ${y})`}><text className="wire-label" y={-10}>{title}</text><text className="wire-value" y={8}>{text}</text></g>;
  return <><p className="diagram-pan-note">↔ Scroll the diagram sideways to follow the whole datapath. Keyboard: focus the diagram, then use arrow keys.</p><div className="diagram-scroll" tabIndex={0} role="region" aria-label="Datapath diagram, scroll sideways to explore"><svg className="datapath-svg" viewBox="0 0 1000 510" aria-labelledby="datapath-title datapath-description">
    <title id="datapath-title">Interactive Lab 4 single-cycle datapath</title><desc id="datapath-description">PC selects an instruction ROM word through shift right by two. Fields select registers and controls. Register data or immediate feeds the ALU. Branch AND Zero selects PCnext; PC and register writes occur at the rising clock edge. Click components for explanations. A signal table follows the diagram.</desc>
    <defs><marker id="data-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke" /></marker></defs>
    <path d="M105 255H175" className={active('rom-address')} markerEnd="url(#data-arrow)" />
    <path d="M285 255H310" className={active('format')} markerEnd="url(#data-arrow)" />
    <path d="M345 235H402" className={active('rs1-address')} markerEnd="url(#data-arrow)" />
    <path d="M345 265H402" className={active('rs2-address', trace.control.aluSrc === 0)} markerEnd="url(#data-arrow)" />
    <path d="M345 295H402" className={active('rd-address', trace.control.regWrite === 1)} markerEnd="url(#data-arrow)" />
    <path d="M328 215V163H418" className={active('format')} markerEnd="url(#data-arrow)" />
    <path d="M328 325V440H436" className={active('immediate', trace.instruction.imm !== undefined)} markerEnd="url(#data-arrow)" />
    <path d="M531 235H738" className={active('read-rs1')} markerEnd="url(#data-arrow)" />
    <path d="M531 288H645" className={active('read-rs2', trace.control.aluSrc === 0)} markerEnd="url(#data-arrow)" />
    <path d="M550 440H614V322H645" className={active('immediate', trace.control.aluSrc === 1)} markerEnd="url(#data-arrow)" />
    <path d="M680 305H738" className={active('alusrc')} markerEnd="url(#data-arrow)" />
    <path d="M826 270H921V387H485V350" className={active('alu-result', trace.control.regWrite === 1)} markerEnd="url(#data-arrow)" />
    <path d="M60 215V94H204" className={active('pc-plus-four')} markerEnd="url(#data-arrow)" />
    <path d="M60 94V35H580V67" className={active('branch-target', trace.control.branch === 1)} markerEnd="url(#data-arrow)" />
    <path d="M495 421V404H586V120" className={active('branch-target', trace.control.branch === 1)} markerEnd="url(#data-arrow)" />
    <path d="M267 94H834" className={active('pc-plus-four', !trace.branchTaken)} markerEnd="url(#data-arrow)" />
    <path d="M643 93H815V119H834" className={active('branch-target', trace.branchTaken)} markerEnd="url(#data-arrow)" />
    <path d="M870 106H967V482H36V298H46" className={active('next-pc')} markerEnd="url(#data-arrow)" />
    <path d="M828 235H896V181" className={control('zero-flag', trace.control.branch === 1)} markerEnd="url(#data-arrow)" />
    <path d="M540 163H865" className={control('branch-enable')} markerEnd="url(#data-arrow)" />
    <path d="M907 163H938V145H856V132" className={control('branch-decision', trace.control.branch === 1)} markerEnd="url(#data-arrow)" />
    <path d="M458 188V210" className={control('regwrite')} markerEnd="url(#data-arrow)" />
    <path d="M509 188V204H661V269" className={control('alusrc-control')} markerEnd="url(#data-arrow)" />
    <path d="M540 177H778V220" className={control('alu-function')} markerEnd="url(#data-arrow)" />
    <g className="diagram-node state-node" {...click('pc')}><rect x="46" y="215" width="59" height="85" rx="7"/><text x="75" y="242">PC</text><text className="node-value" x="75" y="265">{trace.pc}</text><text className="port-note" x="75" y="288">△ CLK</text></g>
    <g className="diagram-node" {...click('rom')}><rect x="175" y="215" width="110" height="108" rx="7"/><text x="230" y="244">Instruction</text><text x="230" y="263">ROM</text><text className="node-note" x="230" y="294">32-bit words</text></g>
    <g className="diagram-node narrow-node" {...click('decoder')}><rect x="310" y="215" width="35" height="110" rx="5"/><text transform="translate(331 270) rotate(-90)">Fields</text></g>
    <g className="diagram-node state-node" {...click('register-file')}><rect x="402" y="215" width="129" height="135" rx="7"/><text x="467" y="275">Register file</text><text className="node-note" x="467" y="297">x0–x7 · 32 bits</text><text className="port-note" x="417" y="239">A1</text><text className="port-note" x="417" y="269">A2</text><text className="port-note" x="417" y="300">A3</text><text className="port-note" x="513" y="239">RD1</text><text className="port-note" x="513" y="291">RD2</text><text className="port-note" x="461" y="338">△ CLK · WD3</text></g>
    <g className="diagram-node control-node" {...click('control')}><rect x="418" y="135" width="122" height="53" rx="7"/><text x="479" y="158">Control unit</text><text className="node-note" x="479" y="177">opcode → signals</text></g>
    <g className="diagram-node" {...click('immediate')}><rect x="436" y="421" width="114" height="41" rx="7"/><text x="493" y="447">Immediate</text></g>
    <g className="diagram-node" {...click('mux')}><path d="M645 269L680 280V330L645 342Z"/><text className="port-note" x="653" y="293">0</text><text className="port-note" x="653" y="326">1</text><text transform="translate(671 307) rotate(-90)" className="port-note">MUX</text></g>
    <g className="diagram-node" {...click('alu')}><path d="M738 220L828 240V312L738 332V292L753 277L738 260Z"/><text x="788" y="271">ALU</text><text className="node-value" x="788" y="294">{known('alu-function') ? trace.control.aluControl : '?'}</text></g>
    <g className="diagram-node" {...click('pc')}><path d="M204 69H243L267 94L243 119H204Z"/><text x="231" y="99">+ 4</text></g>
    <g className="diagram-node" {...click('branch')}><path d="M567 67H616L643 93L616 120H567Z"/><text x="601" y="97">+</text></g>
    <g className="diagram-node control-node" {...click('branch')}><path d="M865 146H884Q909 146 909 163Q909 181 884 181H865Z"/><text x="886" y="168">&amp;</text></g>
    <g className="diagram-node" {...click('pc-mux')}><path d="M834 69L870 82V119L834 133Z"/><text className="port-note" x="843" y="92">0</text><text className="port-note" x="843" y="122">1</text></g>
    {tag(143, 245, 'PC >> 2', value('rom-address', trace.romAddress, true))}
    {tag(374, 222, 'A1 · 3 bits', value('rs1-address', trace.instruction.a1, true))}
    {tag(374, 268, 'A2 · 3 bits', value('rs2-address', trace.instruction.a2, true))}
    {tag(374, 312, 'A3 · 3 bits', trace.writeRegister === null ? 'unused' : known('rd-address') ? String(trace.writeRegister) : '?')}
    {tag(586, 223, 'RD1 · A', value('read-rs1', trace.rd1))}
    {tag(586, 279, 'RD2', value('read-rs2', trace.rd2))}
    {tag(590, 448, 'Imm', value('immediate', trace.immediate))}
    {tag(712, 321, 'B', value('alusrc', trace.aluB))}
    {tag(733, 381, trace.control.regWrite ? 'Y → WD3' : 'Y · writeback unused', value('alu-result', trace.aluResult))}
    {tag(429, 199, 'RegWrite → WE3', value('regwrite', trace.control.regWrite, true), 'control-tag')}
    {tag(647, 203, 'ALUSrc', value('alusrc-control', trace.control.aluSrc, true), 'control-tag')}
    {tag(776, 199, 'ALUControl', known('alu-function') ? trace.control.aluControl : '?', 'control-tag')}
    {tag(714, 147, 'Branch', value('branch-enable', trace.control.branch, true), 'control-tag')}
    {tag(914, 228, 'Zero', value('zero-flag', trace.zero, true), 'control-tag')}
    {tag(941, 155, 'PCSrc', known('branch-decision') ? String(Number(trace.branchTaken)) : '?', 'control-tag')}
    {tag(714, 79, 'PC + 4', value('pc-plus-four', trace.pcPlus4, true))}
    {tag(734, 112, 'Target', value('branch-target', trace.branchTarget, true))}
    {tag(837, 467, 'PCnext · at rising edge', value('next-pc', trace.pcNext, true))}
    <text className="diagram-caption" x="58" y="363">STATE</text><text className="diagram-caption" x="193" y="347">FETCH</text><text className="diagram-caption" x="445" y="375">READ / WRITE</text><text className="diagram-caption" x="749" y="352">EXECUTE</text>
  </svg></div></>;
}
