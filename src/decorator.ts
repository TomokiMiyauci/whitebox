import { Signal } from "./signal/mod.ts";

/** Registers a cleanup callback for an effect. */
export interface RegisterCleanup {
  /**
   * Registers a callback to clean up resources created during an action execution.
   *
   * @param callback The cleanup callback to execute before the next action execution or when the effect stops.
   */
  (callback: VoidFunction): void;
}

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
  const { get } = target;

  return {
    get(): T {
      return (get.call(this) as Signal.State<T>).get();
    },

    set(value: T) {
      (get.call(this) as Signal.State<T>).set(value);
    },

    init(value) {
      return new Signal.State(value) as T;
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
 * @effect(function (onCleanup) {
 *   this.count
 * })
 * class Counter {
 *   @reactive
 *   accessor count = 0;
 * }
 * ```
 */
export function effect<C extends new (...args: any[]) => any>(
  action: (this: InstanceType<C>, onCleanup: RegisterCleanup) => void,
): (value: C) => C {
  return (value) => {
    return class extends value {
      constructor(...args: any[]) {
        super(...args);

        let cleanup: VoidFunction | undefined;

        const computed = new Signal.Computed(() => {
          cleanup?.();
          cleanup = undefined;

          action.call(this as InstanceType<C>, (callback) => {
            cleanup = callback;
          });
        });

        let pending = false;

        const watcher = new Signal.subtle.Watcher(() => {
          if (pending) return;

          pending = true;

          queueMicrotask(() => {
            pending = false;

            for (const signal of watcher.getPending()) {
              signal.get();
            }

            watcher.watch();
          });
        });

        watcher.watch(computed);
        computed.get();
      }
    };
  };
}

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

/**
 * Registers a class with the browser's custom element registry.
 *
 * @param name The custom element name.
 * @returns A class decorator that registers the class as a custom element.
 */
export function customElement(
  name: string,
): <T extends CustomElementConstructor>(
  value: T,
  context: ClassDecoratorContext<T>,
) => void {
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
): <T extends new (...args: any[]) => HTMLElement>(value: T) => T {
  return (value) => {
    return class extends value {
      constructor(...args: any[]) {
        super(...args);

        const root = this.shadowRoot ? this.shadowRoot : document;
        const sheets = new Set(root.adoptedStyleSheets).add(stylesheet);
        root.adoptedStyleSheets = sheets.values().toArray();
      }
    };
  };
}

/**
 * Attaches an open Shadow DOM to the custom element.
 *
 * @returns A class decorator that ensures the element has a shadow root.
 */
export function shadowHost<T extends new (...args: any[]) => HTMLElement>(
  value: T,
): T {
  return class extends value {
    constructor(...args: any[]) {
      super(...args);

      if (!this.shadowRoot) {
        this.attachShadow({ mode: "open" });
      }
    }
  };
}
