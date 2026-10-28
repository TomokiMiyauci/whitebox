import { State } from "./reactive.ts";

export interface Subscriber {
  (): void;
}

export class WeakMapPubSub implements PubSub<object, void> {
  #store: WeakMap<WeakKey, Set<Subscriber>> = new WeakMap();

  subscribe(target: object, subscriber: Subscriber): VoidFunction {
    let listeners: Set<Subscriber>;

    const set = this.#store.get(target);

    if (!set) {
      listeners = new Set();
      this.#store.set(target, listeners);
    } else {
      listeners = set;
    }

    listeners.add(subscriber);

    return () => {
      listeners.delete(subscriber);

      if (listeners.size === 0) {
        this.#store.delete(target);
      }
    };
  }

  publish(target: object): void {
    const listeners = this.#store.get(target);

    if (!listeners) return;

    for (const listener of [...listeners]) {
      listener();
    }
  }
}

interface PubSub<Topic, Message> {
  subscribe(topic: Topic, subscriber: (message: Message) => void): VoidFunction;

  publish(topic: Topic, message: Message): void;
}

export class Observer {
  observe(target: object, property: PropertyKey): void {
    const state = new State(Reflect.get(target, property));

    Object.defineProperty(target, property, {
      configurable: true,
      enumerable: true,

      get(): unknown {
        return state.get;
      },

      set(next: unknown): void {
        state.set(next);
      },
    });
  }
}
