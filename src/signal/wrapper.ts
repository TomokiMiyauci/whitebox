/**
 * @license
 * Copyright 2024 Bloomberg Finance L.P.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { computedGet, createComputed, type ComputedNode } from "./computed.ts";
import {
  getActiveConsumer,
  isInNotificationPhase,
  producerAccessed,
  assertConsumerNode,
  setActiveConsumer,
  REACTIVE_NODE,
  type ReactiveNode,
  assertProducerNode,
  producerRemoveLiveConsumerAtIndex,
} from "./graph.ts";
import {
  createSignal,
  signalGetFn,
  signalSetFn,
  type SignalNode,
} from "./signal.ts";

const NODE: unique symbol = Symbol("node");

export interface Signal<T> {
  // Get the value of the signal
  get(): T;
}

export namespace Signal {
  // A read-write Signal
  export class State<T> {
    readonly [NODE]: SignalNode<T>;

    constructor(initialValue: T, options: SignalOptions<T> = {}) {
      const node = createSignal<T>(initialValue, this);
      this[NODE] = node;
      node.wrapper = this;
      if (options) {
        const equals = options.equals;
        if (equals) {
          node.equal = equals;
        }
        node.watched = options[Signal.subtle.watched];
        node.unwatched = options[Signal.subtle.unwatched];
      }
    }

    public get(): T {
      return (signalGetFn<T>).call(this[NODE]);
    }

    public set(newValue: T): void {
      if (isInNotificationPhase()) {
        throw new Error(
          "Writes to signals not permitted during Watcher callback",
        );
      }
      const ref = this[NODE];
      signalSetFn<T>(ref, newValue);
    }
  }

  // A Signal which is a formula based on other Signals
  export class Computed<T> {
    readonly [NODE]: ComputedNode<T>;

    // Create a Signal which evaluates to the value returned by the callback.
    // Callback is called with this signal as the parameter.
    constructor(computation: () => T, options?: SignalOptions<T>) {
      const node = createComputed<T>(computation, this);

      this[NODE] = node;
      if (options) {
        const equals = options.equals;
        if (equals) {
          node.equal = equals;
        }
        node.watched = options[Signal.subtle.watched];
        node.unwatched = options[Signal.subtle.unwatched];
      }
    }

    get(): T {
      return computedGet(this[NODE]);
    }
  }

  export namespace subtle {
    // Run a callback with all tracking disabled (even for nested computed).
    export function untrack<T>(cb: () => T): T {
      let output: T;
      let prevActiveConsumer = null;
      try {
        prevActiveConsumer = setActiveConsumer(null);
        output = cb();
      } finally {
        setActiveConsumer(prevActiveConsumer);
      }
      return output;
    }

    // Returns ordered list of all signals which this one referenced
    // during the last time it was evaluated
    export function introspectSources(
      sink: Computed<unknown> | Watcher,
    ): (State<unknown> | Computed<unknown>)[] {
      return sink[NODE].producerNode?.map((n) => n.wrapper) ?? [];
    }

    // Returns the subset of signal sinks which recursively
    // lead to an Effect which has not been disposed
    // Note: Only watched Computed signals will be in this list.
    export function introspectSinks(
      signal: State<unknown> | Computed<unknown>,
    ): (Computed<unknown> | Watcher)[] {
      return signal[NODE].liveConsumerNode?.map((n) => n.wrapper) ?? [];
    }

    // True iff introspectSinks() is non-empty
    export function hasSinks(
      signal: State<unknown> | Computed<unknown>,
    ): boolean {
      const liveConsumerNode = signal[NODE].liveConsumerNode;
      if (!liveConsumerNode) return false;
      return liveConsumerNode.length > 0;
    }

    // True iff introspectSources() is non-empty
    export function hasSources(signal: Computed<unknown> | Watcher): boolean {
      const producerNode = signal[NODE].producerNode;
      if (!producerNode) return false;
      return producerNode.length > 0;
    }

    export class Watcher {
      readonly [NODE]: ReactiveNode;

      // When a (recursive) source of Watcher is written to, call this callback,
      // if it hasn't already been called since the last `watch` call.
      // No signals may be read or written during the notify.
      constructor(notify: (this: Watcher) => void) {
        let node = Object.create(REACTIVE_NODE);
        node.wrapper = this;
        node.consumerMarkedDirty = notify;
        node.consumerIsAlwaysLive = true;
        node.consumerAllowSignalWrites = false;
        node.producerNode = [];
        this[NODE] = node;
      }

      // Add these signals to the Watcher's set, and set the watcher to run its
      // notify callback next time any signal in the set (or one of its dependencies) changes.
      // Can be called with no arguments just to reset the "notified" state, so that
      // the notify callback will be invoked again.
      watch(...signals: Signal<unknown>[]): void {
        const node = this[NODE];
        node.dirty = false; // Give the watcher a chance to trigger again
        const prev = setActiveConsumer(node);
        for (const signal of signals) {
          producerAccessed(signal[NODE]);
        }
        setActiveConsumer(prev);
      }

      // Remove these signals from the watched set (e.g., for an effect which is disposed)
      unwatch(...signals: Signal<unknown>[]): void {
        const node = this[NODE];
        assertConsumerNode(node);

        for (let i = node.producerNode.length - 1; i >= 0; i--) {
          if (signals.includes(node.producerNode[i]!.wrapper)) {
            producerRemoveLiveConsumerAtIndex(
              node.producerNode[i]!,
              node.producerIndexOfThis[i]!,
            );

            // Logic copied from producerRemoveLiveConsumerAtIndex, but reversed
            const lastIdx = node.producerNode!.length - 1;
            node.producerNode![i] = node.producerNode![lastIdx]!;
            node.producerIndexOfThis[i] = node.producerIndexOfThis[lastIdx]!;

            node.producerNode.length--;
            node.producerIndexOfThis.length--;
            node.nextProducerIndex--;

            if (i < node.producerNode.length) {
              const idxConsumer = node.producerIndexOfThis[i]!;
              const producer = node.producerNode[i]!;
              assertProducerNode(producer);
              producer.liveConsumerIndexOfThis[idxConsumer] = i;
            }
          }
        }
      }

      // Returns the set of computeds in the Watcher's set which are still yet
      // to be re-evaluated
      getPending(): Computed<unknown>[] {
        const node = this[NODE];
        return node.producerNode!.filter((n) => n.dirty).map((n) => n.wrapper);
      }
    }

    export function currentComputed(): Computed<unknown> | null {
      return getActiveConsumer()?.wrapper ?? null;
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
