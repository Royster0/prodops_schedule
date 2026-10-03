import type { ChangeOp, ScheduleData } from '../domain/types';
import type { ScheduleRepository } from './repository';

/**
 * The app's repository. It starts as the browser one and switches to Supabase once
 * someone signs in, before the store loads anything.
 */
export class SwitchableRepository implements ScheduleRepository {
  private target: ScheduleRepository;

  constructor(target: ScheduleRepository) {
    this.target = target;
  }

  use(target: ScheduleRepository): void {
    this.target = target;
  }

  get savedLabel(): string {
    return this.target.savedLabel;
  }

  get errorLabel(): string | undefined {
    return this.target.errorLabel;
  }

  get readOnly(): boolean {
    return this.target.readOnly ?? false;
  }

  load(): Promise<ScheduleData> {
    return this.target.load();
  }

  apply(ops: ChangeOp[]): Promise<void> {
    return this.target.apply(ops);
  }

  subscribe(onChange: (data: ScheduleData) => void): () => void {
    return this.target.subscribe?.(onChange) ?? (() => {});
  }

  flush(): void {
    this.target.flush?.();
  }
}
