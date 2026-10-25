import { observe, subscribe } from "./default.ts";
import { render, type VNode } from "preact";

export function reactive(
  _: unknown,
  context: ClassFieldDecoratorContext<object>,
): void {
  context.addInitializer(function (): void {
    observe(this, context.name);
  });
}

const ATTR = Symbol("attribute");

export function attr(_: unknown, context: ClassFieldDecoratorContext): void {
  const { name, metadata } = context;

  if (ATTR in metadata) {
    const registry = metadata[ATTR];

    if (registry instanceof Set) {
      registry.add(name);
    }
  } else {
    const registry = new Set([name]);
    metadata[ATTR] = registry;
  }
}

export interface ComponentDefinition<P> {
  name: string;
  template?: (props: P) => VNode<any>;
}

// deno-lint-ignore no-explicit-any
export function component<T extends new (...args: unknown[]) => any>(
  definition: ComponentDefinition<InstanceType<T>>,
): (
  value: T,
  context: ClassDecoratorContext<T>,
) => void {
  return (value, context) => {
    const subscriptions = new WeakMap<object, VoidFunction>();
    const registry = context.metadata[ATTR];
    const attributes = registry instanceof Set ? registry : null;

    context.addInitializer(function (): void {
      customElements.define(definition.name, this as CustomElementConstructor);
    });

    class WhiteBox extends HTMLElement {
      readonly #props: InstanceType<T>;

      static observedAttributes = [...attributes ?? []];

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
          render(
            definition?.template?.(this.#props),
            this as HTMLElement,
          );
        };

        const unsubscribe = subscribe(this.#props, update);
        subscriptions.set(this, unsubscribe);
        update();
      }

      disconnectedCallback(): void {
        const unsubscribe = subscriptions.get(this);
        unsubscribe?.();
        subscriptions.delete(this);
      }

      attributeChangedCallback(
        name: string,
        oldValue: string | null,
        newValue: string | null,
      ): void {
        if (oldValue === newValue || !attributes?.has(name)) {
          return;
        }

        Reflect.set(this.#props, name, newValue);
      }
    }

    return WhiteBox;
  };
}
