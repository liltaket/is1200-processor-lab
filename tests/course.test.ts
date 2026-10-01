import { describe, expect, it } from 'vitest';
import { COURSE_COOKIE, LESSON_COUNTS, emptyCourse, lessonRandom, lessonStats, loadCourse, parseCourse, saveCourse, serializeCourse, setLessonResult } from '../src/course';
import { TOPICS } from '../src/learning';

function cookieJar() {
  let cookie = 'other=preserved';
  let write = '';
  return { get cookie() { return cookie; }, set cookie(value: string) { write = value; cookie = `other=preserved; ${value.split(';')[0]}`; }, get write() { return write; } };
}
describe('ordered exercise progress', () => {
  it('persists individual outcomes and cursor within a compact scoped cookie', () => {
    const progress = setLessonResult(setLessonResult(emptyCourse(), 'alu', 0, 'solved'), 'alu', 1, 'reviewed');
    progress.alu.cursor = 2;
    const jar = cookieJar();
    expect(saveCourse(progress, jar, '/is1200-processor-lab/')).toBe(true);
    expect(jar.write).toContain('Path=/is1200-processor-lab/; Max-Age=31536000; SameSite=Lax');
    expect(jar.write.length).toBeLessThan(4096);
    expect(jar.cookie).toContain('other=preserved');
    expect(loadCourse(jar)).toEqual(progress);
    expect(lessonStats(loadCourse(jar), 'alu')).toEqual({ total: 10, solved: 1, reviewed: 1, visited: 2 });
  });
  it('never inflates completion on repeats or downgrades an independently solved task', () => {
    const start = emptyCourse();
    const solved = setLessonResult(start, 'branch', 3, 'solved');
    expect(setLessonResult(solved, 'branch', 3, 'solved')).toBe(solved);
    expect(setLessonResult(solved, 'branch', 3, 'reviewed')).toBe(solved);
    expect(start.branch.results[3]).toBe(0);
    const reviewed = setLessonResult(start, 'branch', 3, 'reviewed');
    expect(setLessonResult(reviewed, 'branch', 3, 'solved').branch.results[3]).toBe(2);
    expect(setLessonResult(start, 'alu', -1, 'solved')).toBe(start);
    expect(setLessonResult(start, 'alu', 1.5, 'solved')).toBe(start);
    expect(setLessonResult(start, 'alu', LESSON_COUNTS.alu, 'solved')).toBe(start);
  });
  it('starts safely when cookies are malformed, versioned differently, or unavailable', () => {
    for (const raw of ['invalid', '{}', '[2]', '[1]', 'null']) expect(parseCourse(raw)).toEqual(emptyCourse());
    expect(loadCourse({ cookie: `${COURSE_COOKIE}=%broken` })).toEqual(emptyCourse());
    expect(loadCourse({ get cookie(): string { throw new Error('blocked'); } })).toEqual(emptyCourse());
    expect(saveCourse(emptyCourse(), { get cookie() { return ''; }, set cookie(_value: string) { /* Cookies denied. */ } }, '/')).toBe(false);
    expect(saveCourse(emptyCourse(), { get cookie() { return ''; }, set cookie(_value: string) { throw new Error('blocked'); } }, '/')).toBe(false);
  });
  it('validates each series independently and supports the completed-series cursor', () => {
    const data = JSON.parse(serializeCourse(emptyCourse()));
    data[1] = [999, '2'.repeat(LESSON_COUNTS.datapath)];
    data[2] = [0, '9'.repeat(LESSON_COUNTS.formats)];
    data[3] = [0, '2'];
    const result = parseCourse(JSON.stringify(data));
    expect(result.datapath.cursor).toBe(LESSON_COUNTS.datapath);
    expect(result.datapath.results.every(value => value === 2)).toBe(true);
    expect(result.formats).toEqual(emptyCourse().formats);
    expect(result.control).toEqual(emptyCourse().control);
  });
  it('keeps task identity stable across revisits and gives each series its own sequence', () => {
    const samples = (topic: typeof TOPICS[number]['id'], index: number) => { const rng = lessonRandom(topic, index); return Array.from({ length: 12 }, () => rng()); };
    expect(samples('formats', 2)).toEqual(samples('formats', 2));
    expect(samples('formats', 2)).not.toEqual(samples('formats', 3));
    expect(samples('formats', 2)).not.toEqual(samples('encoding', 2));
    expect(samples('formats', 2).every(value => value >= 0 && value < 1)).toBe(true);
  });
});
