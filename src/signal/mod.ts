import { WeakBiMap } from "./map.ts";
import { Signal as Ponyfill } from "signal-polyfill";

/**
 * Signal API compliant with [TC39 proposal signals](https://github.com/tc39/proposal-signals).
 *
 * @example Basic
 * ```ts
 * import Signal from "@whitebox/core/signal";
 *
 * const theme = new Signal.State<"light" | "dark">("light");
 * const isDark = new Signal.Computed(() => theme.get() === "dark");
 *
 * theme.set("dark");
 *
 * console.log(isDark.get()); // true
 * ```
 *
 * @module
 */

/**
 * A reactive value.
 */
interface Signal<T> {
  /**
   * Returns the current value of the signal.
   */
  get(): T;
}

namespace Signal {
  /**
   * A mutable signal that holds a value.
   */
  export class State<T> implements Signal<T> {
    #impl: Ponyfill.State<T>;

    /**
     * Creates a state signal.
     *
     * @param initialValue The initial value of the signal.
     * @param options The options for configuring the signal.
     */
    constructor(initialValue: T, options: SignalOptions<T> = {}) {
      this.#impl = new Ponyfill.State(
        initialValue,
        toPonyfillOptions(this, options),
      );

      nodes.set(this, this.#impl);
    }

    /**
     * Returns the current value of the signal.
     */
    get(): T {
      return this.#impl.get();
    }

    /**
     * Sets the value of the signal.
     *
     * Dependent computations are invalidated when the new value is not
     * considered equal to the current value.
     *
     * @param t The new value.
     */
    set(t: T): void {
      this.#impl.set(t);
    }
  }

  /**
   * A read-only signal whose value is derived from other signals.
   *
   * Its dependencies are tracked automatically when its callback is evaluated.
   */
  export class Computed<T> implements Signal<T> {
    #impl: Ponyfill.Computed<T>;

    /**
     * Creates a computed signal.
     *
     * The callback is invoked with this computed signal as its `this` value.
     *
     * @param cb The callback that computes the signal's value.
     * @param options The options for configuring the signal.
     */
    constructor(cb: (this: Computed<T>) => T, options: SignalOptions<T> = {}) {
      this.#impl = new Ponyfill.Computed(
        cb.bind(this),
        toPonyfillOptions(this, options),
      );

      nodes.set(this, this.#impl);
    }

    /**
     * Returns the current value of the signal.
     */
    get(): T {
      return this.#impl.get();
    }
  }

  /**
   * Low-level APIs for controlling and inspecting signal dependency tracking.
   */
  export namespace subtle {
    /**
     * Executes a callback without tracking signal reads.
     *
     * @param cb The callback to execute.
     * @returns The callback's return value.
     */
    export function untrack<T>(cb: () => T): T {
      return Ponyfill.subtle.untrack(cb);
    }

    /**
     * Returns the computed signal currently being evaluated.
     *
     * @returns The current computed signal, or `null` if none is being evaluated.
     */
    export function currentComputed(): Computed<unknown> | null {
      const computed = Ponyfill.subtle.currentComputed();

      return computed ? (toPublicSignal(computed) as Computed<unknown>) : null;
    }

    /**
     * Returns the signals referenced by a computed signal during its last evaluation
     * or watched by a watcher.
     *
     * @param sink The computed signal or watcher to inspect.
     * @returns The source signals of the specified sink.
     */
    export function introspectSources(
      sink: Computed<unknown> | Watcher,
    ): (State<unknown> | Computed<unknown>)[] {
      return Ponyfill.subtle
        .introspectSources(toPonyfillSink(sink))
        .map(toPublicSignal);
    }

    /**
     * Returns the live sinks that depend on a signal.
     *
     * @param source The signal to inspect.
     * @returns The sinks that depend on the specified signal.
     */
    export function introspectSinks(
      source: State<unknown> | Computed<unknown>,
    ): (Computed<unknown> | Watcher)[] {
      return Ponyfill.subtle
        .introspectSinks(toPonyfillSignal(source))
        .map(toPublicSink);
    }

    /**
     * Determines whether a signal has any live dependents.
     *
     * A signal is live if it is watched by a watcher or is a dependency
     * of a computed signal that is recursively watched.
     *
     * @param source The signal to inspect.
     */
    export function hasSinks(
      source: State<unknown> | Computed<unknown>,
    ): boolean {
      return Ponyfill.subtle.hasSinks(toPonyfillSignal(source));
    }

    /**
     * Determines whether a computed signal or watcher has any sources.
     *
     * @param sink The computed signal or watcher to inspect.
     */
    export function hasSources(sink: Computed<unknown> | Watcher): boolean {
      return Ponyfill.subtle.hasSources(toPonyfillSink(sink));
    }

    /**
     * Observes signals and notifies when any of them or their dependencies change.
     */
    export class Watcher {
      #impl: Ponyfill.subtle.Watcher;

      /**
       * Creates a watcher.
       *
       * The notification callback is invoked at most once between calls to {@link watch}.
       * Signal reads and writes are not allowed during notification.
       *
       * @param notify The callback to invoke when a watched signal changes.
       */
      constructor(notify: (this: Watcher) => void) {
        this.#impl = new Ponyfill.subtle.Watcher(() => {
          notify.call(this);
        });

