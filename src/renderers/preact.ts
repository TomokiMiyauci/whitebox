import { render, type VNode } from "preact";
import { Effect } from "../global.ts";

/**
 * Renders a custom element's reactive instance with Preact renderer.
 *
 * @param fn Creates the Preact node from the custom element instance.
 * @returns A class decorator that rerenders when reactive dependencies change.
 */
export function template<T extends new (...args: any[]) => HTMLElement>(
  fn: (props: InstanceType<T>) => VNode,
): (constructor: T) => T {
  return (constructor) => {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);
        const bound = () => render(fn(this as InstanceType<T>), this);

        const effect = new Effect(bound);

        effect.run();
      }
    };
  };
}
