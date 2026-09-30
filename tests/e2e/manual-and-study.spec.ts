import { expect, test } from '@playwright/test';
import { createState, encode, generateScenario, toSigned, traceCycle, traceSteps } from '../../src/engine';

function firstBeqSteps() {
  const state = createState();
  state.pc = 12;
  state.registers = [0, 2, 8, 3, 12, 4, 4, 1];
  const instruction = { name: 'beq' as const, rs1: 5, rs2: 6, imm: -8 };
  return traceSteps({ state, instruction, word: encode(instruction) });
}

function responseFor(answer: string, id: string): string {
  if (id === 'instruction') return answer.split(' ')[0];
  if (id.endsWith('-address')) return answer.match(/\((x\d+)\)/)?.[1] ?? answer;
  if (id === 'alu-function') return answer;
  if (['regwrite', 'branch-enable', 'zero-flag', 'branch-decision'].includes(id)) return answer.startsWith('Yes') ? 'Yes' : 'No';
  if (id === 'clock-boundary') return answer;
  return answer.match(/^-?\d+/)?.[0] ?? answer;
}

test('manual beq keeps the branch target pending until the rising edge', async ({ page }) => {
  await page.goto('/#/datapath');
  const exercise = page.getByRole('region', { name: 'Manual trace exercise' });
  const steps = firstBeqSteps();

  for (const step of steps) {
    const response = responseFor(step.answer, step.id);
    const choice = exercise.getByRole('button', { name: response, exact: true });
    if (await choice.count()) {
      await choice.click();
    } else {
      await exercise.getByRole('textbox', { name: 'Your prediction' }).fill(response);
    }
    await exercise.getByRole('button', { name: 'Check prediction' }).click();
    await expect(exercise.getByText('Correct — follow that path.')).toBeVisible();
    await exercise.getByRole('button', { name: 'Continue' }).click();
  }

  await expect(exercise.getByText('The next state is ready.')).toBeVisible();
  await expect(exercise.getByText('pending', { exact: true })).toBeVisible();
  await expect(exercise.locator('.pending-pc')).toContainText('12');
  await expect(exercise.locator('.pending-pc')).toContainText('4');
  await expect(page.getByText('Combinational evaluation · stored state has not changed.')).toBeVisible();
  await exercise.getByRole('button', { name: 'Tick rising edge' }).click();
  await expect(page.getByText('Rising edge committed. PC and register state updated together.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Completed trace · before the edge' })).toBeVisible();
  await expect(page.locator('.context-pc')).toContainText('PC before edge');
  await expect(exercise.getByText('committed', { exact: true })).toBeVisible();
  await expect(page.locator('.register-cell').filter({ hasText: 't0' })).toContainText('4');
  await expect(page.locator('.register-cell').filter({ hasText: 't1' })).toContainText('4');
  await expect(page.locator('.register-cell').filter({ hasText: 'zero' })).toContainText('0');
});

test('clock timing choices freeze after grading', async ({ page }) => {
  await page.goto('/#/clock');
  await page.getByRole('button', { name: 'Rising clock edge' }).click();
  await page.getByRole('button', { name: 'Check timing' }).click();
  await expect(page.getByRole('button', { name: 'Rising clock edge' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Immediate propagation' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next event' })).toBeVisible();
});

