import { Effect, Signal } from "./global.ts";

/**
 * Makes a class accessor reactive.
 *
 * Reads of the accessor are tracked by the active effect. Setting a different
 * value schedules effects that depend on it.
 *
 * @param target The class accessor decorator target.
 * @example
 * ```ts
 * class Counter {
 *   @reactive
 *   accessor count = 0;
 * }
 * ```
 */
export function reactive<T>(
  target: ClassAccessorDecoratorTarget<object, T>,
): ClassAccessorDecoratorResult<object, T> {
  const key = Symbol();

  return {
    get() {
      const signal: InstanceType<typeof Signal<T>> = Reflect.get(this, key);

      target.get?.call(this);
      return signal.get;
    },

    set(value) {
      const signal: InstanceType<typeof Signal<T>> = Reflect.get(this, key);

      target.set?.call(this, value);

      signal.set(value);
    },

    init(value) {
      Reflect.set(this, key, new Signal(value));
      return value;
    },
  };
}

/**
 * Makes a class an effect that runs when its reactive dependencies change.
 *
 * The action runs once after the instance is constructed and again whenever a
 * reactive value read by the action changes.
 *
 * @param action The function to run with each constructed instance.
 * @returns A class decorator that runs and tracks the action.
 * @example
 * ```ts
 * @effect((instance) => console.log(instance.count))
 * class Counter {
 *   @reactive
 *   accessor count = 0;
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

/** Constructor type used to infer the instance passed to an effect action. */
type Constructor = new (...args: any) => any;

/**
 * Reflects a class accessor to an HTML attribute on an element.
 *
 * Reading the accessor returns the current attribute value. Setting it updates
 * or removes the corresponding attribute.
 *
 * @param target The class accessor decorator target.
 * @param context The class accessor decorator context.
 * @throws {Error} If the accessor name is not a string.
 * @example
 * ```ts
 * class MyButton extends HTMLElement {
 *   @attr
 *   accessor label: string | null = null;
 * }
 * ```
 */
export function attr(
  target: ClassAccessorDecoratorTarget<Element, string | null>,
  context: ClassAccessorDecoratorContext<Element, string | null>,
): ClassAccessorDecoratorResult<Element, string | null> {
  const name = context.name;

  if (typeof name !== "string") throw new Error();

  return {
    get(this: Element): string | null {
      target.get?.call(this);

      return this.getAttribute(name);
    },
    set(this: Element, value: string | null): void {
      if (value === null) {
        this.removeAttribute(name);
      } else {
        this.setAttribute(name, value);
      }

      target.set?.call(this, value);
    },
  };
}

/** Type of a class decorator that does not replace the decorated class. */
interface ClassDecorator<
  Class extends abstract new (...args: unknown[]) => unknown = abstract new (
    ...args: unknown[]
  ) => unknown,
> {
  (value: Class, context: ClassDecoratorContext<Class>): void;
}

/**
 * Registers a class with the browser's custom element registry.
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

/**
 * Applies a CSS stylesheet to the component's shadow root or the document.
 *
 * If the component has a Shadow Root, the stylesheet is adopted by that root.
 * Otherwise, it is adopted by the document.
 *
 * @param stylesheet The CSS stylesheet to apply.
 * @returns A class decorator that applies the stylesheet during construction.
 */
export function style(
  stylesheet: CSSStyleSheet,
): <T extends new (...args: any) => HTMLElement>(value: T) => T {
  return (value) => {
    return class extends value {
      constructor(...args: any) {
        super(...args);

        const root = this.shadowRoot ? this.shadowRoot : document;
        const sheets = new Set(root.adoptedStyleSheets).add(stylesheet);
        root.adoptedStyleSheets = sheets.values().toArray();
      }
    };
  };
}
