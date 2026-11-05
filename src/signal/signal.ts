import { throwInvalidWriteToSignalError } from "./errors.ts";
import {
  producerAccessed,
  producerIncrementEpoch,
  producerNotifyConsumers,
  producerUpdatesAllowed,
  REACTIVE_NODE,
  type ReactiveNode,
  isInNotificationPhase,
} from "./graph.ts";

export class StateWithContext<T> {
  protected context: ReactiveNode;
  #value: T;
  #equal: (left: T, right: T) => boolean;
  constructor(
    initialValue: T,
    watched: VoidFunction | undefined,
    unwatched: VoidFunction | undefined,
    options?: SignalOptions<T>,
  ) {
    const context = {
      ...REACTIVE_NODE,
      wrapper: this,
      watched,
      unwatched,
    } satisfies ReactiveNode;

    this.context = context;
    this.#value = initialValue;
    this.#equal = options?.equals ?? Object.is;
  }

  get(): T {
    producerAccessed(this.context);

    return this.#value;
  }

  set(newValue: T): void {
    if (isInNotificationPhase()) {
      throw new Error(
        "Writes to signals not permitted during Watcher callback",
      );
    }

    if (!producerUpdatesAllowed()) {
      throwInvalidWriteToSignalError();
    }

    if (!this.#equal(this.#value, newValue)) {
      this.#value = newValue;

      this.context.version++;
      producerIncrementEpoch();
      producerNotifyConsumers(this.context);
    }
  }
}

interface SignalOptions<T> {
  // Custom comparison function between old and new value. Default: Object.is.
  // The signal is passed in as an optionally-used third parameter for context.
  equals?: (t: T, t2: T) => boolean;
}
