import { useState } from 'react';
import type { ModeProps } from '../ui-types';
import type { Topic } from '../engine';
import { useLesson } from '../course';

export type Grade = {
  correct: boolean;
  expected: string;
  explanation: string;
  component: string;
  revealed?: boolean;
  counted: boolean;
};

export function useCheck(topic: Topic, onAttempt: ModeProps['onAttempt']) {
  const lesson = useLesson(topic);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [locked, setLocked] = useState(false);
  const [assisted, setAssisted] = useState(false);

  function check(correct: boolean, expected: string, explanation: string, component: string) {
    if (locked) return;
    const counted = !assisted;
    if (counted) onAttempt(topic, correct);
    lesson.complete(correct && counted ? 'solved' : 'reviewed');
    setGrade({ correct, expected, explanation, component, counted });
    setLocked(true);
    if (!correct) setAssisted(true);
  }

  function reveal(expected: string, explanation: string, component: string) {
    if (locked) return;
    lesson.complete('reviewed');
    setGrade({ correct: false, expected, explanation, component, revealed: true, counted: false });
    setLocked(true);
    setAssisted(true);
  }

  function reset() {
    setGrade(null);
    setLocked(false);
    setAssisted(true);
  }

  function fresh() {
    setGrade(null);
    setLocked(false);
    setAssisted(false);
  }

  return { grade, locked, assisted, check, reveal, reset, fresh };
}

export function Feedback({ grade }: { grade: Grade | null }) {
  if (!grade) return null;
  const status = grade.revealed ? 'Answer guide · unscored'
    : grade.correct ? 'Correct'
      : 'Not quite';
  const cls = grade.revealed ? 'trainer-feedback trainer-feedback-reveal'
    : grade.correct ? 'feedback correct trainer-feedback'
      : 'feedback incorrect trainer-feedback';
  return (
    <div className={cls} role="status" aria-live="polite">
      <strong>{status}</strong>
      {!grade.revealed && !grade.counted && <span className="trainer-feedback-score">Practice · not scored</span>}
      <p><b>Expected:</b> {grade.expected}</p>
      <p>{grade.explanation}</p>
    </div>
  );
}
