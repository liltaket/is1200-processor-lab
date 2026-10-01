import { useRef, useState } from 'react';
import { formatValue, parseValue, toSigned, toUnsigned } from '../engine';

export interface NumberAnswerProps {
  label: string; value: string; onChange: (value: string) => void;
  expected: number; alternatives?: number[]; disabled?: boolean;
}
export function NumberAnswer({ label, value, onChange, expected, alternatives = [], disabled = false }: NumberAnswerProps) {
  const [typed, setTyped] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  let selected = value;
  try { if (value.trim()) selected = String(toSigned(parseValue(value))); } catch { /* The typed input retains incomplete values. */ }
  const options = [...new Set([expected, ...alternatives, expected + 1, expected - 1, expected + 4, expected - 4, 0].map(toUnsigned))].slice(0, 7);
  // Shuffle deterministic choices without always placing the expected answer first.
  let seed = toUnsigned(expected) ^ Array.from(label).reduce((hash, c) => Math.imul(hash, 31) + c.charCodeAt(0), 29);
  for (let i = options.length - 1; i > 0; i--) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const j = seed % (i + 1); [options[i], options[j]] = [options[j], options[i]]; }
  return <div className="number-answer">
    <label className="field"><span>{label}</span><select aria-label={label} value={typed ? 'typed' : selected} disabled={disabled} onChange={event => { const next = event.target.value; setTyped(next === 'typed'); onChange(next === 'typed' ? '' : next); if (next === 'typed') requestAnimationFrame(() => inputRef.current?.focus()); }}>
      <option value="">Choose a value</option>
      {options.map(option => <option key={option} value={String(toSigned(option))}>{formatValue(option, 'decimal')}</option>)}
      <option value="typed">Type a value…</option>
    </select></label>
    {typed && <label className="field"><span>{label} (typed)</span><input ref={inputRef} aria-label={`${label} (typed)`} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} inputMode="text" placeholder="Decimal, 0x… or 0b…" autoComplete="off" /></label>}
  </div>;
}
