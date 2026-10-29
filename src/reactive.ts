interface Equality<T> {
  equals(left: T, right: T): boolean;
}

export class ReactiveContext {
  readonly effects: Set<Effect> = new Set();

  activeEffect: Effect | undefined;
  #onChange: (action: VoidFunction) => void;

  constructor(onChange: (action: VoidFunction) => void) {
    this.#onChange = onChange;
  }

  track(ref: WeakKey): void {
    this.activeEffect?.track(ref);
  }

  notifyChange(ref: WeakKey): void {
    for (const effect of this.effects) {
      if (effect.dependsOn(ref)) {
        this.#onChange(effect.scheduledRun);
      }
    }
  }
}

export class State<T> implements Equality<T> {
  #current: T;
  #context: ReactiveContext;

  constructor(context: ReactiveContext, current: T) {
    this.#current = current;
    this.#context = context;
  }

  get get(): T {
    this.#context.track(this);
    return this.#current;
  }

  set(value: T): boolean {
    if (this.equals(this.#current, value)) {
      return false;
    }

    this.#current = value;
    this.#context.notifyChange(this);

    return true;
  }

  equals(left: T, right: T): boolean {
    return Object.is(left, right);
  }
}

export class Effect {
  #deps = new Set<WeakKey>();
  #fn: VoidFunction;
  #context: ReactiveContext;

  constructor(context: ReactiveContext, fn: VoidFunction) {
    this.#fn = fn;
    this.#context = context;

    context.effects.add(this);
  }

  track(ref: WeakKey): void {
    this.#deps.add(ref);
  }

  dependsOn(ref: WeakKey): boolean {
    return this.#deps.has(ref);
  }

  readonly scheduledRun: VoidFunction = () => {
    this.run();
  };

  run(): void {
    const previous = this.#context.activeEffect;
    this.#context.activeEffect = this;

    try {
      this.#fn();
    } finally {
      this.#context.activeEffect = previous;
    }
  }
}

export interface ReactiveSystem {
  State: StateConstructor;
  Effect: EffectConstructor;
}

export interface StateConstructor {
  new <T>(init: T): State<T>;
}

export interface EffectConstructor {
  new (fn: VoidFunction): Effect;
}

export function createReactiveSystem(
  onChange: (action: VoidFunction) => void,
): ReactiveSystem {
  const context = new ReactiveContext(onChange);

  return {
    State: State.bind(null, context) as StateConstructor,
    Effect: Effect.bind(null, context),
  };
}
