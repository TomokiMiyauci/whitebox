/** Defines how two values are compared for equality. */
interface Equality<T> {
  /**
   * Determines whether two values are considered equal.
   *
   * @param left The first value to compare.
   * @param right The second value to compare.
   * @returns `true` when the values are equal.
   */
  equals(left: T, right: T): boolean;
}

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
  /** The graph connecting reactive dependencies to their effects. */
  readonly #graph = new Graph<WeakKey, Effect>();

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
   * @param effect The effect whose dependencies changed.
   * @param next The effect's new dependency keys.
   */
  updateDependencies(effect: Effect, next: ReadonlySet<WeakKey>): void {
    const previous = this.#graph.getReverse(effect);

    for (const ref of previous) {
      if (!next.has(ref)) {
        this.#graph.delete(ref, effect);
      }
    }

    for (const ref of next) {
      if (!previous.has(ref)) {
        this.#graph.add(ref, effect);
      }
    }
  }

  /**
   * Notifies observers about effects that depend on the given reactive value.
   *
   * @param ref The reactive value that changed.
   */
  notifyChange(ref: WeakKey): void {
    for (const effect of this.#graph.get(ref)) {
      this.dispatchEvent(
        new CustomEvent("invalidate", { detail: () => effect.run() }),
      );
    }
  }
}

/** Stores a value and provides a customizable equality check for updates. */
export class State<T> implements Equality<T> {
  /** The value currently stored by this state. */
  #current: T;

  /**
   * Creates a state with an initial value.
   *
   * @param current The initial value.
   */
  constructor(current: T) {
    this.#current = current;
  }

  /** Gets the current value. */
  get get(): T {
    return this.#current;
  }

  /**
   * Updates the value if it is not equal to the current value.
   *
   * @param value The value to store.
   * @returns `true` if the value changed; otherwise, `false`.
   */
  set(value: T): boolean {
    if (this.equals(this.#current, value)) {
      return false;
    }

    this.#current = value;

    return true;
  }

  /**
   * Compares values using `Object.is`.
   *
   * Override this method to customize the equality check.
   *
   * @param left The current value.
   * @param right The proposed value.
   * @returns `true` if the values are equal.
   */
  equals(left: T, right: T): boolean {
    return Object.is(left, right);
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
      this.#context.notifyChange(this);
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
 * A directed graph that maintains relationships between two types of nodes.
 *
 * Stores edges from {@link T} to {@link U} and supports lookups in both directions.
 */
export class Graph<T extends WeakKey, U extends WeakKey> {
  /** The forward adjacency map from source nodes to target nodes. */
  #forward = new WeakMap<T, Set<U>>();

  /** The reverse adjacency map from target nodes to source nodes. */
  #reverse = new WeakMap<U, Set<T>>();

  /**
   * Adds a directed edge from {@link from} to {@link to}.
   *
   * @param from The source node.
   * @param to The target node.
   */
  add(from: T, to: U): void {
    let targets = this.#forward.get(from);
    if (!targets) {
      targets = new Set();
      this.#forward.set(from, targets);
    }

    let sources = this.#reverse.get(to);
    if (!sources) {
      sources = new Set();
      this.#reverse.set(to, sources);
    }

    targets.add(to);
    sources.add(from);
  }

  /**
   * Removes the directed edge from {@link from} to {@link to}.
   *
   * @param from The source node.
   * @param to The target node.
   */
  delete(from: T, to: U): void {
    const targets = this.#forward.get(from);
    const sources = this.#reverse.get(to);

    targets?.delete(to);
    sources?.delete(from);
  }

  /**
   * Returns the target nodes connected from the given source node.
   *
   * @param from The source node.
   * @returns The set of target nodes connected from {@link from}.
   */
  get(from: T): ReadonlySet<U> {
    return this.#forward.get(from) ?? new Set();
  }

  /**
   * Returns the source nodes connected to the given target node.
   *
   * @param to The target node.
   * @returns The set of source nodes connected to {@link to}.
   */
  getReverse(to: U): ReadonlySet<T> {
    return this.#reverse.get(to) ?? new Set();
  }
}

/** Runs a function and tracks the signals read while it is running. */
export class Effect {
  /** The function executed by this effect. */
  #fn: VoidFunction;

  /** The context that tracks this effect and its dependencies. */
  #context: ReactiveContext;

  /** Whether this effect has been stopped. */
  #stopped = false;

  /**
   * Creates an effect in a reactive context.
   *
   * @param context The context that manages this effect.
   * @param fn The function to execute and track.
   */
  constructor(context: ReactiveContext, fn: VoidFunction) {
    this.#fn = fn;
    this.#context = context;
  }

  /** Executes the effect while collecting its signal dependencies. */
  run(): void {
    if (this.#stopped) return;

    const { dependencies } = this.#context.capture(this.#fn);

    if (!this.#stopped) {
      this.#context.updateDependencies(this, dependencies);
    }
  }

  /** Stops the effect and removes its dependencies. */
  stop(): void {
    if (this.#stopped) return;

    this.#stopped = true;
    this.#context.updateDependencies(this, new Set());
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
   * @param fn The callback invoked with the invalidated effect's reaction.
   * @returns A function that removes the event listener.
   */
  observe(fn: (action: VoidFunction) => void): VoidFunction {
    function handle(ev: CustomEvent<VoidFunction>): void {
      fn(ev.detail);
    }

    this.#context.addEventListener("invalidate", handle);

    return () => {
      this.#context.removeEventListener("invalidate", handle);
    };
  }
}

/** The constructors exposed by a context-bound reactive system. */
export interface ReactiveSystem {
  /** Constructs signals that use the system's reactive context. */
  Signal: SignalConstructor;

  /** Constructs effects that use the system's reactive context. */
  Effect: EffectConstructor;

  /** Constructs observers that use the system's reactive context. */
  Observer: ObserverConstructor;
}

/** Constructor type for signals bound to a reactive context. */
export interface SignalConstructor {
  /**
   * Creates a signal with an initial value.
   *
   * @param init The initial value.
   */
  new <T>(init: T): Signal<T>;
}

/** Constructor type for effects bound to a reactive context. */
export interface EffectConstructor {
  /**
   * Creates an effect with a function to execute.
   *
   * @param fn The function to execute and track.
   */
  new (fn: VoidFunction): Effect;
}

/** Constructor type for observers bound to a reactive context. */
export interface ObserverConstructor {
  new (): Observer;
}

/**
 * Creates signal, effect, and observer constructors that share a reactive context.
 *
 * @returns Constructors bound to the created reactive context.
 */
export function createReactiveSystem(): ReactiveSystem {
  const context = new ReactiveContext();

  return {
    Signal: Signal.bind(null, context) as SignalConstructor,
    Effect: Effect.bind(null, context),
    Observer: Observer.bind(null, context),
  };
}
