import { type Signal } from "./equality.ts";
import {
  consumerAfterComputation,
  consumerBeforeComputation,
  producerAccessed,
  producerUpdateValueVersion,
  REACTIVE_NODE,
  type ReactiveNode,
} from "./graph.ts";

/**
 * A dedicated symbol used before a computed value has been calculated for the first time.
 * Explicitly typed as `any` so we can use it as signal's value.
 */
const UNSET = Symbol("UNSET");

/**
 * A dedicated symbol used in place of a computed signal value to indicate that a given computation
 * is in progress. Used to detect cycles in computation chains.
 * Explicitly typed as `any` so we can use it as signal's value.
 */
const COMPUTING = Symbol("COMPUTING");

/**
 * A dedicated symbol used in place of a computed signal value to indicate that a given computation
 * failed. The thrown error is cached until the computation gets dirty again.
 * Explicitly typed as `any` so we can use it as signal's value.
 */
const ERRORED = Symbol("ERRORED");

export class WithComputed<T> implements Signal<T> {
  protected context: ReactiveNode;

  /**
   * Current value of the computation, or one of the sentinel values above (`UNSET`, `COMPUTING`,
   * `ERROR`).
   */
  #value: T | typeof UNSET | typeof ERRORED | typeof COMPUTING = UNSET;

  /**
   * If `value` is `ERRORED`, the error caught from the last computation attempt which will
   * be re-thrown.
   */
  #error: unknown = null;
  constructor(
    /**
     * The computation function which will produce a new value.
     */
    computation: () => T,
    watched: VoidFunction | undefined,
    unwatched: VoidFunction | undefined,
    equal: (left: T, right: T) => boolean = Object.is,
  ) {
    const self = this;
    const node: ReactiveNode = {
      ...REACTIVE_NODE,
      dirty: true,

      producerMustRecompute(): boolean {
        // Force a recomputation if there's no current value, or if the current value is in the
        // process of being calculated (which should throw an error).
        return self.#value === UNSET || self.#value === COMPUTING;
      },

      producerRecomputeValue(node: ReactiveNode): void {
        if (self.#value === COMPUTING) {
          // Our computation somehow led to a cyclic read of itself.
          throw new Error("Detected cycle in computations.");
        }

        const oldValue = self.#value;
        self.#value = COMPUTING;

        const prevConsumer = consumerBeforeComputation(node);
        let newValue: T | typeof ERRORED;
        let wasEqual = false;
        try {
          newValue = computation.call(node.wrapper);
          const oldOk = oldValue !== UNSET && oldValue !== ERRORED;
          wasEqual = oldOk && equal.call(node.wrapper, oldValue, newValue);
        } catch (err) {
          newValue = ERRORED;
          self.#error = err;
        } finally {
          consumerAfterComputation(node, prevConsumer);
        }

        if (wasEqual) {
          // No change to `valueVersion` - old and new values are
          // semantically equivalent.
          self.#value = oldValue;
          return;
        }

        self.#value = newValue;
        node.version++;
      },
      wrapper: this,
      consumerAllowSignalWrites: true,
      watched,
      unwatched,
    };

    this.context = node;
  }

  get(): T {
    // Check if the value needs updating before returning it.
    producerUpdateValueVersion(this.context);

    // Record that someone looked at this signal.
    producerAccessed(this.context);

    if (this.#value === ERRORED) {
      throw this.#error;
    }

    return this.#value;
  }
}
