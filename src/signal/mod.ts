import { Signal as Ponyfill } from "signal-polyfill";

export interface Signal<T> {
  // Get the value of the signal
  get(): T;
}

// Internal implementation mappings
type PonyfillSignal = Ponyfill.State<unknown> | Ponyfill.Computed<unknown>;

type PublicSignal = Signal.State<unknown> | Signal.Computed<unknown>;

const signalImpls = new WeakMap<object, PonyfillSignal>();
const signalWrappers = new WeakMap<object, PublicSignal>();

const watcherImpls = new WeakMap<object, Ponyfill.subtle.Watcher>();
const watcherWrappers = new WeakMap<object, Signal.subtle.Watcher>();

export namespace Signal {
  /**
   * A read-write Signal
   */
  export class State<T> implements Signal<T> {
    #impl: Ponyfill.State<T>;

    /**
     * Create a state Signal starting with the value {@link initialValue}
     * @param initialValue
     * @param options
     */
    constructor(initialValue: T, options: SignalOptions<T> = {}) {
      this.#impl = new Ponyfill.State(
        initialValue,
        toPonyfillOptions(this, options),
      );

      registerSignal(this, this.#impl);
    }

    /**
     * Get the value of the signal
     */
    get(): T {
      return this.#impl.get();
    }

    /**
     * Set the state Signal value to {@link t}.
     * @param t
     */
    set(t: T): void {
      this.#impl.set(t);
    }
  }

  export class Computed<T> implements Signal<T> {
    #impl: Ponyfill.Computed<T>;

    /**
     * Create a Signal which evaluates to the value returned by the callback.
     * Callback is called with this signal as the this value.
     * @param cb
     * @param options
     */
    constructor(cb: (this: Computed<T>) => T, options: SignalOptions<T> = {}) {
      this.#impl = new Ponyfill.Computed(
        cb.bind(this),
        toPonyfillOptions(this, options),
      );

      registerSignal(this, this.#impl);
    }

    get(): T {
      return this.#impl.get();
    }
  }

  export namespace subtle {
    /**
     * Run a callback with all tracking disabled
     * @param cb
     */
    export function untrack<T>(cb: () => T): T {
      return Ponyfill.subtle.untrack(cb);
    }

    /**
     * Get the current computed signal which is tracking any signal reads, if any.
     */
    export function currentComputed(): Computed<unknown> | null {
      const computed = Ponyfill.subtle.currentComputed();

      return computed ? (toPublicSignal(computed) as Computed<unknown>) : null;
    }

    /**
     * Returns ordered list of all signals which this one referenced
     * during the last time it was evaluated.
     * For a Watcher, lists the set of signals which it is watching.
     */
    export function introspectSources(
      sink: Computed<unknown> | Watcher,
    ): (State<unknown> | Computed<unknown>)[] {
      return Ponyfill.subtle
        .introspectSources(toPonyfillSink(sink))
        .map(toPublicSignal);
    }

    /**
     * Returns the Watchers that this signal is contained in, plus any
     * Computed signals which read this signal last time they were evaluated,
     * if that computed signal is (recursively) watched.
     * @param source
     */
    export function introspectSinks(
      source: State<unknown> | Computed<unknown>,
    ): (Computed<unknown> | Watcher)[] {
      return Ponyfill.subtle
        .introspectSinks(toPonyfillSignal(source))
        .map(toPublicSink);
    }

    /**
     * True if this signal is "live", in that it is watched by a Watcher,
     * or it is read by a Computed signal which is (recursively) live.
     * @param source
     */
    export function hasSinks(
      source: State<unknown> | Computed<unknown>,
    ): boolean {
      return Ponyfill.subtle.hasSinks(toPonyfillSignal(source));
    }

    /**
     * True if this element is "reactive", in that it depends
     * on some other signal. A Computed where hasSources is false
     * will always return the same constant.
     * @param sink
     */
    export function hasSources(sink: Computed<unknown> | Watcher): boolean {
      return Ponyfill.subtle.hasSources(toPonyfillSink(sink));
    }

    export class Watcher {
      #impl: Ponyfill.subtle.Watcher;

      /**
       * When a (recursive) source of Watcher is written to, call this callback,
       * if it hasn't already been called since the last `watch` call.
       * No signals may be read or written during the notify.
       * @param notify
       */
      constructor(notify: (this: Watcher) => void) {
        this.#impl = new Ponyfill.subtle.Watcher(() => {
          notify.call(this);
        });

        watcherImpls.set(this, this.#impl);
        watcherWrappers.set(this.#impl, this);
      }

      /**
       * Add these signals to the Watcher's set, and set the watcher to run its
       * notify callback next time any signal in the set (or one of its dependencies) changes.
       * Can be called with no arguments just to reset the "notified" state.
       * @param signals
       */
      watch(...signals: Signal<unknown>[]): void {
        this.#impl.watch(...signals.map(toPonyfillSignal));
      }

      /**
       * Remove these signals from the watched set.
       * @param signals
       */
      unwatch(...signals: Signal<unknown>[]): void {
        this.#impl.unwatch(...signals.map(toPonyfillSignal));
      }

      /**
       * Returns the set of sources in the Watcher's set which are still dirty,
       * or are Computed signals with a source which is dirty or pending.
       */
      getPending(): Signal<unknown>[] {
        return this.#impl.getPending().map(toPublicSignal);
      }
    }

    // Hooks to observe being watched or no longer watched
    export const watched = Symbol("watched");
    export const unwatched = Symbol("unwatched");
  }

  export interface SignalOptions<T> {
    // Custom comparison function between old and new value. Default: Object.is.
    // The signal is passed in as an optionally-used third parameter for context.
    equals?: (this: Signal<T>, t: T, t2: T) => boolean;

    // Callback called when hasSinks becomes true, if it was previously false
    [Signal.subtle.watched]?: (this: Signal<T>) => void;

    // Callback called whenever hasSinks becomes false, if it was previously true
    [Signal.subtle.unwatched]?: (this: Signal<T>) => void;
  }
}

// Internal conversion functions

function registerSignal(wrapper: PublicSignal, impl: PonyfillSignal): void {
  signalImpls.set(wrapper, impl);
  signalWrappers.set(impl, wrapper);
}

function toPonyfillSignal(signal: Signal<unknown>): PonyfillSignal {
  const impl = signalImpls.get(signal);

  if (!impl) {
    throw new TypeError("Expected a Signal instance");
  }

  return impl;
}

function toPonyfillSink(
  sink: Signal.Computed<unknown> | Signal.subtle.Watcher,
): Ponyfill.Computed<unknown> | Ponyfill.subtle.Watcher {
  const impl = signalImpls.get(sink) ?? watcherImpls.get(sink);

  if (!impl) {
    throw new TypeError("Expected a Computed or Watcher instance");
  }

  return impl as Ponyfill.Computed<unknown> | Ponyfill.subtle.Watcher;
}

function toPublicSignal(impl: PonyfillSignal): PublicSignal {
  const wrapper = signalWrappers.get(impl);

  if (!wrapper) {
    throw new TypeError("Unknown internal Signal");
  }

  return wrapper;
}

function toPublicSink(
  impl: Ponyfill.Computed<unknown> | Ponyfill.subtle.Watcher,
): Signal.Computed<unknown> | Signal.subtle.Watcher {
  const wrapper = signalWrappers.get(impl) ?? watcherWrappers.get(impl);

  if (!wrapper) {
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
