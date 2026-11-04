import { BiMultiMap } from "./collection.ts";
import { State } from "./state.ts";

/** Defines the event types emitted by a reactive context. */
interface EventMap {
  /** Dispatched when a reactive effect is invalidated. */
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

/** Tracks reactive dependencies and dispatches events when effects are invalidated. */
export class ReactiveContext extends EventTarget {
  /** The map connecting reactive dependencies to their effects. */
  readonly #map = new BiMultiMap<WeakKey, VoidFunction>();

  /** Dependencies collected by the current capture operation, if any. */
  #activeDependencies: Set<WeakKey> | undefined;

  /**
   * Runs a function while collecting its dependency keys.
   *
   * @param fn The function to run.
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
   * Records a dependency on the currently active effect.
   *
   * @param ref The reactive value being read.
   */
  track(ref: WeakKey): void {
    this.#activeDependencies?.add(ref);
  }

  /**
   * Updates the effects subscribed to a dependency set.
   *
   * @param callback The effect whose dependencies changed.
   * @param next The effect's new dependency keys.
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
   * Notifies observers about effects that depend on the given reactive value.
   *
   * @param ref The reactive value that changed.
   */
  trigger(ref: WeakKey): void {
    for (const effect of this.#map.get(ref)) {
      this.dispatchEvent(new CustomEvent("invalidate", { detail: effect }));
    }
  }
}

/** A state that tracks reads and notifies effects when its value changes. */
export class Signal<T> extends State<T> {
  /** The context used to track reads and notify dependent effects. */
  #context: ReactiveContext;

  /**
   * Creates a signal in a reactive context.
   *
   * @param context The context that manages dependent effects.
   * @param current The initial value.
   */
  constructor(context: ReactiveContext, current: T) {
    super(current);

    this.#context = context;
  }

  /**
   * Updates the signal and notifies dependent effects when it changes.
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

export interface Action {
  (): void;
}

/** Manages the execution and dependencies of a reactive action. */
export class Effect {
  /** The context that tracks this effect and its dependencies. */
  #context: ReactiveContext;

  /** Whether this effect has been stopped. */
  #stopped = false;

  /** Executes the effect while collecting its signal dependencies. */
  #run: () => void;

  /**
   * Creates an effect in a reactive context.
   *
   * @param context The context that manages this effect.
   * @param action The function to execute and track.
   */
  constructor(context: ReactiveContext, action: Action) {
    const run = (): void => {
      if (this.#stopped) return;

      const { dependencies } = context.capture(action);
      context.updateDependencies(run, dependencies);
    };

    this.#context = context;
    this.#run = run;

    run();
  }

  /** Stops the effect and removes its dependencies. */
  stop(): void {
    if (this.#stopped) return;

    this.#stopped = true;
    this.#context.updateDependencies(this.#run, new Set());
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
