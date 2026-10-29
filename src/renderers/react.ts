import type { Renderer } from "../renderer.ts";
import { createRoot, type Root } from "react-dom/client";
import type { ReactNode } from "react";
import { getPlugin } from "../plugin.ts";
import { Effect } from "../global.ts";

export class ReactRenderer<P> implements Renderer<P> {
  readonly #fn: (props: P) => ReactNode;
  readonly #roots = new WeakMap<HTMLElement, Root>();

  constructor(fn: (props: P) => ReactNode) {
    this.#fn = fn;
  }

  render(props: P, container: HTMLElement): void {
    let root = this.#roots.get(container);

    if (!root) {
      root = createRoot(container);
      this.#roots.set(container, root);
    }

    const node = this.#fn(props);

    root.render(node);
  }

  dispose(container: HTMLElement): void {
    const root = this.#roots.get(container);

    if (!root) return;

    root.unmount();
    this.#roots.delete(container);
  }
}

export function template<T>(
  fn: (props: T) => ReactNode,
): (
  _: unknown,
  context: ClassDecoratorContext<abstract new (...args: unknown[]) => T>,
) => void {
  return (_: unknown, context: ClassDecoratorContext) => {
    const plugin = getPlugin(context.metadata ?? {});
    const renderer = new ReactRenderer(fn);

    plugin.provide(
      "effect",
      ({ props, container }) =>
        new Effect(() => renderer.render(props as T, container)),
    );
  };
}
