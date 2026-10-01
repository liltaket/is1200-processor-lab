import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Topic } from './engine';
import { CLOCK_EVENTS, ORAL_QUESTIONS, TOPICS } from './learning';

export const LESSON_COUNTS: Record<Topic, number> = {
  datapath: 9, formats: 9, control: 9, registers: 9, alu: 10,
  branch: 8, clock: CLOCK_EVENTS.length, encoding: 9, rom: 8,
  factorial: 3, oral: ORAL_QUESTIONS.length,
};
export const COURSE_COOKIE = 'processor_lab_course_v1';
export type LessonOutcome = 'reviewed' | 'solved';
export type LessonStatus = 0 | 1 | 2;
export type CourseProgress = Record<Topic, { cursor: number; results: LessonStatus[] }>;

export function emptyCourse(): CourseProgress {
  return Object.fromEntries(TOPICS.map(({ id }) => [id, { cursor: 0, results: Array<LessonStatus>(LESSON_COUNTS[id]).fill(0) }])) as CourseProgress;
}
export function serializeCourse(progress: CourseProgress): string {
  return JSON.stringify([1, ...TOPICS.map(({ id }) => [progress[id].cursor, progress[id].results.join('')])]);
}
export function parseCourse(raw: string): CourseProgress {
  const fresh = emptyCourse();
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || data[0] !== 1 || data.length !== TOPICS.length + 1) return fresh;
    TOPICS.forEach(({ id }, i) => {
      const entry: unknown = data[i + 1];
      if (!Array.isArray(entry) || entry.length !== 2) return;
      const [cursor, statuses] = entry;
      if (!Number.isInteger(cursor) || typeof statuses !== 'string' || statuses.length !== LESSON_COUNTS[id] || !/^[012]+$/.test(statuses)) return;
      fresh[id] = { cursor: Math.min(LESSON_COUNTS[id], Math.max(0, cursor as number)), results: Array.from(statuses, digit => Number(digit) as LessonStatus) };
    });
  } catch { /* An invalid or older cookie starts a fresh course. */ }
  return fresh;
}
function cookieValue(cookie: string): string | undefined {
  return cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${COURSE_COOKIE}=`))?.slice(COURSE_COOKIE.length + 1);
}
export function loadCourse(jar?: Pick<Document, 'cookie'>): CourseProgress {
  try {
    const raw = cookieValue((jar ?? globalThis.document).cookie);
    return raw ? parseCourse(decodeURIComponent(raw)) : emptyCourse();
  } catch { return emptyCourse(); }
}
export function saveCourse(progress: CourseProgress, jar?: Pick<Document, 'cookie'>, path?: string): boolean {
  try {
    const target = jar ?? globalThis.document;
    const value = encodeURIComponent(serializeCourse(progress));
    const scope = path ?? new URL('.', globalThis.location.href).pathname;
    const secure = globalThis.location?.protocol === 'https:' ? '; Secure' : '';
    target.cookie = `${COURSE_COOKIE}=${value}; Path=${scope}; Max-Age=31536000; SameSite=Lax${secure}`;
    return cookieValue(target.cookie) === value;
  } catch { return false; }
}
export function setLessonResult(progress: CourseProgress, topic: Topic, index: number, outcome: LessonOutcome): CourseProgress {
  if (!Number.isInteger(index) || index < 0 || index >= LESSON_COUNTS[topic]) return progress;
  const previous = progress[topic];
  const status = outcome === 'solved' ? 2 : 1;
  if (previous.results[index] >= status) return progress;
  const results = [...previous.results];
  results[index] = status;
  return { ...progress, [topic]: { ...previous, results } };
}
export function lessonStats(progress: CourseProgress, topic: Topic) {
  const results = progress[topic].results;
  return { total: results.length, solved: results.filter(status => status === 2).length, reviewed: results.filter(status => status === 1).length, visited: results.filter(Boolean).length };
}
export function lessonRandom(topic: Topic, index: number): () => number {
  let seed = Array.from(topic).reduce((hash, letter) => Math.imul(hash, 31) + letter.charCodeAt(0), 17) ^ Math.imul(index + 1, 2654435761);
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

type CourseContextValue = {
  progress: CourseProgress; saved: boolean; epoch: number;
  complete: (topic: Topic, index: number, outcome: LessonOutcome) => void;
  goTo: (topic: Topic, index: number) => void;
  reset: () => void;
};
const CourseContext = createContext<CourseContextValue | null>(null);
export function CourseProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState(loadCourse);
  const [saved, setSaved] = useState(true);
  const [epoch, setEpoch] = useState(0);
  useEffect(() => { setSaved(saveCourse(progress)); }, [progress]);
  const value: CourseContextValue = {
    progress, saved, epoch,
    complete: (topic, index, outcome) => setProgress(previous => setLessonResult(previous, topic, index, outcome)),
    goTo: (topic, index) => { if (!Number.isFinite(index)) return; setProgress(previous => ({ ...previous, [topic]: { ...previous[topic], cursor: Math.min(LESSON_COUNTS[topic], Math.max(0, Math.floor(index))) } })); },
    reset: () => { setProgress(emptyCourse()); setEpoch(value => value + 1); },
  };
  return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>;
}
export function useCourse(): CourseContextValue {
  const value = useContext(CourseContext);
  if (!value) throw new Error('The lesson must be inside CourseProvider.');
  return value;
}
export function useLesson(topic: Topic) {
  const course = useCourse();
  const index = course.progress[topic].cursor;
  return {
    index, total: LESSON_COUNTS[topic], id: `${topic}:${index}`,
    status: course.progress[topic].results[index] ?? 0,
    complete: (outcome: LessonOutcome) => course.complete(topic, index, outcome),
    next: () => course.goTo(topic, index + 1),
    goTo: (index: number) => course.goTo(topic, index),
  };
}
