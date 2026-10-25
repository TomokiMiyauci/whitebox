export interface Subscriber {
  (): void;
}

export interface Registry extends WeakMap<WeakKey, Set<Subscriber>> {}

export class Reactive {
  constructor(private subscribers: Registry) {}
  subscribe(target: object, subscriber: Subscriber): VoidFunction {
    const listeners = this.subscribers.getOrInsertComputed(
      target,
      () => new Set(),
    );

    listeners.add(subscriber);

    return () => {
      listeners.delete(subscriber);

      if (listeners.size === 0) {
        this.subscribers.delete(target);
      }
    };
  }

  notify(target: object) {
    const listeners = this.subscribers.get(target);

    if (!listeners) return;

    for (const listener of [...listeners]) {
      listener();
    }
  }

  observe(target: object, property: PropertyKey): void {
    let value = Reflect.get(target, property);
    // deno-lint-ignore no-this-alias
    const reactive = this;

    Object.defineProperty(target, property, {
      configurable: true,
      enumerable: true,

      get() {
        return value;
      },

      set(next: unknown) {
        if (Object.is(value, next)) return;

        value = next;
        reactive.notify(this);
      },
    });
  }
}