        nodes.set(this, this.#impl);
      }

      /**
       * Adds signals to the watched set.
       *
       * Calling this method without arguments resets the notification state
       * without changing the watched set.
       *
       * @param signals The signals to watch.
       */
      watch(...signals: Signal<unknown>[]): void {
        this.#impl.watch(...signals.map(toPonyfillSignal));
      }

      /**
       * Removes signals from the watched set.
       *
       * @param signals The signals to stop watching.
       */
      unwatch(...signals: Signal<unknown>[]): void {
        this.#impl.unwatch(...signals.map(toPonyfillSignal));
      }

      /**
       * Returns the source signals that are still dirty or pending.
       */
      getPending(): Signal<unknown>[] {
        return this.#impl.getPending().map(toPublicSignal);
      }
    }

    /**
     * Called when a signal transitions from having no sinks to having at least one sink.
     */
    export const watched = Symbol("watched");

    /**
     * Called when a signal transitions from having at least one sink to having no sinks.
     */
    export const unwatched = Symbol("unwatched");
  }

  /**
   * Options for configuring a signal.
   */
  export interface SignalOptions<T> {
    /**
     * Compares two values for equality.
     *
     * @default Object.is
     * @param t The current value.
     * @param t2 The new value.
     * @returns `true` if the values are considered equal.
     */
    equals?: (this: Signal<T>, t: T, t2: T) => boolean;

    /**
     * Called when the signal transitions from having no sinks to having at least one sink.
     */
    [Signal.subtle.watched]?: (this: Signal<T>) => void;

    /**
     * Called when the signal transitions from having at least one sink to having no sinks.
     */
    [Signal.subtle.unwatched]?: (this: Signal<T>) => void;
  }
}

// Internal implementation mappings
type PonyfillSignal = Ponyfill.State<unknown> | Ponyfill.Computed<unknown>;

type PonyfillNode = PonyfillSignal | Ponyfill.subtle.Watcher;

type PublicSignal = Signal.State<unknown> | Signal.Computed<unknown>;

type PublicNode = PublicSignal | Signal.subtle.Watcher;

const nodes = new WeakBiMap<PublicNode, PonyfillNode>();

// Internal type guards

function isPublicSignal(value: unknown): value is PublicSignal {
  return value instanceof Signal.State || value instanceof Signal.Computed;
}

function isPublicSink(
  value: unknown,
): value is Signal.Computed<unknown> | Signal.subtle.Watcher {
  return (
    value instanceof Signal.Computed || value instanceof Signal.subtle.Watcher
  );
}

function isPonyfillSignal(value: PonyfillNode): value is PonyfillSignal {
  return value instanceof Ponyfill.State || value instanceof Ponyfill.Computed;
}

function isPonyfillSink(
  value: PonyfillNode,
): value is Ponyfill.Computed<unknown> | Ponyfill.subtle.Watcher {
  return (
    value instanceof Ponyfill.Computed ||
    value instanceof Ponyfill.subtle.Watcher
  );
}

// Internal registration and conversion functions

function toPonyfillSignal(signal: Signal<unknown>): PonyfillSignal {
  if (!isPublicSignal(signal)) {
    throw new TypeError("Expected a Signal instance");
  }

  const impl = nodes.get(signal);

  if (!impl || !isPonyfillSignal(impl)) {
    throw new TypeError("Expected a State or Computed instance");
  }

  return impl;
}

function toPonyfillSink(
  sink: Signal.Computed<unknown> | Signal.subtle.Watcher,
): Ponyfill.Computed<unknown> | Ponyfill.subtle.Watcher {
  if (!isPublicSink(sink)) {
    throw new TypeError("Expected a Computed or Watcher instance");
  }

  const impl = nodes.get(sink);

  if (!impl || !isPonyfillSink(impl)) {
    throw new TypeError("Expected a Computed or Watcher instance");
  }

  return impl;
}

function toPublicSignal(impl: PonyfillSignal): PublicSignal {
  const wrapper = nodes.getKey(impl);

  if (!wrapper || !isPublicSignal(wrapper)) {
    throw new TypeError("Unknown internal Signal");
  }

  return wrapper;
}

function toPublicSink(
  impl: Ponyfill.Computed<unknown> | Ponyfill.subtle.Watcher,
): Signal.Computed<unknown> | Signal.subtle.Watcher {
  const wrapper = nodes.getKey(impl);

  if (!wrapper || !isPublicSink(wrapper)) {
    throw new TypeError("Unknown internal sink");
  }

  return wrapper;
}

function toPonyfillOptions<T>(
  owner: Signal<T>,
  options: Signal.SignalOptions<T>,
): Ponyfill.Options<T> {
  const result: Ponyfill.Options<T> = {};

  if (options.equals) {
    result.equals = (t, t2) => options.equals!.call(owner, t, t2);
  }

  const watched = options[Signal.subtle.watched];

  if (watched) {
    result[Ponyfill.subtle.watched] = () => watched.call(owner);
  }

  const unwatched = options[Signal.subtle.unwatched];

  if (unwatched) {
    result[Ponyfill.subtle.unwatched] = () => unwatched.call(owner);
  }

  return result;
}

export default Signal;
