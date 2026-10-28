import { observe, engine } from "./global.ts";
import { getPlugin } from "./plugin.ts";
import { Effect } from "./reactive.ts";

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
    observe(this, context.name);
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
export function effect(
  value: VoidFunction,
  context: ClassMethodDecoratorContext,
): void {
  const plugin = getPlugin(context.metadata ?? {});

  plugin.provide("effect", ({ props }) => new Effect(value.bind(props)));
}

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
    function (_, oldValue, newValue): void {
      if (!Object.is(oldValue, newValue)) {
        Reflect.set(this, name, newValue);
      }
    },
  );
}

interface ClassDecorator<
  Class extends abstract new (...args: unknown[]) => unknown,
> {
  (value: Class, context: ClassDecoratorContext<Class>): void;
}

/**
 * Define a class as a custom element.
 *
 * @param name The custom element name.
 * @returns A class decorator that defines the custom element.
 */
export function component(
  name: string,
): ClassDecorator<new (...args: unknown[]) => object> {
  return (value, context) => {
    const plugin = getPlugin(context.metadata ?? {});

    const attributeList = plugin.consume("observedAttributes");
    const attributes = [...new Set(attributeList.flat())];
    const attributesChangedCallbacks = plugin.consume(
      "attributeChangedCallback",
    );
    const effectFactories = plugin.consume("effect");

    context.addInitializer(function (): void {
      customElements.define(name, this as CustomElementConstructor);
    });

    return class extends HTMLElement {
      readonly #props: object;
      readonly #effects: Effect[];

      static observedAttributes = attributes;

      constructor(...args: unknown[]) {
        super();

        this.#props = new value(...args);

        const effects = effectFactories.map((factory) =>
          factory({ props: this.#props, container: this }),
        );

        this.#effects = effects;
      }

      connectedCallback(): void {
        for (const effect of this.#effects) {
          engine.register(effect);
          effect.run();
        }
      }

      disconnectedCallback(): void {
        for (const effect of this.#effects) {
          engine.unregister(effect);
        }
      }

      attributeChangedCallback(
        name: string,
        oldValue: string | null,
        newValue: string | null,
      ): void {
        for (const callback of attributesChangedCallbacks) {
          callback.call(this.#props, name, oldValue, newValue);
        }
      }
    };
  };
}
