import { Effect, State } from "./global.ts";
import { getPlugin, type AttributeChangedCallback } from "./plugin.ts";

/**
 * Marks a class field as reactive.
 *
 * Registers the field for change observation when the instance is initialized.
 *
 * @param _ The initial field value.
 * @param context The class field decorator context.
 * @example
 * ```ts
 * class Counter {
 *   @reactive
 *   count = 0;
 * }
 * ```
 */
export function reactive(
  _: unknown,
  context: ClassFieldDecoratorContext<object>,
): void {
  context.addInitializer(function (): void {
    const state = new State(Reflect.get(this, context.name));

    Object.defineProperty(this, context.name, {
      configurable: true,
      enumerable: true,

      get(): unknown {
        return state.get;
      },

      set(next: unknown): void {
        state.set(next);
      },
    });
  });
}

/**
 * Marks a class method as an effect.
 *
 * Executes the method when its reactive dependencies change.
 *
 * @param value The decorated method.
 * @param context The class method decorator context.
 * @example
 * ```ts
 * class Counter {
 *   @reactive
 *   count = 0;
 *
 *   @effect
 *   logCount() {
 *     console.log(this.count);
 *   }
 * }
 * ```
 */
export function effect<C extends Constructor>(
  action: (instance: InstanceType<C>) => void,
): (value: C) => C {
  return (value) => {
    return class extends value {
      constructor(...args: any) {
        super(...args);

        const bound = () => action(this as InstanceType<C>);

        const effect = new Effect(bound);

        effect.run();
      }
    };
  };
}

type Constructor = new (...args: any) => any;

/**
 * Marks a class field as an HTML attribute.
 *
 * @param _ The initial field value.
 * @param context - The class field decorator context.
 * @throws {Error} If the field name is not `string`.
 * @example
 * ```ts
 * class MyButton {
 *   @attr
 *   label?: string;
 * }
 * ```
 */
export function attr(
  _: unknown,
  context: ClassFieldDecoratorContext<object>,
): void {
  const { name, metadata } = context;

  if (typeof name !== "string") throw new Error();

  const plugin = getPlugin(metadata ?? {});

  plugin.provide("observedAttributes", [name]);
  plugin.provide(
    "attributeChangedCallback",
    ({ props }) =>
      (_, __, newValue) => {
        Reflect.set(props, name, newValue);
      },
  );
}

/**
 * Define a class as a custom element.
 *
 * @returns Custom element.
 */
export function component<Class extends new (...args: any) => HTMLElement>(
  Value: Class,
  context: ClassDecoratorContext<Class>,
): Class {
  const plugin = getPlugin(context.metadata ?? {});

  const attributeList = plugin.consume("observedAttributes");
  const attributes = [...new Set(attributeList.flat())];
  const attributesChangedCallbackFactories = plugin.consume(
    "attributeChangedCallback",
  );
  // const effectFactories = plugin.consume("effect");

  return class extends Value {
    // readonly #effects: InstanceType<typeof Effect>[];
    readonly #attributesChangedCallbacks: AttributeChangedCallback[];

    static observedAttributes = attributes;

    constructor(...args: any) {
      super(...args);

      const context = { props: this, container: this };
      // const effects = effectFactories.map((factory) => factory(context));
      // this.#effects = effects;

      const attributesChangedCallbacks = attributesChangedCallbackFactories.map(
        (factory) => factory(context),
      );

      this.#attributesChangedCallbacks = attributesChangedCallbacks;
    }

    connectedCallback(): void {
      // for (const effect of this.#effects) {
      //   effect.run();
      // }
    }

    disconnectedCallback(): void {}

    attributeChangedCallback(
      name: string,
      oldValue: string | null,
      newValue: string | null,
    ): void {
      for (const callback of this.#attributesChangedCallbacks) {
        callback(name, oldValue, newValue);
      }
    }
  };
}

interface ClassDecorator<
  Class extends abstract new (...args: unknown[]) => unknown = abstract new (
    ...args: unknown[]
  ) => unknown,
> {
  (value: Class, context: ClassDecoratorContext<Class>): void;
}

/**
 * Register a class to custom element registry.
 *
 * @param name The custom element name.
 * @returns A class decorator that registers the class as a custom element.
 */
export function customElement(
  name: string,
): ClassDecorator<CustomElementConstructor> {
  return (_, context) => {
    context.addInitializer(function (): void {
      customElements.define(name, this);
    });
  };
}
