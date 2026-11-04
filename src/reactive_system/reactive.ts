import { BiMultiMap } from "./collection.ts";
import { State } from "./state.ts";

/** Defines the event types emitted by a reactive context. */
interface EventMap {
  /** Dispatched when a dependency invalidates a reactive action. */
  invalidate: CustomEvent<VoidFunction>;
}

/** A reactive context with strongly typed event listeners. */
export interface ReactiveContext extends EventTarget {
  addEventListener<K extends keyof EventMap>(
    type: K,
    listener: (ev: EventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof EventMap>(
    type: K,
    listener: (ev: EventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

/** Tracks reactive dependencies and dispatches events when actions are invalidated. */
export class ReactiveContext extends EventTarget {
  /** Maps reactive dependencies to the actions that depend on them. */
  readonly #map = new BiMultiMap<WeakKey, VoidFunction>();

  /** Dependencies collected by the current capture operation, if any. */
  #activeDependencies: Set<WeakKey> | undefined;

  /**
   * Runs a function while collecting its dependency keys.
   *
   * @param fn The function to execute.
   * @returns The function result and the dependency keys read during execution.
   */
  capture<T>(fn: () => T): { value: T; dependencies: Set<WeakKey> } {
    const previousDependencies = this.#activeDependencies;
    const dependencies = new Set<WeakKey>();
    this.#activeDependencies = dependencies;

    try {
      return { value: fn(), dependencies };
    } finally {
      this.#activeDependencies = previousDependencies;
    }
  }

  /**
   * Records a dependency for the current capture operation.
   *
   * @param ref The reactive value being tracked.
   */
  track(ref: WeakKey): void {
    this.#activeDependencies?.add(ref);
  }

  /**
   * Updates the dependencies associated with an action.
   *
   * @param callback The action whose dependencies are being updated.
   * @param next The action's new dependency keys.
   */
  updateDependencies(callback: VoidFunction, next: ReadonlySet<WeakKey>): void {
    const previous = this.#map.getReverse(callback);

    for (const ref of previous) {
      if (!next.has(ref)) {
        this.#map.delete(ref, callback);
      }
    }

    for (const ref of next) {
      if (!previous.has(ref)) {
        this.#map.add(ref, callback);
      }
    }
  }

  /**
   * Dispatches invalidation events for actions that depend on the given value.
   *
   * @param ref The reactive value that changed.
   */
  trigger(ref: WeakKey): void {
    for (const effect of this.#map.get(ref)) {
      this.dispatchEvent(new CustomEvent("invalidate", { detail: effect }));
    }
  }
}

/** A state that tracks reads and notifies dependent actions when its value changes. */
export class Signal<T> extends State<T> {
  /** The context used to track reads and notify dependent actions. */
  #context: ReactiveContext;

  /**
   * Creates a signal in a reactive context.
   *
   * @param context The context that manages dependencies.
   * @param current The initial value.
   */
  constructor(context: ReactiveContext, current: T) {
    super(current);

    this.#context = context;
  }

  /**
   * Updates the signal and notifies dependent actions when its value changes.
   *
   * @param value The value to store.
   * @returns `true` if the value changed; otherwise, `false`.
   */
  override set(value: T): boolean {
    const changed = super.set(value);

    if (changed) {
      this.#context.trigger(this);
    }

    return changed;
  }

  /** Gets the current value and records the signal as a dependency. */
  override get get(): T {
    this.#context.track(this);
    return super.get;
  }
}

/**
 * A function executed by an effect.
 */
export interface Action {
  /**
   * @param onCleanup Registers a callback to run before the next execution or when the effect stops.
   */
  (onCleanup: RegisterCleanup): void;
}

/** Registers a cleanup callback for an effect. */
export interface RegisterCleanup {
  /**
   * Registers a callback to clean up resources created during an action execution.
   *
   * @param callback The cleanup callback to execute before the next action execution or when the effect stops.
   */
  (callback: VoidFunction): void;
}

/** Manages the execution, dependencies, and cleanup of a reactive action. */
export class Effect {
  /** The context that tracks this effect and its dependencies. */
  #context: ReactiveContext;

  /** Whether this effect has been stopped. */
  #stopped = false;

  /** Executes the action while collecting its dependencies. */
  #run: VoidFunction;

  /** Cleanup callbacks registered by the current action execution. */
  #cleanups: VoidFunction[] = [];

  /**
   * Creates and immediately executes an effect in a reactive context.
   *
   * @param context The context that manages dependencies.
   * @param action The action to execute and track.
   */
  constructor(context: ReactiveContext, action: Action) {
    const run = (): void => {
      if (this.#stopped) return;

      this.#cleanup();

      const onCleanup = (callback: VoidFunction) => {
        this.#cleanups.push(callback);
      };

      const callback = () => {
        action(onCleanup);
      };

      const { dependencies } = context.capture(callback);
      context.updateDependencies(run, dependencies);
    };

    this.#context = context;
    this.#run = run;

    run();
  }

  /**
   * Executes and clears the cleanup callbacks from the previous action execution.
   */
  #cleanup(): void {
    for (const cleanup of this.#cleanups) {
      cleanup();
    }
    this.#cleanups = [];
  }

  /**
   * Stops the effect, removes its dependencies, and executes remaining cleanup callbacks.
   */
  stop(): void {
    if (this.#stopped) return;

    this.#stopped = true;
    this.#context.updateDependencies(this.#run, new Set());

    this.#cleanup();
  }
}

/** Subscribes to invalidation events from a reactive context. */
export class Observer {
  /** The reactive context observed by this observer. */
  #context: ReactiveContext;

  /**
   * Creates an observer for a reactive context.
   *
   * @param context The context to observe.
   */
  constructor(context: ReactiveContext) {
    this.#context = context;
  }

  /**
   * Subscribes to effect invalidation notifications.
   *
   * @param fn The callback invoked with the invalidated action.
   * @returns A function that removes the event listener.
   */
  observe(fn: (callback: VoidFunction) => void): VoidFunction {
    function handle(ev: CustomEvent<VoidFunction>): void {
      fn(ev.detail);
    }

    this.#context.addEventListener("invalidate", handle);

    return () => {
      this.#context.removeEventListener("invalidate", handle);
    };
  }
}
