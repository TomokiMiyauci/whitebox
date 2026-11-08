import type { Scheduler } from "./effect.ts";

/** Runs scheduled tasks in a microtask and deduplicates identical tasks. */
export class MicrotaskScheduler implements Scheduler {
  /** Tasks waiting to be run. A set prevents the same task being queued twice. */
  readonly #queue = new Set<VoidFunction>();

  /** Whether a queue flush has already been scheduled. */
  #scheduled = false;

  /**
   * Adds a task to the queue and schedules a microtask flush if needed.
   *
   * @param task The task to schedule.
   */
  schedule(task: VoidFunction): void {
    this.#queue.add(task);

    if (this.#scheduled) return;

    this.#scheduled = true;
    queueMicrotask(() => this.#flush());
  }

  /** Runs the queued tasks and resets the queue for subsequent scheduling. */
  #flush(): void {
    const tasks = [...this.#queue];
    this.#queue.clear();
    this.#scheduled = false;

    for (const task of tasks) {
      task();
    }
  }
}
