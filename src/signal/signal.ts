/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { type Equality } from "./equality.ts";
import { throwInvalidWriteToSignalError } from "./errors.ts";
import {
  producerAccessed,
  producerIncrementEpoch,
  producerNotifyConsumers,
  producerUpdatesAllowed,
  REACTIVE_NODE,
  type ReactiveNode,
  SIGNAL,
} from "./graph.ts";

export interface SignalNode<T> extends ReactiveNode, Equality<T> {
  value: T;
}

export type SignalBaseGetter<T> = (() => T) & { readonly [SIGNAL]: unknown };

// Note: Closure *requires* this to be an `interface` and not a type, which is why the
// `SignalBaseGetter` type exists to provide the correct shape.
export interface SignalGetter<T> extends SignalBaseGetter<T> {
  readonly [SIGNAL]: SignalNode<T>;
}

/**
 * Create a `Signal` that can be set or updated directly.
 */
export function createSignal<T>(initialValue: T): SignalGetter<T> {
  const node: SignalNode<T> = Object.create(SIGNAL_NODE);
  node.value = initialValue;
  const getter = (() => {
    producerAccessed(node);
    return node.value;
  }) as SignalGetter<T>;
  (getter as any)[SIGNAL] = node;
  return getter;
}

export function signalGetFn<T>(this: SignalNode<T>): T {
  producerAccessed(this);
  return this.value;
}

export function signalSetFn<T>(node: SignalNode<T>, newValue: T) {
  if (!producerUpdatesAllowed()) {
    throwInvalidWriteToSignalError();
  }

  if (!node.equal.call(node.wrapper, node.value, newValue)) {
    node.value = newValue;
    node.version++;
    producerIncrementEpoch();
    producerNotifyConsumers(node);
  }
}

export const SIGNAL_NODE: SignalNode<unknown> = {
  ...REACTIVE_NODE,
  equal: Object.is,
  value: undefined,
};
