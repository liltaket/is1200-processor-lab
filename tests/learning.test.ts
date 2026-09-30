import { describe, expect, it } from 'vitest';
import {
  CLOCK_EVENTS, ORAL_QUESTIONS, TOPICS, createProgress, loadProgress, mastery, recordAttempt, saveProgress, weakestTopic,
} from '../src/learning';
import type { Progress } from '../src/learning';

const KEY = 'is1200-learning-progress-v1';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe('learning content', () => {
  it('provides all topics and at least 24 source-located oral prompts', () => {
    expect(TOPICS.map(({ id }) => id)).toEqual([
      'datapath', 'formats', 'control', 'registers', 'alu', 'branch', 'clock', 'encoding', 'rom', 'factorial', 'oral',
    ]);
    expect(ORAL_QUESTIONS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(ORAL_QUESTIONS.map(({ id }) => id)).size).toBe(ORAL_QUESTIONS.length);
    expect(ORAL_QUESTIONS.every(({ prompt, concepts, answer, source }) =>
      prompt.length > 20 && concepts.length > 0 && answer.length > 20 && source.length > 0)).toBe(true);
    expect(ORAL_QUESTIONS.find(({ id }) => id === 'register-capacity')?.answer).toContain('224 bits');
    expect(ORAL_QUESTIONS.find(({ id }) => id === 'register-capacity')?.answer).toContain('992 writable');
  });

  it('includes clock cases for enabled writes, pending data, x0, and state updates', () => {
    expect(CLOCK_EVENTS.length).toBeGreaterThanOrEqual(10);
    const event = (id: string) => CLOCK_EVENTS.find((item) => item.id === id)!;
    expect(event('we3-asserts').answer).toBe('combinational');
    expect(event('wd3-changes').answer).toBe('combinational');
    expect(event('register-write').answer).toBe('edge');
    expect(event('x0-write').answer).toBe('edge');
    expect(event('pc-updates').answer).toBe('edge');
  });
});

describe('progress persistence', () => {
  it('creates empty versioned progress', () => {
    expect(createProgress()).toEqual({ version: 1, topics: {}, streak: 0, bestStreak: 0 });
  });

  it('loads saved counts but resets the session streak', () => {
    const saved: Progress = {
      version: 1, topics: { alu: { attempts: 4, correct: 3 } }, streak: 3, bestStreak: 7,
    };
    expect(loadProgress(memoryStorage({ [KEY]: JSON.stringify(saved) }))).toEqual({
      version: 1, topics: { alu: { attempts: 4, correct: 3 } }, streak: 0, bestStreak: 7,
    });
  });

  it('returns fresh progress for malformed JSON, invalid shape, or unavailable storage', () => {
    expect(loadProgress(memoryStorage({ [KEY]: '{bad json' }))).toEqual(createProgress());
    expect(loadProgress(memoryStorage({ [KEY]: JSON.stringify({ version: 2, topics: {} }) }))).toEqual(createProgress());
    expect(loadProgress({ getItem: () => { throw new Error('storage blocked'); } })).toEqual(createProgress());
  });

  it('sanitizes malformed counts and ignores unknown topic keys', () => {
    const malformed = {
      version: 1, topics: {
        alu: { attempts: 4.9, correct: 9 }, bogus: { attempts: 10, correct: 10 }, registers: { attempts: -1, correct: 4 },
      }, streak: 9, bestStreak: 3,
    };
    expect(loadProgress(memoryStorage({ [KEY]: JSON.stringify(malformed) }))).toEqual({
      version: 1, topics: { alu: { attempts: 4, correct: 4 }, registers: { attempts: 0, correct: 0 } }, streak: 0, bestStreak: 3,
    });
  });

  it('saves progress and reports storage write failures', () => {
    const storage = memoryStorage();
    const progress = recordAttempt(createProgress(), 'branch', true);
    expect(saveProgress(progress, storage)).toBe(true);
    expect(loadProgress(storage)).toEqual({ version: 1, topics: { branch: { attempts: 1, correct: 1 } }, streak: 0, bestStreak: 1 });
    expect(saveProgress(progress, { setItem: () => { throw new Error('quota'); } })).toBe(false);
  });
});

describe('progress tracking', () => {
  it('records attempts, correct answers, current streak, and best streak immutably', () => {
    const start = createProgress();
    const first = recordAttempt(start, 'alu', true);
    const second = recordAttempt(first, 'branch', true);
    const third = recordAttempt(second, 'alu', false);
    const fourth = recordAttempt(third, 'alu', true);
    expect(start).toEqual(createProgress());
    expect(first.topics.alu).toEqual({ attempts: 1, correct: 1 });
    expect(second.streak).toBe(2);
    expect(third.streak).toBe(0);
    expect(third.bestStreak).toBe(2);
    expect(fourth.streak).toBe(1);
    expect(fourth.topics.alu).toEqual({ attempts: 3, correct: 2 });
  });

  it('calculates topic mastery as correct attempts divided by attempts', () => {
    let progress = createProgress();
    progress = recordAttempt(progress, 'registers', true);
    progress = recordAttempt(progress, 'registers', false);
    progress = recordAttempt(progress, 'registers', true);
    expect(mastery(progress, 'registers')).toBe(67);
    expect(mastery(progress, 'alu')).toBe(0);
  });

  it('selects an unattempted or lowest-accuracy topic in a stable topic order', () => {
    const initial = createProgress();
    expect(weakestTopic(initial)).toBe('datapath');
    let progress = initial;
    for (const { id } of TOPICS) {
      if (id === 'formats') continue;
      progress = recordAttempt(progress, id, true);
    }
    progress = recordAttempt(progress, 'formats', false);
    progress = recordAttempt(progress, 'formats', true);
    expect(weakestTopic(progress)).toBe('formats');
  });

  it('does not get stuck recommending oral when self-grades credit subject topics', () => {
    let progress = createProgress();
    for (const { id } of TOPICS) {
      if (id !== 'oral') progress = recordAttempt(progress, id, true);
    }
    progress = recordAttempt(progress, 'alu', false);
    expect(weakestTopic(progress)).toBe('alu');
  });
});
