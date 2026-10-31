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

/** Tracks reactive effects and schedules them when their dependencies change. */
export class ReactiveContext {
  /** Effects subscribed to each dependency key. */
  readonly #subscribers = new WeakMap<WeakKey, Set<Effect>>();

  /** Dependencies collected by the current capture operation, if any. */
  #activeDependencies: Set<WeakKey> | undefined;

  /** Schedules an effect action after one of its dependencies changes. */
  #onChange: (action: VoidFunction) => void;

  /**
   * Creates a reactive context.
   *
   * @param onChange Schedules the supplied action for execution.
   */
  constructor(onChange: (action: VoidFunction) => void) {
    this.#onChange = onChange;
  }

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
   * @param previous The effect's previous dependency keys.
   * @param next The effect's new dependency keys.
   */
  updateDependencies(
    effect: Effect,
    previous: ReadonlySet<WeakKey>,
    next: ReadonlySet<WeakKey>,
  ): void {
    for (const ref of previous) {
      if (next.has(ref)) continue;

      const subscribers = this.#subscribers.get(ref);
      subscribers?.delete(effect);

      if (subscribers?.size === 0) {
        this.#subscribers.delete(ref);
      }
    }

    for (const ref of next) {
      if (previous.has(ref)) continue;

      let subscribers = this.#subscribers.get(ref);
      if (!subscribers) {
        subscribers = new Set();
        this.#subscribers.set(ref, subscribers);
      }

      subscribers.add(effect);
    }
  }

  /**
   * Schedules effects that depend on the given reactive value.
   *
   * @param ref The reactive value that changed.
   */
  notifyChange(ref: WeakKey): void {
    const subscribers = this.#subscribers.get(ref);
    if (!subscribers) return;

    for (const effect of subscribers) {
      this.#onChange(effect.scheduledRun);
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

/** Runs a function and tracks the signals read while it is running. */
export class Effect {
  /** Reactive values read by this effect. */
  #deps = new Set<WeakKey>();

  /** The function executed by this effect. */
  #fn: VoidFunction;

  /** The context that tracks this effect and its dependencies. */
  #context: ReactiveContext;

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

  /** An action that runs this effect; suitable for passing to a scheduler. */
  readonly scheduledRun: VoidFunction = () => {
    this.run();
  };

  /** Executes the effect while collecting its signal dependencies. */
  run(): void {
    const prevDeps = this.#deps;
    const { dependencies } = this.#context.capture(this.#fn);

    this.#context.updateDependencies(this, prevDeps, dependencies);
    this.#deps = dependencies;
  }
}

/** The constructors exposed by a context-bound reactive system. */
export interface ReactiveSystem {
  /** Constructs signals that use the system's reactive context. */
  Signal: SignalConstructor;

  /** Constructs effects that use the system's reactive context. */
  Effect: EffectConstructor;
}

/** Constructor type for signals bound to a reactive context. */
export interface SignalConstructor {
  /**
   * Creates a signal with an initial value.
   *
   * @param init The signal's initial value.
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

/**
 * Creates signal and effect constructors that share a reactive context.
 *
 * @param onChange Schedules effect actions when their dependencies change.
 * @returns Constructors bound to the created reactive context.
 */
export function createReactiveSystem(
  onChange: (action: VoidFunction) => void,
): ReactiveSystem {
  const context = new ReactiveContext(onChange);

  return {
    Signal: Signal.bind(null, context) as SignalConstructor,
    Effect: Effect.bind(null, context),
  };
}
