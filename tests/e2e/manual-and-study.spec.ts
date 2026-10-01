import { expect, test } from '@playwright/test';
import { createState, encode, generateScenario, INSTRUCTIONS, parseValue, toSigned, toUnsigned, traceCycle, traceSteps } from '../../src/engine';
import type { Topic } from '../../src/engine';
import { COURSE_COOKIE, emptyCourse, lessonRandom, serializeCourse } from '../../src/course';
import { CLOCK_EVENTS } from '../../src/learning';

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

async function seedCourse(page: import('@playwright/test').Page, topic: Topic, cursor = 0, outcomes: Record<number, 1 | 2> = {}) {
  const progress = emptyCourse();
  progress[topic].cursor = cursor;
  for (const [index, outcome] of Object.entries(outcomes)) progress[topic].results[Number(index)] = outcome;
  const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4180';
  const base = new URL(baseURL.endsWith('/') ? baseURL : `${baseURL}/`);
  await page.context().addCookies([{ name: COURSE_COOKIE, value: encodeURIComponent(serializeCourse(progress)), domain: base.hostname, path: base.pathname, secure: base.protocol === 'https:', sameSite: 'Lax' }]);
}

async function chooseNumber(page: import('@playwright/test').Page | import('@playwright/test').Locator, label: string, value: number) {
  await page.getByLabel(label).selectOption(String(toSigned(value)));
}

function branchLessonTrace(index = 0) {
  const plans = [
    { equal: true, pc: 240, offset: 16 }, { equal: false, pc: 12, offset: -8 }, { equal: false, pc: 252, offset: 8 },
    { equal: true, pc: 16, offset: -8 }, { equal: false, pc: 8, offset: -16 }, { equal: true, pc: 236, offset: 20 },
    { equal: false, pc: 20, offset: 4 }, { equal: true, pc: 4, offset: -4 },
  ];
  const plan = plans[Math.min(index, plans.length - 1)];
  const state = createState('lab');
  state.pc = plan.pc;
  const rs1 = 1 + (index % 7);
  const rs2 = (rs1 % 7) + 1;
  const left = toUnsigned(Math.floor(lessonRandom('branch', index)() * 41) - 16);
  state.registers[rs1] = left;
  state.registers[rs2] = plan.equal ? left : toUnsigned(toSigned(left) + 1);
  const instruction = { name: 'beq' as const, rs1, rs2, imm: plan.offset };
  return traceCycle(state, encode(instruction));
}

function romLessonTrace(index = 1) {
  const pcs = [12, 4, 28, 64, 128, 192, 248, 252];
  const scenario = generateScenario('add', lessonRandom('rom', index));
  scenario.state.pc = pcs[Math.min(index, pcs.length - 1)];
  return traceCycle(scenario.state, scenario.word);
}

async function placeField(page: import('@playwright/test').Page, format: string, range: string, field: string) {
  const bank = page.getByRole('group', { name: 'Available instruction fields' });
  await bank.getByRole('button', { name: field, exact: true }).click();
  const strip = page.getByRole('group', { name: `${format}-type instruction bit fields` });
  await strip.locator(`[data-slot-range="${range}"]`).click();
}

async function dragField(page: import('@playwright/test').Page, format: string, field: string, range: string) {
  const chip = page.getByRole('group', { name: 'Available instruction fields' }).getByRole('button', { name: field, exact: true });
  const slot = page.getByRole('group', { name: `${format}-type instruction bit fields` }).locator(`[data-slot-range="${range}"]`);
  await chip.scrollIntoViewIfNeeded();
  await slot.scrollIntoViewIfNeeded();
  const from = await chip.boundingBox();
  const to = await slot.boundingBox();
  if (!from || !to) throw new Error('Field chip or target range is not visible.');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
}

