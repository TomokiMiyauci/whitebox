import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { Effect } from "../global.ts";

/**
 * Renders a custom element's reactive instance with React.
 *
 * @param fn Creates the React node from the custom element instance.
 * @returns A class decorator that rerenders when reactive dependencies change.
 */
export function template<T extends new (...args: any[]) => HTMLElement>(
  fn: (props: InstanceType<T>) => ReactNode,
): (constructor: T) => T {
  return (constructor) => {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);

        const root = createRoot(this.shadowRoot ? this.shadowRoot : this);

        const bound = () => {
          const node = fn(this as InstanceType<T>);

          root.render(node);
        };

        const effect = new Effect(bound);

        effect.run();
      }
    };
  };
}
