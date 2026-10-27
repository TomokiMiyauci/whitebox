export interface Subscriber {
  (): void;
}

export interface Registry extends WeakMap<WeakKey, Set<Subscriber>> {}

export class Reactive implements PubSub<object, void> {
  constructor(subscribers: Registry) {
    this.subscribers = subscribers;
  }

  private subscribers: Registry;
  subscribe(target: object, subscriber: Subscriber): VoidFunction {
    let listeners: Set<Subscriber>;

    const set = this.subscribers.get(target);

    if (!set) {
      listeners = new Set();
      this.subscribers.set(target, listeners);
    } else {
      listeners = set;
    }

    listeners.add(subscriber);

    return () => {
      listeners.delete(subscriber);

      if (listeners.size === 0) {
        this.subscribers.delete(target);
      }
    };
  }

  publish(target: object): void {
    const listeners = this.subscribers.get(target);

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
  #pubsub: Reactive;

  constructor(pubsub: Reactive) {
    this.#pubsub = pubsub;
  }

  observe(target: object, property: PropertyKey): void {
    let value = Reflect.get(target, property);
    const pubsub = this.#pubsub;

    Object.defineProperty(target, property, {
      configurable: true,
      enumerable: true,

      get(): unknown {
        return value;
      },

      set(next: unknown): void {
        if (Object.is(value, next)) return;

        value = next;
        pubsub.publish(this);
      },
    });
  }
}
