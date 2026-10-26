import { observe, subscribe } from "./default.ts";
import { getPlugin } from "./plugin.ts";

export function reactive(
  _: unknown,
  context: ClassFieldDecoratorContext<object>,
): void {
  context.addInitializer(function (): void {
    observe(this, context.name);
  });
}

/**
 * @throws {Error}
 */
export function attr(
  _: unknown,
  context: ClassFieldDecoratorContext<object>,
): void {
  const { name, metadata } = context;

  if (typeof name !== "string") throw new Error();

  const plugin = getPlugin(metadata);

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

export function component(name: string): (
  value: new (...args: unknown[]) => object,
  context: ClassDecoratorContext,
) => void {
  return (value, context) => {
    const subscriptions = new WeakMap<object, VoidFunction>();

    const plugin = getPlugin(context.metadata);

    const attributeList = plugin.consume("observedAttributes");
    const attributes = [...new Set(attributeList.flat())];
    const attributesChangedCallbacks = plugin.consume(
      "attributeChangedCallback",
    );
    const renderer = plugin.consume("renderer");

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
        if (subscriptions.has(this)) {
          return;
        }

        const update = () => {
          renderer?.render(this.#props, this);
        };

        const unsubscribe = subscribe(this.#props, update);
        subscriptions.set(this, unsubscribe);
        update();
      }

      disconnectedCallback(): void {
        const unsubscribe = subscriptions.get(this);
        unsubscribe?.();
        subscriptions.delete(this);

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
