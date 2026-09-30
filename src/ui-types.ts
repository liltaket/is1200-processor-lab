import type { Topic } from './engine/types';
import type { Progress } from './learning';

export interface ModeProps {
  onAttempt: (topic: Topic, correct: boolean) => void;
  progress: Progress;
  guided?: boolean;
}
