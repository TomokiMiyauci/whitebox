import Signal from "./signal/mod.ts";

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

export interface EffectController {
  /**
   * Pauses the effect.
   *
   * Scheduled executions are ignored while the effect is paused.
   */
  pause(): void;

  /**
   * Resumes a paused effect.
   *
   * The action is executed immediately to update its dependencies
   * and reflect the latest signal values.
   */
  resume(): void;

  /**
   * Stops the effect permanently.
   *
   * The effect no longer observes its dependencies or executes its action.
   */
  stop(): void;
}

/**
 * Creates and starts a reactive effect.
 *
 * @param action The action to execute and track.
 * @param scheduler The scheduler used for subsequent executions.
 * @returns The effect controller.
 */
export function effect(
  action: VoidFunction,
  scheduler: Scheduler,
): EffectController {
  const computed = new Signal.Computed(action);

  // Assigned after the Effect instance is created.
  // The watcher schedules this lifecycle-aware execution.
  let start: VoidFunction;

  const watcher = new Signal.subtle.Watcher(() => {
    scheduler.schedule(start);
  });

  function watch(): void {
    computed.get();

    // Consume pending signals before registering the computed again.
    for (const signal of watcher.getPending()) {
      signal.get();
    }

    watcher.watch(computed);
  }

  function unwatch(): void {
    watcher.unwatch(computed);
  }

  const instance = new Effect(watch, unwatch);
  start = instance.start.bind(instance);

  // Execute the action synchronously for initial dependency tracking.
  start();

  return {
    stop: instance.stop.bind(instance),
    resume: instance.resume.bind(instance),
    pause: instance.pause.bind(instance),
  };
}

/**
 * Manages the reactive execution lifecycle of an action.
 *
 * An effect tracks the signals accessed by its action and schedules
 * subsequent executions when those signals change.
 */
export class Effect implements EffectController {
  #lifecycle = EffectLifecycle.running;

  constructor(
    private onStart: VoidFunction,
    private onEnd: VoidFunction,
  ) {}

  start(): void {
    // Ignore scheduled executions while paused or after stopping.
    if (!this.#lifecycle.isRunning) return;

    this.onStart();
  }

  pause(): void {
    this.#lifecycle = EffectLifecycle.pause(this.#lifecycle);
  }

  resume(): void {
    if (!this.#lifecycle.isPaused) return;

    this.#lifecycle = EffectLifecycle.resume(this.#lifecycle);
    // Re-execute immediately to refresh dependencies and reflect current values.
    this.start();
  }

  stop(): void {
    if (this.#lifecycle.isStopped) return;

    this.#lifecycle = EffectLifecycle.stop(this.#lifecycle);
    this.onEnd();
  }
}