test('manual beq keeps the branch target pending until the rising edge', async ({ page }) => {
  await page.goto('./#/datapath');
  const exercise = page.getByRole('region', { name: 'Manual trace exercise' });
  const steps = firstBeqSteps();

  for (const step of steps) {
    const response = responseFor(step.answer, step.id);
    const choice = exercise.getByRole('button', { name: response, exact: true });
    if (await choice.count()) await choice.click();
    else if (['rs1-address', 'rs2-address', 'rd-address'].includes(step.id)) {
      const register = step.answer.match(/\(x(\d+)\)/)?.[1];
      if (!register) throw new Error(`Missing register number in ${step.answer}`);
      await exercise.getByLabel('Your prediction').selectOption(`x${register}`);
    } else {
      await chooseNumber(exercise, 'Your prediction', parseValue(step.answer.split(' ')[0]));
    }
    await exercise.getByRole('button', { name: 'Check prediction' }).click();
    await expect(exercise.locator('.feedback.correct strong')).toHaveText('Correct');
    await exercise.getByRole('button', { name: 'Continue' }).click();
  }

  await expect(exercise.getByText('The next state is ready.')).toBeVisible();
  await expect(exercise.getByText('pending', { exact: true })).toBeVisible();
  await expect(exercise.locator('.pending-pc')).toContainText('12');
  await expect(exercise.locator('.pending-pc')).toContainText('4');
  await expect(page.locator('.state-boundary')).toContainText('Before rising edge');
  await expect(exercise.getByRole('button', { name: 'Tick rising edge' })).toBeFocused();
  await exercise.getByRole('button', { name: 'Tick rising edge' }).click();
  await expect(page.locator('.state-boundary')).toContainText('Rising edge applied');
  await expect(page.getByRole('heading', { name: 'One cycle, completed.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next exercise' })).toBeFocused();
  await expect(page.locator('.context-pc')).toContainText('PC before edge');
  await expect(page.locator('.state-boundary')).toContainText('Rising edge applied');
  await expect(page.locator('details.signal-details')).not.toHaveAttribute('open', '');
  await page.locator('details.signal-details summary').click();
  await expect(page.locator('.signal-table')).toContainText('branch');
  await expect(exercise.getByText('committed', { exact: true })).toBeVisible();
  await expect(page.locator('.register-cell').filter({ hasText: 't0' })).toContainText('4');
  await expect(page.locator('.register-cell').filter({ hasText: 't1' })).toContainText('4');
  await expect(page.locator('.register-cell').filter({ hasText: 'zero' })).toContainText('0');
  await page.getByRole('button', { name: 'Next exercise' }).click();
  await expect(page.locator('.lesson-position')).toContainText('Exercise 2 of 9');
  await expect(page.locator('.trace-context .instruction-context code')).not.toHaveText('beq t0, t1, -8');
});

