import { Effect, State } from "./global.ts";

/**
 * Marks a class field as reactive.
 *
 * Registers the field for change observation when the instance is initialized.
 *
 * @param target The class field decorator target.
 * @example
 * ```ts
 * class Counter {
 *   @reactive
 *   count = 0;
 * }
 * ```
 */
export function reactive<T>(
  target: ClassAccessorDecoratorTarget<object, T>,
): ClassAccessorDecoratorResult<object, T> {
  const key = Symbol();

  return {
    get() {
      const state: InstanceType<typeof State<T>> = Reflect.get(this, key);

      target.get?.call(this);
      return state.get;
    },

    set(value) {
      const state: InstanceType<typeof State<T>> = Reflect.get(this, key);

      target.set?.call(this, value);

      state.set(value);
    },

    init(value) {
      Reflect.set(this, key, new State(value));
      return value;
    },
  };
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
 * @param target The class field decorator target.
 * @param context The class field decorator context.
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

/**
 * Applies a CSS stylesheet to the component's Shadow Root or the document.
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
