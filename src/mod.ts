/**
 * Build reactive web components declaratively.
 *
 * Use `@reactive` to make class accessors reactive and `@effect` to run side
 * effects that track their values. Register classes as custom elements with
 * `@customElement` and bind accessors to HTML attributes with `@attr`.
 * Apply stylesheets to a component's shadow root or the document with
 * `@style`.
 *
 * @example
 * ```tsx
 * import { customElement, attr, reactive, effect, style } from "@whitebox/core";
 * import { template } from "@whitebox/react";
 * import css from "./style.css" with { type: "css" };
 *
 * @customElement("my-button")
 * @template(({ count, handleClick, label }) => (
 *   <button aria-label={label} onClick={handleClick}>
 *     {count}
 *   </button>
 * ))
 * @style(css)
 * @effect((instance) => instance.log())
 * class MyButton extends HTMLElement {
 *   @reactive
 *   accessor count = 0;
 *
 *   handleClick = (): void => {
 *     this.count++;
 *   };
 *
 *   log(): void {
 *     console.log(this.count);
 *   }
 *
 *   @attr
 *   @reactive
 *   accessor label: string | null = null;
 * }
 * ```
 * @module
 */

export {
  attr,
  effect,
  reactive,
  customElement,
  style,
  shadowHost,
} from "./decorator.ts";
export { Effect, Signal } from "./global.ts";
export { type Action } from "./reactive_system/reactive.ts";
