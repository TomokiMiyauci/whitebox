import { Signal, Effect, Observer, ReactiveContext } from "./reactive.ts";

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
