import type { Renderer } from "../renderer.ts";
import { render, type VNode } from "preact";
import { getPlugin } from "../plugin.ts";
import { Effect } from "../global.ts";

export class PreactRenderer<P> implements Renderer<P> {
  #fn: (props: P) => VNode;
  constructor(fn: (props: P) => VNode) {
    this.#fn = fn;
  }
  render(props: P, container: HTMLElement): void {
    const node = this.#fn(props);

    render(node, container);
  }

  dispose(container: HTMLElement): void {
    render(null, container);
  }
}

export function template<T>(
  fn: (props: T) => VNode,
): (
  _: unknown,
  context: ClassDecoratorContext<abstract new (...args: unknown[]) => T>,
) => void {
  return (_: unknown, context: ClassDecoratorContext) => {
    const plugin = getPlugin(context.metadata ?? {});
    const renderer = new PreactRenderer(fn);

    plugin.provide(
      "effect",
      ({ props, container }) =>
        new Effect(() => renderer.render(props as T, container)),
    );
  };
}