test('oral guide can be revealed and self-graded once', async ({ page }) => {
  await page.goto('/#/oral');
  await page.getByLabel('Your notes').fill('PCnext is calculated combinationally and captured by PC at the rising edge.');
  await page.getByRole('button', { name: 'Reveal answer guide' }).click();
  await expect(page.getByText('Expected concepts')).toBeVisible();
  await expect(page.getByText(/Source:/)).toBeVisible();
  await page.getByRole('button', { name: 'Understood' }).click();
  await expect(page.getByText('Progress recorded')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Understood' })).toBeDisabled();
});

test('factorial examples 0, 3, and 8 run to a self-loop with the expected result', async ({ page }) => {
  await page.goto('/#/factorial');
  const input = page.getByLabel('Demonstration input n');
  for (const [n, expected] of [[0, 1], [3, 6], [8, 40320]]) {
    await input.selectOption(String(n));
    await page.getByRole('button', { name: 'Run to stop loop' }).click();
    await expect(page.getByText(new RegExp(`Stop loop reached.*t2 = ${expected}\\.`))).toBeVisible();
    await expect(page.locator('.study-cpu-readouts')).toContainText(String(expected));
    if (n !== 8) await page.getByRole('button', { name: 'Reset processor' }).click();
  }
});

test('factorial rejects invalid edited source without advancing CPU state', async ({ page }) => {
  await page.goto('/#/factorial');
  const source = page.getByLabel(/Lab 4 assembly/);
  await source.fill('addi t2, x0\n');
  await page.getByRole('button', { name: 'Assemble edits' }).click();
  await expect(page.getByText(/expects 3 operands/)).toBeVisible();
  await expect(page.locator('.study-cpu-heading')).toContainText('0 cycles');
  await expect(page.locator('.study-cpu-readouts')).toContainText('0x00000000');
});

test('hex import validates the words and runs to its self-branching stop loop', async ({ page }) => {
  await page.goto('/#/factorial');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'known.hex',
    mimeType: 'text/plain',
    buffer: Buffer.from('00300293\n00900393\n00000063\n'),
  });
  await expect(page.getByText('known.hex loaded and validated in Lab 4 mode.')).toBeVisible();
  await expect(page.locator('#factorial-source')).toContainText('addi t0, zero, 3');
  await expect(page.locator('#factorial-source')).toContainText('addi t2, zero, 9');
  await page.getByRole('button', { name: 'Run to stop loop' }).click();
  await expect(page.getByText(/Stop loop reached after 3 total clock cycles\. t2 = 9\./)).toBeVisible();
  await expect(page.locator('.study-cpu-readouts')).toContainText('9');
});

test('assisted factorial prediction is not counted as a correct attempt', async ({ page }) => {
  await page.goto('/#/factorial');
  await page.getByRole('button', { name: 'Show expected value' }).click();
  await page.getByRole('button', { name: 'Check prediction' }).click();
  await expect(page.getByText(/assisted or repeated check was not counted/)).toBeVisible();
  await expect(page.locator('.session-summary')).toContainText('0 attempts');
});

test('hash navigation selects the matching topic and unknown topics fall back safely', async ({ page }) => {
  await page.goto('/#/datapath');
  await page.locator('.sidebar nav').getByRole('link', { name: 'Branch' }).click();
  await expect(page.locator('.breadcrumb')).toContainText('Branch');
  await page.goto('/#/not-a-topic');
  await expect(page.locator('.breadcrumb')).toContainText('Datapath');
});

test('recorded progress persists after reload', async ({ page }) => {
  await page.goto('/#/clock');
  await page.getByRole('button', { name: 'Immediate propagation' }).click();
  await page.getByRole('button', { name: 'Check timing' }).click();
  await expect(page.locator('.session-summary')).toContainText('1 attempt');
  await expect(page.getByText('Progress saved on this device')).toBeVisible();
  await page.reload();
  await expect(page.locator('.session-summary')).toContainText('1 attempt');
});

test('application stays usable when local storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked'); } });
  });
  await page.goto('/#/datapath');
  await expect(page.getByRole('heading', { name: 'Be the processor.' })).toBeVisible();
  await expect(page.getByText('Storage unavailable · session only')).toBeVisible();
});

test('keyboard skip link focuses main without changing the topic hash', async ({ page }) => {
  await page.goto('/#/branch');
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to practice' });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  expect(await page.evaluate(() => location.hash)).toBe('#/branch');
});

test('SVG datapath component can be opened with Enter', async ({ page }) => {
  await page.goto('/#/datapath');
  const rom = page.getByRole('button', { name: 'Explore Instruction ROM' });
  await rom.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.component-explanation')).toContainText('Instruction ROM');
  await expect(page.locator('.component-explanation')).toContainText('A byte address of 12 selects word 3');
});

