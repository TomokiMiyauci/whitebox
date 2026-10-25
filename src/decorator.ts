import { observe } from "./default.ts";

export function reactive(
  _: unknown,
  context: ClassFieldDecoratorContext<object>,
): void {
  context.addInitializer(function () {
    observe(this, context.name);
  });
}

const ATTR = Symbol("attribute");

export function attr(_: unknown, context: ClassFieldDecoratorContext) {
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

export function component(
  value: {
    observedAttributes?: string[];
    prototype: HTMLElement & {
      attributeChangedCallback?: (
        name: string,
        oldValue: string | null,
        newValue: string | null,
      ) => void;
    };
  },
  context: ClassDecoratorContext,
) {
  const registry = context.metadata[ATTR];
  const attributes = registry instanceof Set ? registry : null;

  if (attributes) {
    const original = {
      observedAttributes: value.observedAttributes ?? [],
      attributeChangedCallback: value.prototype.attributeChangedCallback,
    };

    value.observedAttributes = [
      ...new Set([...original.observedAttributes, ...attributes]),
    ];

    value.prototype.attributeChangedCallback = function (
      this,
      name,
      oldValue,
      newValue,
    ) {
      original.attributeChangedCallback?.call(this, name, oldValue, newValue);

      if (attributes.has(name)) {
        Reflect.set(this, name, newValue);
      }
    };
  }
}
