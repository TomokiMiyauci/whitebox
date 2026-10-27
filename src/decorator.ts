import { observe, subscribe } from "./default.ts";
import { getPlugin } from "./plugin.ts";

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
  value: Function,
  context: ClassMethodDecoratorContext,
): void {
  const plugin = getPlugin(context.metadata ?? {});

  plugin.provide("subscription", value);
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

/**
 * Define a class as a custom element.
 *
 * @param name The custom element name.
 * @returns A class decorator that defines the custom element.
 */
export function component(
  name: string,
): (
  value: new (...args: unknown[]) => object,
  context: ClassDecoratorContext,
) => void {
  return (value, context) => {
    const subscriptionRegistry = new WeakMap<object, VoidFunction>();

    const plugin = getPlugin(context.metadata ?? {});

    const attributeList = plugin.consume("observedAttributes");
    const attributes = [...new Set(attributeList.flat())];
    const attributesChangedCallbacks = plugin.consume(
      "attributeChangedCallback",
    );
    const renderer = plugin.consume("renderer");
    const subscriptions = plugin.consume("subscription");

    context.addInitializer(function (): void {
      customElements.define(name, this as CustomElementConstructor);
    });

    return class extends HTMLElement {
      readonly #props: object;

      static observedAttributes = attributes;

      constructor(...args: unknown[]) {
        super();

        this.#props = new value(...args);
      }

      connectedCallback(): void {
        // Prevent duplicate subscription
        if (subscriptionRegistry.has(this)) {
          return;
        }

        const actions = () => {
          renderer?.render(this.#props, this);

          for (const subscription of subscriptions) {
            subscription.call(this.#props);
          }
        };

        const unsubscribe = subscribe(this.#props, actions);
        subscriptionRegistry.set(this, unsubscribe);
        renderer?.render(this.#props, this);
      }

      disconnectedCallback(): void {
        const unsubscribe = subscriptionRegistry.get(this);
        unsubscribe?.();
        subscriptionRegistry.delete(this);

        renderer?.dispose(this);
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