test('register reads change immediately and writes to x0 remain ignored', async ({ page }) => {
  await page.goto('/#/registers');
  await expect(page.locator('.trainer-read-ports')).toContainText('42');
  await page.getByLabel('A1 · read address 1').selectOption('6');
  await expect(page.locator('.trainer-read-ports')).toContainText('-19');
  await page.getByLabel('A3 · write address').selectOption('0');
  await page.getByLabel('WD3 · write data').fill('123');
  await expect(page.locator('.trainer-register-cell').filter({ hasText: 'zero x0' })).toContainText('0');
  await page.getByRole('button', { name: 'Rising edge' }).click();
  await expect(page.locator('.trainer-register-cell').filter({ hasText: 'zero x0' })).toContainText('0');
  await expect(page.getByText(/A3=x0 was ignored/)).toBeVisible();
});

test('ALU grades a signed overflow result as a wrapped 32-bit value', async ({ page }) => {
  await page.goto('/#/alu');
  await page.getByLabel('Predicted Y').fill('-2147483648');
  await page.getByLabel('Predicted Zero').selectOption('0');
  await page.getByRole('button', { name: 'Check outputs' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '-2147483648' })).toBeVisible();
});

test('control exercise distinguishes encoded fields from four generated signals', async ({ page }) => {
  await page.goto('/#/control');
  const mnemonic = (await page.locator('.trainer-sample-mnemonic').textContent())?.trim();
  const values = mnemonic === 'beq'
    ? { opcode: '0x00000063', regWrite: '0', aluSrc: '0', branch: '1', aluControl: '001' }
    : mnemonic === 'addi'
      ? { opcode: '0x00000013', regWrite: '1', aluSrc: '1', branch: '0', aluControl: '000' }
      : { opcode: '0x00000033', regWrite: '1', aluSrc: '0', branch: '0', aluControl: '000' };
  for (const [label, value] of Object.entries(values)) await page.getByLabel(label === 'opcode' ? 'Encoded opcode' : label === 'aluControl' ? 'ALUControl' : label === 'regWrite' ? 'RegWrite' : label === 'aluSrc' ? 'ALUSrc' : 'Branch').selectOption(value);
  await page.getByRole('button', { name: 'Check controls' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
  for (const name of ['RegWrite', 'ALUSrc', 'Branch', 'ALUControl']) {
    await expect(page.locator('.trainer-signal-table')).toContainText(name);
  }
});

test('format field placement grades the complete R-type bit layout', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/#/formats');
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await expect(page.locator('.trainer-instruction-sample code')).toContainText('add ');
  const slots = [
    ['31:25', 'funct7'], ['24:20', 'rs2'], ['19:15', 'rs1'],
    ['14:12', 'funct3'], ['11:7', 'rd'], ['6:0', 'opcode'],
  ];
  const strip = page.getByRole('group', { name: 'R-type instruction bit fields' });
  await expect(strip.getByRole('button').first()).toHaveAccessibleName('Bits 31:25; no field assigned');
  for (const [index, [range, field]] of slots.entries()) {
    await strip.getByRole('button').nth(index).click();
    await page.getByLabel(`Place a field in bits ${range}`).selectOption(field);
  }
  await page.getByRole('button', { name: 'Check field positions' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Decoded operands' })).toBeVisible();
});

test('completed but incorrect field placement can be checked and graded', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/#/formats');
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  const slots = [
    ['31:25', 'funct7'], ['24:20', 'rs2'], ['19:15', 'rs1'],
    ['14:12', 'funct3'], ['11:7', 'rd'], ['6:0', 'opcode'],
  ];
  const strip = page.getByRole('group', { name: 'R-type instruction bit fields' });
  for (const [index, [range]] of slots.entries()) {
    await strip.getByRole('button').nth(index).click();
    await page.getByLabel(`Place a field in bits ${range}`).selectOption(slots[(index + 1) % slots.length][1]);
  }
  const check = page.getByRole('button', { name: 'Check field positions' });
  await expect(check).toBeEnabled();
  await check.click();
  await expect(page.getByRole('status').filter({ hasText: 'Not quite' })).toBeVisible();
});

test('B-format assembly and scattered immediate bits are visible', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.99; });
  await page.goto('/#/formats');
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  const scenario = generateScenario('beq', () => 0.99);
  expect(scenario.instruction.name).toBe('beq');
  await expect(page.locator('.trainer-instruction-sample code')).toContainText('beq ');

  const slots = [
    ['31', 'imm[12]'], ['30:25', 'imm[10:5]'], ['24:20', 'rs2'],
    ['19:15', 'rs1'], ['14:12', 'funct3'], ['11:8', 'imm[4:1]'],
    ['7', 'imm[11]'], ['6:0', 'opcode'],
  ];
  const strip = page.getByRole('group', { name: 'B-type instruction bit fields' });
  for (const [index, [range, field]] of slots.entries()) {
    await strip.getByRole('button').nth(index).click();
    await page.getByLabel(`Place a field in bits ${range}`).selectOption(field);
  }
  await page.getByRole('button', { name: 'Check field positions' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();

  const fragments = [
    ['imm[12]', String((scenario.word >>> 31) & 1)],
    ['imm[10:5]', `0b${((scenario.word >>> 25) & 0x3f).toString(2).padStart(6, '0')}`],
    ['imm[4:1]', `0b${((scenario.word >>> 8) & 0xf).toString(2).padStart(4, '0')}`],
    ['imm[11]', String((scenario.word >>> 7) & 1)],
  ];
  for (const [field, value] of fragments) {
    const row = page.locator('.trainer-afterword .trainer-field-values > div').filter({ has: page.getByText(field, { exact: true }) });
    await expect(row).toContainText(value);
  }
});

test('encoding exercise grades all five stages through the shared encoder', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/#/encoding');
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  const scenario = generateScenario('add', () => 0);
  await page.getByLabel('Instruction format family').selectOption('R');
  await page.getByRole('button', { name: 'Check format' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Opcode' }).click();

  await page.getByLabel('Encoded opcode field').selectOption('0x00000033');
  await page.getByRole('button', { name: 'Check opcode' }).click();
  await page.getByRole('button', { name: 'Continue to Operands' }).click();

  for (const [index, value] of [scenario.instruction.rd!, scenario.instruction.rs1, scenario.instruction.rs2!].entries()) {
    await page.locator('.trainer-operand-grid select').nth(index).selectOption(String(value));
  }
  await page.getByRole('button', { name: 'Check operands' }).click();
  await page.getByRole('button', { name: 'Continue to Field placement' }).click();

  const encodingStrip = page.getByRole('group', { name: 'R-type instruction bit fields' });
  for (const [index, [range, field]] of [['31:25', 'funct7'], ['24:20', 'rs2'], ['19:15', 'rs1'], ['14:12', 'funct3'], ['11:7', 'rd'], ['6:0', 'opcode']].entries()) {
    await encodingStrip.getByRole('button').nth(index).click();
    await page.getByLabel(`Place a field in bits ${range}`).selectOption(field);
  }
  await page.getByRole('button', { name: 'Check field placement' }).click();
  await page.getByRole('button', { name: 'Continue to 32-bit word' }).click();

  await page.getByLabel('Complete 32-bit instruction · hexadecimal').fill(`0x${scenario.word.toString(16).padStart(8, '0')}`);
  await page.getByRole('button', { name: 'Check 32-bit word' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
  await expect(page.locator('.trainer-final-word')).toContainText(`0x${scenario.word.toString(16).padStart(8, '0')}`);
});

test('encoding field placement can submit a complete incorrect arrangement', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/#/encoding');
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  const scenario = generateScenario('add', () => 0);
  await page.getByLabel('Instruction format family').selectOption('R');
  await page.getByRole('button', { name: 'Check format' }).click();
  await page.getByRole('button', { name: 'Continue to Opcode' }).click();
  await page.getByLabel('Encoded opcode field').selectOption('0x00000033');
  await page.getByRole('button', { name: 'Check opcode' }).click();
  await page.getByRole('button', { name: 'Continue to Operands' }).click();
  for (const [index, value] of [scenario.instruction.rd!, scenario.instruction.rs1, scenario.instruction.rs2!].entries()) {
    await page.locator('.trainer-operand-grid select').nth(index).selectOption(String(value));
  }
  await page.getByRole('button', { name: 'Check operands' }).click();
  await page.getByRole('button', { name: 'Continue to Field placement' }).click();

  const fields = ['funct7', 'rs2', 'rs1', 'funct3', 'rd', 'opcode'];
  const ranges = ['31:25', '24:20', '19:15', '14:12', '11:7', '6:0'];
  const strip = page.getByRole('group', { name: 'R-type instruction bit fields' });
  const check = page.getByRole('button', { name: 'Check field placement' });
  await expect(check).toBeDisabled();
  for (const [index, range] of ranges.entries()) {
    await strip.getByRole('button').nth(index).click();
    await page.getByLabel(`Place a field in bits ${range}`).selectOption(fields[(index + 1) % fields.length]);
  }
  await expect(check).toBeEnabled();
  await check.click();
  await expect(page.getByRole('status').filter({ hasText: 'Not quite' })).toBeVisible();
});

test('branch prediction checks control, comparison, byte target, and selected next PC', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.goto('/#/branch');
  const scenario = generateScenario('beq', () => 0.5);
  const trace = traceCycle(scenario.state, scenario.word);
  await page.getByLabel('SUB result · ALU Y').fill(String(toSigned(trace.aluResult)));
  await page.getByLabel('ALU Zero').selectOption(String(trace.zero));
  await page.getByLabel('Branch control enabled?').selectOption('1');
  await page.getByLabel('Is the branch taken?').selectOption(trace.branchTaken ? 'yes' : 'no');
  await page.getByLabel('Branch target · byte address').fill(String(trace.branchTarget));
  await page.getByLabel('PC+4 · byte address').fill(String(trace.pcPlus4));
  await page.getByLabel('PCnext · byte address').fill(String(trace.pcNext));
  await page.getByRole('button', { name: 'Check branch' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
  await expect(page.locator('.trainer-branch-path')).toContainText(`PCnext = ${trace.pcNext}`);
});

test('ROM exercise converts a nonzero byte PC to its word index', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.goto('/#/rom');
  const scenario = generateScenario('add', () => 0.5);
  const trace = traceCycle(scenario.state, scenario.word);
  expect(trace.pc).toBeGreaterThan(0);
  expect(trace.romAddress).toBe(trace.pc / 4);
  await expect(page.locator('.trainer-rom-fetch')).toContainText(`0x${trace.pc.toString(16).padStart(2, '0').toUpperCase()}`);
  await page.getByLabel('Which ROM word index does this PC select?').fill(String(trace.romAddress));
  await page.getByRole('button', { name: 'Check ROM address' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
  await expect(page.locator('.trainer-rom-fetch')).toContainText(String(trace.romAddress));
});

test('all topic views fit without document overflow at 390px and 1024px', async ({ page }) => {
  const topics = [
    ['datapath', 'Datapath'], ['formats', 'Instruction formats'], ['control', 'Control unit'],
    ['registers', 'Register file'], ['alu', 'ALU'], ['branch', 'Branches'], ['clock', 'Clocking'],
    ['encoding', 'Assembly and encoding'], ['rom', 'PC and ROM'], ['factorial', 'Factorial'], ['oral', 'Oral exam'],
  ];
  for (const width of [390, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [topic, title] of topics) {
      await page.goto(`/#/${topic}`);
      await expect(page.locator('.breadcrumb')).toContainText(title);
      const documentWidth = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
      expect(documentWidth, `${topic} at ${width}px`).toBeLessThanOrEqual(width);
    }
  }
});
