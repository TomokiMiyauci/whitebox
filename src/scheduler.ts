export interface Scheduler {
  schedule(task: VoidFunction): void;
}

export class MicrotaskScheduler implements Scheduler {
  readonly #queue = new Set<VoidFunction>();
  #scheduled = false;

  schedule(task: VoidFunction): void {
    this.#queue.add(task);

    if (this.#scheduled) return;

    this.#scheduled = true;
    queueMicrotask(() => this.#flush());
  }

  #flush(): void {
    const tasks = [...this.#queue];
    this.#queue.clear();
    this.#scheduled = false;

    for (const task of tasks) {
      task();
    }
  }
}
