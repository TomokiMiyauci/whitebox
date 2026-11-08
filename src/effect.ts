import { Signal } from "./signal/mod.ts";

/**
 * Schedules a task for execution.
 */
export interface Scheduler {
  /**
   * Schedules a task for execution.
   *
   * @param task The task to schedule.
   */
  schedule(task: VoidFunction): void;
}

type EffectLifecycleState = "running" | "paused" | "stopped";

/**
 * Represents the lifecycle state of an effect.
 *
 * Lifecycle states are immutable singleton values.
 */
export class EffectLifecycle {
  readonly #state: EffectLifecycleState;

  private constructor(state: EffectLifecycleState) {
    this.#state = state;
  }

  /** The running lifecycle state. */
  static readonly running = new EffectLifecycle("running");

  /** The paused lifecycle state. */
  static readonly paused = new EffectLifecycle("paused");

  /** The stopped lifecycle state. */
  static readonly stopped = new EffectLifecycle("stopped");

  /** Whether the effect is running. */
  get isRunning(): boolean {
    return this.#state === "running";
  }

  /** Whether the effect is paused. */
  get isPaused(): boolean {
    return this.#state === "paused";
  }

  /** Whether the effect is stopped. */
  get isStopped(): boolean {
    return this.#state === "stopped";
  }

  /**
   * Transitions a lifecycle state to paused.
   *
   * Only a running state can be paused.
   *
   * @param lifecycle The current lifecycle state.
   * @returns The paused state if the current state is running; otherwise, the current state.
   */
  static pause(lifecycle: EffectLifecycle): EffectLifecycle {
    return lifecycle.isRunning ? this.paused : lifecycle;
  }

  /**
   * Transitions a lifecycle state to running.
   *
   * Only a paused state can be resumed.
   *
   * @param lifecycle The current lifecycle state.
   * @returns The running state if the current state is paused; otherwise, the current state.
   */
  static resume(lifecycle: EffectLifecycle): EffectLifecycle {
    return lifecycle.isPaused ? this.running : lifecycle;
  }

  /**
   * Transitions a lifecycle state to stopped.
   *
   * A stopped state cannot be resumed.
   *
   * @param lifecycle The current lifecycle state.
   * @returns The stopped state.
   */
  static stop(lifecycle: EffectLifecycle): EffectLifecycle {
    return lifecycle.isStopped ? lifecycle : this.stopped;
  }
}

/**
 * Manages the reactive execution lifecycle of an action.
 *
 * An effect tracks the signals accessed by its action and schedules
 * subsequent executions when those signals change.
 */
export class Effect {
  #scheduler: Scheduler;
  #computed: Signal.Computed<void>;
  #watcher: Signal.subtle.Watcher;
  #lifecycle = EffectLifecycle.running;
  #run: () => void;

  private constructor(action: VoidFunction, scheduler: Scheduler) {
    this.#scheduler = scheduler;

    this.#computed = new Signal.Computed(action);

    const run = (): void => {
      if (!this.#lifecycle.isRunning) return;

      this.#computed.get();

      for (const signal of this.#watcher.getPending()) {
        signal.get();
      }

      this.#watcher.watch(this.#computed);
    };

    this.#watcher = new Signal.subtle.Watcher(() => {
      this.#scheduler.schedule(run);
    });
    this.#run = run;
  }

  /**
   * Creates and immediately starts an effect.
   *
   * The action is executed synchronously before this method returns.
   *
   * @param action The action to execute and track.
   * @param scheduler The scheduler used for subsequent executions.
   * @returns The started effect instance.
   */
  static start(action: VoidFunction, scheduler: Scheduler): Effect {
    const effect = new Effect(action, scheduler);
    effect.#run();

    return effect;
  }

  /**
   * Pauses the effect.
   *
   * Scheduled executions are ignored while the effect is paused.
   */
  pause(): void {
    this.#lifecycle = EffectLifecycle.pause(this.#lifecycle);
  }

  /**
   * Resumes a paused effect.
   *
   * The action is executed immediately to update its dependencies
   * and reflect the latest signal values.
   */
  resume(): void {
    if (!this.#lifecycle.isPaused) return;

    this.#lifecycle = EffectLifecycle.resume(this.#lifecycle);
    this.#run();
  }

  /**
   * Stops the effect permanently.
   *
   * The effect no longer observes its dependencies or executes its action.
   */
  stop(): void {
    if (this.#lifecycle.isStopped) return;

    this.#lifecycle = EffectLifecycle.stop(this.#lifecycle);
    this.#watcher.unwatch(this.#computed);
  }
}
