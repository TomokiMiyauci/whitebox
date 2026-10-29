interface Equality<T> {
  equals(left: T, right: T): boolean;
}

export class ReactiveContext extends EventTarget {
  readonly effects: Set<Effect> = new Set();
}

export interface ReactiveContext extends EventTarget {
  addEventListener<K extends keyof CustomEventMap>(
    type: K,
    listener: (ev: CustomEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof CustomEventMap>(
    type: K,
    listener: (ev: CustomEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

interface CustomEventMap {
  get: CustomEvent<WeakKey>;
  set: CustomEvent<WeakKey>;
}

export class State<T> implements Equality<T> {
  #current: T;
  #context: ReactiveContext;

  constructor(context: ReactiveContext, current: T) {
    this.#current = current;
    this.#context = context;
  }

  get get(): T {
    this.#context.dispatchEvent(new CustomEvent("get", { detail: this }));

    return this.#current;
  }

  set(value: T): boolean {
    if (this.equals(this.#current, value)) {
      return false;
    }

    this.#current = value;

    this.#context.dispatchEvent(new CustomEvent("set", { detail: this }));

    return true;
  }

  equals(left: T, right: T): boolean {
    return Object.is(left, right);
  }
}

export class Effect {
  private deps = new WeakSet<WeakKey>();
  private fn: VoidFunction;
  #context: ReactiveContext;

  constructor(context: ReactiveContext, fn: VoidFunction) {
    this.fn = fn;
    this.#context = context;

    context.effects.add(this);
  }

  dependsOn(ref: WeakKey): boolean {
    return this.deps.has(ref);
  }

  run(): void {
    const deps = new WeakSet<WeakKey>();

    function handler(ev: CustomEvent<WeakKey>): void {
      deps.add(ev.detail);
    }

    this.#context.addEventListener("get", handler);

    try {
      this.fn();
    } finally {
      this.#context.removeEventListener("get", handler);
    }
    this.deps = deps;
  }
}

export interface ReactiveSystem {
  State: StateConstructor;
  Effect: EffectConstructor;
  listen(callback: (action: VoidFunction) => void): VoidFunction;
}

export interface StateConstructor {
  new <T>(init: T): State<T>;
}

export interface EffectConstructor {
  new (fn: VoidFunction): Effect;
}

export function createReactiveSystem(): ReactiveSystem {
  const context = new ReactiveContext();

  function listen(callback: (action: VoidFunction) => void): VoidFunction {
    const handler = (ev: CustomEventMap["set"]): void => {
      const state = ev.detail;
      for (const effect of context.effects) {
        if (effect.dependsOn(state)) {
          const action = effect.run.bind(effect);
          callback(action);
        }
      }
    };

    context.addEventListener("set", handler);

    return () => {
      context.removeEventListener("set", handler);
    };
  }

  return {
    State: State.bind(null, context) as StateConstructor,
    Effect: Effect.bind(null, context),
    listen,
  };
}
