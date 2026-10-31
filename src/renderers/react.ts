import { createRoot, type Root } from "react-dom/client";
import type { ReactNode } from "react";
import { Effect } from "../global.ts";

/** Defines the rendering and cleanup operations for a renderer. */
interface Renderer<P> {
  /**
   * Renders props into a container.
   *
   * @param props The data passed to the renderer.
   * @param container The DOM element that receives the rendered output.
   */
  render(props: P, container: HTMLElement): void;

  /**
   * Removes rendered output and releases resources for a container.
   *
   * @param container The DOM element whose rendered output should be removed.
   */
  dispose(container: HTMLElement): void;
}

/** Renders React nodes into DOM containers and tracks their React roots. */
export class ReactRenderer<P> implements Renderer<P> {
  /** Produces a React node from the supplied props. */
  readonly #fn: (props: P) => ReactNode;

  /** React roots created for each container. */
  readonly #roots = new WeakMap<HTMLElement, Root>();

  /**
   * Creates a renderer for a React node factory.
   *
   * @param fn Produces the React node to render.
   */
  constructor(fn: (props: P) => ReactNode) {
    this.#fn = fn;
  }

  /**
   * Renders props into a container, creating its React root on first use.
   *
   * @param props The data passed to the node factory.
   * @param container The DOM element that receives the rendered output.
   */
  render(props: P, container: HTMLElement): void {
    let root = this.#roots.get(container);

    if (!root) {
      root = createRoot(container);
      this.#roots.set(container, root);
    }

    const node = this.#fn(props);

    root.render(node);
  }

  /**
   * Unmounts the React root associated with a container, if one exists.
   *
   * @param container The DOM element whose React root should be unmounted.
   */
  dispose(container: HTMLElement): void {
    const root = this.#roots.get(container);

    if (!root) return;

    root.unmount();
    this.#roots.delete(container);
  }
}

/**
 * Renders a custom element's reactive instance with React renderer.
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
        const renderer = new ReactRenderer(fn);
        const bound = () => renderer.render(this as InstanceType<T>, this);

        const effect = new Effect(bound);

        effect.run();
      }
    };
  };
}
