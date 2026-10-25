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
  template?: (props: P) => VNode<any>;
}

interface Element {
  observedAttributes?: string[];
  prototype: HTMLElement & {
    attributeChangedCallback?: (
      name: string,
      oldValue: string | null,
      newValue: string | null,
    ) => void;
    connectedCallback?: () => void;
    disconnectedCallback?: () => void;
  };

  new (...args: unknown[]): unknown;
}

export function component<T extends Element>(
  definition?: ComponentDefinition<InstanceType<T>>,
): (
  value: T,
  context: ClassDecoratorContext<T>,
) => void {
  return (value, context) => {
    const subscriptions = new WeakMap<HTMLElement, VoidFunction>();
    const original = {
      observedAttributes: value.observedAttributes ?? [],
      attributeChangedCallback: value.prototype.attributeChangedCallback,
      connectedCallback: value.prototype.connectedCallback,
      disconnectedCallback: value.prototype.disconnectedCallback,
    };

    const registry = context.metadata[ATTR];
    const attributes = registry instanceof Set ? registry : null;

    value.prototype.connectedCallback = function (): void {
      original.connectedCallback?.call(this);

      // Prevent duplicate subscription
      if (subscriptions.has(this)) {
        return;
      }

      const update = () => {
        render(definition?.template?.(this as InstanceType<T>), this);
      };

      const unsubscribe = subscribe(this, update);
      subscriptions.set(this, unsubscribe);
      update();
    };

    value.prototype.disconnectedCallback = function (): void {
      original.disconnectedCallback?.call(this);

      const unsubscribe = subscriptions.get(this);
      unsubscribe?.();
      subscriptions.delete(this);
    };

    if (attributes) {
      value.observedAttributes = [
        ...new Set([...original.observedAttributes, ...attributes]),
      ];

      value.prototype.attributeChangedCallback = function (
        this,
        name,
        oldValue,
        newValue,
      ): void {
        original.attributeChangedCallback?.call(this, name, oldValue, newValue);

        if (attributes.has(name)) {
          Reflect.set(this, name, newValue);
        }
      };
    }
  };
}