test('clock timing choices freeze after grading', async ({ page }) => {
  await page.goto('./#/clock');
  await expect(page.locator('.study-prompt')).toContainText(CLOCK_EVENTS[0].event);
  await page.getByRole('button', { name: 'Immediate propagation' }).click();
  await page.getByRole('button', { name: 'Check timing' }).click();
  await expect(page.getByRole('status')).toContainText('Correct.');
  await expect(page.getByRole('button', { name: 'Rising clock edge' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Immediate propagation' })).toBeDisabled();
  await page.getByRole('button', { name: 'Next exercise' }).click();
  await expect(page.locator('.study-prompt')).toContainText(CLOCK_EVENTS[1].event);
});

test('oral guide can be revealed and self-graded once', async ({ page }) => {
  await page.goto('./#/oral');
  await page.getByLabel('Your answer').fill('PCnext is calculated combinationally and captured by PC at the rising edge.');
  await page.getByRole('button', { name: 'Reveal answer guide' }).click();
  await expect(page.getByText('Expected concepts and model answer')).toBeVisible();
  await expect(page.locator('details.study-source-details')).not.toHaveAttribute('open', '');
  await page.locator('details.study-source-details summary').click();
  await expect(page.locator('details.study-source-details')).toContainText('Source');
  await page.getByRole('button', { name: 'Understood' }).click();
  await expect(page.getByRole('button', { name: 'Understood' })).toBeDisabled();
  await page.getByRole('button', { name: 'Next exercise' }).click();
  await expect(page.locator('.study-prompt')).not.toHaveText('What does the ALU do, and what results do the Lab 4 function codes select?');
});

test('factorial course advances through inputs 0, 3, and 8 and finishes its series', async ({ page }) => {
  await page.goto('./#/factorial');
  for (const [index, expected] of [1, 6, 40320].entries()) {
    await page.getByRole('button', { name: 'Run to stop' }).click();
    await expect(page.getByText(new RegExp(`Stop loop reached.*t2 = ${expected}\\.`))).toBeVisible();
    await expect(page.locator('.study-cpu-readouts')).toContainText(String(expected));
    const lastEdge = page.locator('details.study-edge-details');
    await expect(lastEdge).not.toHaveAttribute('open', '');
    await lastEdge.locator('summary').click();
    await expect(lastEdge.locator('.study-last-trace')).toContainText('Last instruction');
    await page.getByRole('button', { name: index === 2 ? 'Finish series' : 'Next exercise' }).click();
    if (index < 2) await expect(page.getByLabel('Example input n')).toHaveValue(String(index + 1));
  }
  await expect(page.getByRole('heading', { name: 'Series complete' })).toBeVisible();
  await page.getByRole('button', { name: 'Review series' }).click();
  await expect(page.locator('.lesson-position')).toContainText('Exercise 1 of 3');
  await page.getByRole('button', { name: 'Next exercise' }).click();
  await page.getByRole('button', { name: 'Next exercise' }).click();
  await page.getByRole('button', { name: 'Finish series' }).click();
  await expect(page.getByRole('heading', { name: 'Series complete' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Series complete' })).toBeVisible();
  await page.getByRole('link', { name: 'Next topic' }).click();
  await expect(page.locator('.breadcrumb')).toContainText('Oral exam');
});

test('factorial rejects invalid edited source without advancing CPU state', async ({ page }) => {
  await page.goto('./#/factorial');
  await expect(page.locator('details.study-disclosure').filter({ hasText: 'Edit program' })).not.toHaveAttribute('open', '');
  await page.getByText('Edit program', { exact: true }).click();
  const source = page.getByLabel('Assembly source');
  await source.fill('addi t2, x0\n');
  await page.getByRole('button', { name: 'Assemble edits' }).click();
  await expect(page.getByText(/expects 3 operands/)).toBeVisible();
  await expect(page.locator('.study-cpu-heading')).toContainText('0 cycles');
  await expect(page.locator('.study-cpu-readouts')).toContainText('0x00000000');
});

test('hex import validates the words and runs to its self-branching stop loop', async ({ page }) => {
  await page.goto('./#/factorial');
  await page.getByText('Edit program', { exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'known.hex',
    mimeType: 'text/plain',
    buffer: Buffer.from('00300293\n00900393\n00000063\n'),
  });
  await expect(page.getByText('known.hex loaded.')).toBeVisible();
  await expect(page.locator('#factorial-source')).toContainText('addi t0, zero, 3');
  await expect(page.locator('#factorial-source')).toContainText('addi t2, zero, 9');
  await page.getByRole('button', { name: 'Run to stop' }).click();
  await expect(page.getByText(/Stop loop reached after 3 total clock cycles\. t2 = 9\./)).toBeVisible();
  await expect(page.locator('.study-cpu-readouts')).toContainText('9');
});

test('assisted factorial prediction is not counted as a correct attempt', async ({ page }) => {
  await page.goto('./#/factorial');
  await expect(page.locator('details.study-prediction-panel')).not.toHaveAttribute('open', '');
  await page.getByText('Predict future state', { exact: true }).click();
  await page.getByText('Reveal answer', { exact: true }).click();
  await page.getByRole('button', { name: 'Show value and trace' }).click();
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.locator('.study-status')).toContainText('assisted or repeated check was not counted');
  await expect(page.getByRole('button', { name: 'Next exercise' })).toBeVisible();
  await page.goto('./#/progress');
  await page.locator('.course-topic').filter({ hasText: 'Factorial' }).locator('summary').click();
  await expect(page.getByRole('link', { name: 'Factorial, exercise 1: reviewed' })).toBeVisible();
});

test('welcome opens the lab and deep topic hashes survive refresh', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Welcome to the lab.' })).toBeVisible();
  await page.getByRole('link', { name: 'Open lab' }).click();
  await expect(page.locator('.breadcrumb')).toContainText('Datapath');
  expect(await page.evaluate(() => location.hash)).toBe('#/datapath');
  await page.goto('./#/branch');
  await page.reload();
  await expect(page.locator('.breadcrumb')).toContainText('Branches');
});

test('hash navigation selects the matching topic and unknown routes return to welcome', async ({ page }) => {
  await page.goto('./#/datapath');
  await page.locator('.desktop-topics').getByRole('link', { name: 'Branches' }).click();
  await expect(page.locator('.breadcrumb')).toContainText('Branch');
  await page.goto('./#/not-a-topic');
  await expect(page.getByRole('heading', { name: 'Welcome to the lab.' })).toBeVisible();
});

test('mobile topic menu opens a topic and closes after navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#/datapath');
  const menu = page.locator('details.topic-menu');
  await expect(menu).not.toHaveAttribute('open', '');
  await menu.getByText('Topics', { exact: true }).click();
  await menu.getByRole('navigation', { name: 'Mobile learning topics' }).getByRole('link', { name: 'Branches' }).click();
  await expect(page.locator('.breadcrumb')).toContainText('Branches');
  await expect(menu).not.toHaveAttribute('open', '');
  expect(await page.evaluate(() => location.hash)).toBe('#/branch');
});

test('solved and reviewed lesson statuses persist in the course cookie', async ({ page, baseURL }) => {
  await page.goto('./#/clock');
  await expect(page.locator('.lesson-position')).toContainText('Exercise 1 of 14');
  await page.getByRole('button', { name: 'Immediate propagation' }).click();
  await page.getByRole('button', { name: 'Check timing' }).click();
  await page.getByRole('button', { name: 'Next exercise' }).click();
  await expect(page.locator('.lesson-position')).toContainText('Exercise 2 of 14');
  await page.getByRole('button', { name: 'Rising clock edge' }).click();
  await page.getByRole('button', { name: 'Check timing' }).click();
  await expect(page.getByRole('button', { name: 'Next exercise' })).toBeVisible();
  const courseCookie = (await page.context().cookies()).find((cookie) => cookie.name === COURSE_COOKIE);
  expect(courseCookie).toBeDefined();
  const appBase = new URL(baseURL ?? 'http://127.0.0.1:4180');
  const appPath = new URL('.', appBase.href.endsWith('/') ? appBase.href : `${appBase.href}/`).pathname;
  expect(courseCookie?.path).toBe(appPath);
  expect(courseCookie?.sameSite).toBe('Lax');
  expect(courseCookie?.secure).toBe(appBase.protocol === 'https:');
  expect(courseCookie?.expires).toBeGreaterThan(Date.now() / 1000 + 350 * 24 * 60 * 60);
  await page.goto('./#/progress');
  const clock = page.locator('.course-topic').filter({ hasText: 'Clocking' });
  await clock.locator('summary').click();
  await expect(page.getByRole('link', { name: 'Clocking, exercise 1: solved' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Clocking, exercise 2: reviewed' })).toBeVisible();
  await page.reload();
  const reloadedClock = page.locator('.course-topic').filter({ hasText: 'Clocking' });
  await reloadedClock.locator('summary').click();
  await expect(page.getByRole('link', { name: 'Clocking, exercise 1: solved' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Clocking, exercise 2: reviewed' })).toBeVisible();
});

test('progress reset can be canceled or confirmed and survives reload', async ({ page }) => {
  await seedCourse(page, 'clock', 2, { 0: 2, 1: 1 });
  await page.goto('./#/progress');
  const clock = page.locator('.course-topic').filter({ hasText: 'Clocking' });
  await clock.locator('summary').click();
  await expect(page.getByRole('link', { name: 'Clocking, exercise 1: solved' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Clocking, exercise 2: reviewed' })).toBeVisible();

  await page.getByRole('button', { name: 'Reset progress' }).click();
  await expect(page.getByText(/Reset all saved progress\?/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('link', { name: 'Clocking, exercise 1: solved' })).toBeVisible();

  await page.evaluate(() => {
    localStorage.setItem('is1200-learning-progress-v1', JSON.stringify({ version: 1, topics: { clock: { attempts: 5, correct: 2 } }, streak: 2, bestStreak: 4 }));
    localStorage.setItem('unrelated-app-state', 'keep-me');
  });

  await page.getByRole('button', { name: 'Reset progress' }).click();
  await page.getByRole('button', { name: 'Reset all progress' }).click();
  await expect(page.getByRole('status')).toContainText('All saved progress has been reset');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('is1200-learning-progress-v1') || '{}'))).toEqual({ version: 1, topics: {}, streak: 0, bestStreak: 0 });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('unrelated-app-state'))).toBe('keep-me');
  await expect(page.getByRole('link', { name: 'Clocking, exercise 1: not started' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('progressbar', { name: 'Solved exercises' })).toHaveAttribute('value', '0');
  const reloadedClock = page.locator('.course-topic').filter({ hasText: 'Clocking' });
  await reloadedClock.locator('summary').click();
  await expect(page.getByRole('link', { name: 'Clocking, exercise 1: not started' })).toBeVisible();
});

test('application stays usable when local storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Document.prototype, 'cookie', { configurable: true, get() { throw new DOMException('blocked'); }, set() { throw new DOMException('blocked'); } });
  });
  await page.goto('./#/datapath');
  await expect(page.locator('.breadcrumb')).toContainText('Datapath');
  await expect(page.getByRole('status')).toContainText('Progress cannot be saved on this device');
});

test('keyboard skip link focuses main without changing the topic hash', async ({ page }) => {
  await page.goto('./#/branch');
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to practice' });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  expect(await page.evaluate(() => location.hash)).toBe('#/branch');
});

test('SVG datapath component can be opened with Enter', async ({ page }) => {
  await page.goto('./#/datapath');
  const rom = page.getByRole('button', { name: 'Explore Instruction ROM' });
  await rom.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.component-explanation')).toContainText('Instruction ROM');
  await expect(page.locator('.component-explanation')).toContainText('A byte address of 12 selects word 3');
});

test('register reads change immediately and writes to x0 remain ignored', async ({ page }) => {
  await page.goto('./#/registers');
  const experiment = page.locator('details.trainer-extra').filter({ hasText: 'Experiment with registers' });
  await expect(experiment).not.toHaveAttribute('open', '');
  await experiment.locator('summary').click();
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
  await page.goto('./#/alu');
  await page.getByLabel('Predicted Y · 32-bit result').selectOption('typed');
  await page.getByLabel('Predicted Y · 32-bit result (typed)').fill('-2147483648');
  await page.getByLabel('Predicted Zero').selectOption('0');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '-2147483648' })).toBeVisible();
});

test('control exercise distinguishes encoded fields from four generated signals', async ({ page }) => {
  await page.goto('./#/control');
  await expect(page.locator('details.trainer-extra').filter({ hasText: 'How the decoder works' })).not.toHaveAttribute('open', '');
  const mnemonic = (await page.locator('.trainer-sample-mnemonic').textContent())?.trim();
  const values = mnemonic === 'beq'
    ? { opcode: '0x00000063', regWrite: '0', aluSrc: '0', branch: '1', aluControl: '001' }
    : mnemonic === 'addi'
      ? { opcode: '0x00000013', regWrite: '1', aluSrc: '1', branch: '0', aluControl: '000' }
      : { opcode: '0x00000033', regWrite: '1', aluSrc: '0', branch: '0', aluControl: '000' };
  for (const [label, value] of Object.entries(values)) await page.getByLabel(label === 'opcode' ? 'Encoded opcode' : label === 'aluControl' ? 'ALUControl' : label === 'regWrite' ? 'RegWrite' : label === 'aluSrc' ? 'ALUSrc' : 'Branch').selectOption(value);
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
  await expect(page.locator('details.trainer-extra').filter({ hasText: 'How the decoder works' })).not.toHaveAttribute('open', '');
  await page.getByText('How the decoder works', { exact: true }).click();
  for (const name of ['RegWrite', 'ALUSrc', 'Branch', 'ALUControl']) {
    await expect(page.locator('.trainer-signal-table')).toContainText(name);
  }
  await page.getByRole('button', { name: 'Next exercise' }).click();
  await expect(page.locator('.lesson-position')).toContainText('Exercise 2 of 9');
});

test('format field placement grades the complete R-type bit layout', async ({ page }) => {
  await page.goto('./#/formats');
  await expect(page.locator('.trainer-instruction-sample code')).toContainText('add ');
  const slots = [
    ['31:25', 'funct7'], ['24:20', 'rs2'], ['19:15', 'rs1'],
    ['14:12', 'funct3'], ['11:7', 'rd'], ['6:0', 'opcode'],
  ];
  const strip = page.getByRole('group', { name: 'R-type instruction bit fields' });
  await expect(strip.locator('[data-slot-range="31:25"]')).toHaveAccessibleName('Bits 31:25; empty range');
  for (const [range, field] of slots) await placeField(page, 'R', range, field);
  await page.getByRole('button', { name: 'Check layout' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Decoded operands' })).toBeVisible();
});

test('completed but incorrect field placement can be checked and graded', async ({ page }) => {
  await page.goto('./#/formats');
  const slots = [
    ['31:25', 'funct7'], ['24:20', 'rs2'], ['19:15', 'rs1'],
    ['14:12', 'funct3'], ['11:7', 'rd'], ['6:0', 'opcode'],
  ];
  for (const [index, [range]] of slots.entries()) await placeField(page, 'R', range, slots[(index + 1) % slots.length][1]);
  const check = page.getByRole('button', { name: 'Check layout' });
  await expect(check).toBeEnabled();
  await check.click();
  await expect(page.getByRole('status').filter({ hasText: 'Not quite' })).toBeVisible();
});

test('field bank supports tap, keyboard placement, and moving a unique field', async ({ page }) => {
  await page.goto('./#/formats');
  const strip = page.getByRole('group', { name: 'R-type instruction bit fields' });
  const bank = page.getByRole('group', { name: 'Available instruction fields' });
  const funct7 = bank.getByRole('button', { name: 'funct7', exact: true });
  await funct7.click();
  await expect(funct7).toHaveAttribute('aria-pressed', 'true');
  await strip.locator('[data-slot-range="31:25"]').click();
  await expect(strip.locator('[data-slot-range="31:25"]')).toHaveAccessibleName('Bits 31:25; assigned funct7');

  const rs2 = bank.getByRole('button', { name: 'rs2', exact: true });
  await rs2.focus();
  await page.keyboard.press('Enter');
  await strip.locator('[data-slot-range="31:25"]').focus();
  await page.keyboard.press('Enter');
  await expect(strip.locator('[data-slot-range="31:25"]')).toHaveAccessibleName('Bits 31:25; assigned rs2');
  await expect(bank.getByRole('button', { name: 'funct7', exact: true })).toBeVisible();
  await expect(strip.locator('[data-slot-range="24:20"]')).toHaveAccessibleName('Bits 24:20; empty range');
  await expect(page.getByRole('status')).toContainText('funct7 returned to the field bank');
});

test('mouse pointer can drag an instruction field onto its range', async ({ page }) => {
  await page.goto('./#/formats');
  const chip = page.getByRole('group', { name: 'Available instruction fields' }).getByRole('button', { name: 'funct7', exact: true });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await dragField(page, 'R', 'funct7', '31:25');
  await expect(page.getByRole('group', { name: 'R-type instruction bit fields' }).locator('[data-slot-range="31:25"]'))
    .toHaveAccessibleName('Bits 31:25; assigned funct7');
});

test('touch pointer can drag an instruction field on a narrow screen', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 1000 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('./#/formats');
  await expect(page.getByRole('group', { name: 'R-type instruction bit fields' })).toBeVisible();
  const chip = page.getByRole('group', { name: 'Available instruction fields' }).getByRole('button', { name: 'funct7', exact: true });
  const slot = page.getByRole('group', { name: 'R-type instruction bit fields' }).locator('[data-slot-range="31:25"]');
  await chip.scrollIntoViewIfNeeded();
  await slot.scrollIntoViewIfNeeded();
  const from = await chip.boundingBox();
  const to = await slot.boundingBox();
  if (!from || !to) throw new Error('Field chip or target range is not visible.');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x + from.width / 2, y: from.y + from.height / 2, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: to.x + to.width / 2, y: to.y + to.height / 2, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(slot).toHaveAccessibleName('Bits 31:25; assigned funct7');
  await context.close();
});

test('tablet taps place a field, choose a ROM value, check, advance, and open progress @tablet', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('./#/formats');
  const bank = page.getByRole('group', { name: 'Available instruction fields' });
  const strip = page.getByRole('group', { name: 'R-type instruction bit fields' });
  await bank.getByRole('button', { name: 'funct7', exact: true }).tap();
  await strip.locator('[data-slot-range="31:25"]').tap();
  await expect(strip.locator('[data-slot-range="31:25"]')).toHaveAccessibleName('Bits 31:25; assigned funct7');

  const trace = romLessonTrace(0);
  await page.goto('./#/rom');
  const answer = page.getByLabel('Which ROM word index does this PC select?');
  await answer.tap();
  await answer.selectOption(String(toSigned(trace.romAddress)));
  await page.getByRole('button', { name: 'Check answer' }).tap();
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
  await page.getByRole('button', { name: 'Next exercise' }).tap();
  await expect(page.locator('.lesson-position')).toContainText('Exercise 2 of 8');

  const menu = page.locator('details.topic-menu');
  await menu.locator('summary').tap();
  await menu.getByRole('link', { name: /Progress/ }).tap();
  await expect(page.locator('.breadcrumb')).toHaveText('Your progress');
  await context.close();
});

test('guided instruction fields reveal the mapping without scoring practice', async ({ page }) => {
  await page.goto('./#/formats');
  await page.getByRole('button', { name: 'Guided lesson' }).click();
  const strip = page.getByRole('group', { name: 'R-type instruction bit fields' });
  await expect(strip.locator('[data-slot-range="31:25"]')).toHaveAccessibleName('Bits 31:25; field funct7');
  await expect(page.getByText('Guided · unscored')).toBeVisible();
});

test('B-format assembly and scattered immediate bits are visible', async ({ page }) => {
  const labNames = Object.values(INSTRUCTIONS).filter((item) => item.scope === 'lab').map((item) => item.name);
  const beqIndex = labNames.indexOf('beq');
  await seedCourse(page, 'formats', beqIndex);
  await page.goto('./#/formats');
  const scenario = generateScenario('beq', lessonRandom('formats', beqIndex));
  expect(scenario.instruction.name).toBe('beq');
  await expect(page.locator('.trainer-instruction-sample code')).toContainText('beq ');

  const slots = [
    ['31', 'imm[12]'], ['30:25', 'imm[10:5]'], ['24:20', 'rs2'],
    ['19:15', 'rs1'], ['14:12', 'funct3'], ['11:8', 'imm[4:1]'],
    ['7', 'imm[11]'], ['6:0', 'opcode'],
  ];
  for (const [range, field] of slots) await placeField(page, 'B', range, field);
  await page.getByRole('button', { name: 'Check layout' }).click();
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
  await page.goto('./#/encoding');
  const scenario = generateScenario('add', lessonRandom('encoding', 0));
  await page.getByLabel('Instruction format family').selectOption('R');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
  await page.getByRole('button', { name: 'Next step' }).click();

  await page.getByLabel('Encoded opcode field').selectOption('0x00000033');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Next step' }).click();

  for (const [index, value] of [scenario.instruction.rd!, scenario.instruction.rs1, scenario.instruction.rs2!].entries()) {
    await page.locator('.trainer-operand-grid select').nth(index).selectOption(String(value));
  }
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Next step' }).click();

  for (const [range, field] of [['31:25', 'funct7'], ['24:20', 'rs2'], ['19:15', 'rs1'], ['14:12', 'funct3'], ['11:7', 'rd'], ['6:0', 'opcode']]) await placeField(page, 'R', range, field);
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Next step' }).click();

  await page.getByLabel('Complete 32-bit instruction · hexadecimal').fill(`0x${scenario.word.toString(16).padStart(8, '0')}`);
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
  await expect(page.locator('.trainer-final-word')).toContainText(`0x${scenario.word.toString(16).padStart(8, '0')}`);
});

test('encoding field placement can submit a complete incorrect arrangement', async ({ page }) => {
  await page.goto('./#/encoding');
  const scenario = generateScenario('add', lessonRandom('encoding', 0));
  await page.getByLabel('Instruction format family').selectOption('R');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Next step' }).click();
  await page.getByLabel('Encoded opcode field').selectOption('0x00000033');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Next step' }).click();
  for (const [index, value] of [scenario.instruction.rd!, scenario.instruction.rs1, scenario.instruction.rs2!].entries()) {
    await page.locator('.trainer-operand-grid select').nth(index).selectOption(String(value));
  }
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Next step' }).click();

  const fields = ['funct7', 'rs2', 'rs1', 'funct3', 'rd', 'opcode'];
  const ranges = ['31:25', '24:20', '19:15', '14:12', '11:7', '6:0'];
  const check = page.getByRole('button', { name: 'Check answer' });
  await expect(check).toBeDisabled();
  for (const [index, range] of ranges.entries()) await placeField(page, 'R', range, fields[(index + 1) % fields.length]);
  await expect(check).toBeEnabled();
  await check.click();
  await expect(page.getByRole('status').filter({ hasText: 'Not quite' })).toBeVisible();
});

test('branch prediction checks control, comparison, byte target, and selected next PC', async ({ page }) => {
  await page.goto('./#/branch');
  await expect(page.locator('details.trainer-extra').filter({ hasText: 'Follow the branch path' })).not.toHaveAttribute('open', '');
  const trace = branchLessonTrace();
  await chooseNumber(page, 'SUB result · ALU Y', trace.aluResult >>> 0);
  await page.getByLabel('ALU Zero').selectOption(String(trace.zero));
  await page.getByLabel('Branch control enabled?').selectOption('1');
  await page.getByLabel('Is the branch taken?').selectOption(trace.branchTaken ? 'yes' : 'no');
  await chooseNumber(page, 'Branch target · byte address', trace.branchTarget >>> 0);
  await chooseNumber(page, 'PC+4 · byte address', trace.pcPlus4 >>> 0);
  await chooseNumber(page, 'PCnext · byte address', trace.pcNext >>> 0);
  await page.getByRole('button', { name: 'Check branch' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
  await page.getByText('Follow the branch path', { exact: true }).click();
  await expect(page.locator('.trainer-branch-path')).toContainText(`PCnext = ${trace.pcNext}`);
});

test('ROM exercise converts a nonzero byte PC to its word index', async ({ page }) => {
  await seedCourse(page, 'rom', 1);
  await page.goto('./#/rom');
  await expect(page.locator('details.trainer-extra').filter({ hasText: 'Why divide by four?' })).not.toHaveAttribute('open', '');
  const trace = romLessonTrace(1);
  expect(trace.pc).toBeGreaterThan(0);
  expect(trace.romAddress).toBe(trace.pc / 4);
  await page.getByText('Why divide by four?', { exact: true }).click();
  await expect(page.locator('.trainer-rom-fetch')).toContainText(`0x${trace.pc.toString(16).padStart(2, '0').toUpperCase()}`);
  await chooseNumber(page, 'Which ROM word index does this PC select?', trace.romAddress);
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
  await expect(page.locator('.trainer-rom-fetch')).toContainText(String(trace.romAddress));
});

test('keyboard-only ROM answer can be checked and advanced', async ({ page }) => {
  await page.goto('./#/welcome');
  for (let index = 0; index < 12 && !(await page.getByRole('link', { name: 'Open lab' }).evaluate((element) => element === document.activeElement)); index++) await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Open lab' })).toBeFocused();
  await page.keyboard.press('Enter');
  for (let index = 0; index < 70; index++) {
    const focusedHref = await page.evaluate(() => document.activeElement?.getAttribute('href') ?? '');
    if (focusedHref === '#/rom') break;
    await page.keyboard.press('Tab');
  }
  const romLink = page.locator('.desktop-topics').getByRole('link', { name: 'PC and ROM' });
  await expect(romLink).toBeFocused();
  await page.keyboard.press('Enter');
  const answer = page.getByLabel('Which ROM word index does this PC select?');
  const expectedWord = romLessonTrace(0).romAddress;
  for (let index = 0; index < 80 && !(await answer.evaluate((element) => element === document.activeElement)); index++) await page.keyboard.press('Tab');
  await expect(answer).toBeFocused();
  const optionIndex = await answer.locator('option').evaluateAll((options, expected) => options.findIndex((option) => (option as HTMLOptionElement).value === String(expected)), expectedWord);
  expect(optionIndex).toBeGreaterThan(0);
  await answer.press(String(expectedWord));
  await expect(answer).toHaveValue(String(expectedWord));
  const check = page.getByRole('button', { name: 'Check answer' });
  await page.keyboard.press('Tab');
  await expect(check).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
  const next = page.getByRole('button', { name: 'Next exercise' });
  await expect(next).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.lesson-position')).toContainText('Exercise 2 of 8');
  await expect(page.locator('#main-content')).toBeFocused();
});

async function openEncodingFields(page: import('@playwright/test').Page) {
  const scenario = generateScenario('add', lessonRandom('encoding', 0));
  await page.getByLabel('Instruction format family').selectOption('R');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Next step' }).click();
  await page.getByLabel('Encoded opcode field').selectOption('0x00000033');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Next step' }).click();
  for (const [index, value] of [scenario.instruction.rd!, scenario.instruction.rs1, scenario.instruction.rs2!].entries()) {
    await page.locator('.trainer-operand-grid select').nth(index).selectOption(String(value));
  }
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByRole('group', { name: 'R-type instruction bit fields' })).toBeVisible();
}

test('all course routes and open disclosures stay contained at 390, 768, and 1024px @tablet', async ({ page }) => {
  const topics = [
    ['datapath', 'Datapath'], ['formats', 'Instruction formats'], ['control', 'Control unit'],
    ['registers', 'Register file'], ['alu', 'ALU'], ['branch', 'Branches'], ['clock', 'Clocking'],
    ['encoding', 'Assembly and encoding'], ['rom', 'PC and ROM'], ['factorial', 'Factorial'], ['oral', 'Oral exam'],
  ];
  const routes = [...topics, ['progress', 'Your progress']];
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./#/welcome');
    await expect(page.getByRole('heading', { name: 'Welcome to the lab.' })).toBeVisible();
    for (const [topic, title] of routes) {
      if (topic === 'formats') {
        const labNames = Object.values(INSTRUCTIONS).filter((item) => item.scope === 'lab').map((item) => item.name);
        await seedCourse(page, 'formats', labNames.indexOf('beq'));
      }
      await page.goto(`./#/${topic}`);
      await expect(page.locator('.breadcrumb')).toContainText(title);
      const mobileMenu = page.locator('details.topic-menu[open] > summary');
      if (await mobileMenu.count()) await mobileMenu.click();
      if (topic === 'encoding') await openEncodingFields(page);
      if (topic === 'oral') await page.getByRole('button', { name: 'Reveal answer guide' }).click();
      for (let attempts = 0; attempts < 40; attempts++) {
        const summary = page.locator('details:not(.topic-menu):visible:not([open]) > summary').first();
        if (!(await summary.count())) break;
        await summary.click();
      }
      if (topic === 'formats') await expect(page.getByRole('group', { name: 'Available instruction fields' })).toBeVisible();
      const layout = await page.evaluate(() => {
        const width = window.innerWidth;
        const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
        const overflowing = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((element) => {
          if (!element.clientWidth || element.offsetWidth === 0) return false;
          if (!element.checkVisibility()) return false;
          if (element.classList.contains('instruction-visually-hidden')) return false;
          if (element.matches('input,textarea,select')) return false;
          const overflowX = getComputedStyle(element).overflowX;
          return element.scrollWidth > element.clientWidth + 1 && overflowX !== 'auto' && overflowX !== 'scroll';
        }).slice(0, 12).map((element) => `${element.tagName.toLowerCase()}.${String(element.className).replaceAll(' ', '.')}:${element.scrollWidth}/${element.clientWidth}`);
        const scrollable = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((element) => {
          if (!element.clientWidth || element.offsetWidth === 0 || !element.checkVisibility() || element.matches('input,textarea,select') || element.classList.contains('instruction-visually-hidden')) return false;
          const style = getComputedStyle(element);
          return element.scrollWidth > element.clientWidth + 1 && (style.overflowX === 'auto' || style.overflowX === 'scroll');
        }).slice(0, 12).map((element) => `${element.tagName.toLowerCase()}.${String(element.className).replaceAll(' ', '.')}:${element.scrollWidth}/${element.clientWidth}`);
        const scrollersOutside = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((element) => {
          const style = getComputedStyle(element);
          if (element.scrollWidth <= element.clientWidth + 1 || (style.overflowX !== 'auto' && style.overflowX !== 'scroll')) return false;
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > width + 1;
        }).length;
        return { width, documentWidth, overflowing, scrollable, scrollersOutside };
      });
      expect(layout.documentWidth, `${topic} document at ${width}px`).toBeLessThanOrEqual(width);
      expect(layout.overflowing, `${topic} internal horizontal overflow at ${width}px`).toEqual([]);
      expect(layout.scrollable, `${topic} visible horizontal scroll area at ${width}px`).toEqual([]);
      expect(layout.scrollersOutside, `${topic} scroll area outside viewport at ${width}px`).toBe(0);
    }
  }
});
