# whitebox

[![JSR](https://jsr.io/badges/@whitebox/core)](https://jsr.io/@whitebox/core)
[![JSR Score](https://jsr.io/badges/@whitebox/core/score)](https://jsr.io/@whitebox/core/score)
[![CodeQL](https://github.com/TomokiMiyauci/whitebox/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/TomokiMiyauci/whitebox/actions/workflows/github-code-scanning/codeql)

Declarative Web Components toolkit.

## Features

- Renderer agnostic — Decoupled from rendering, enabling integration with any renderer.
- Declarative — Define components using decorators, expressing component structure and behavior declaratively.
- Reactive — Automatically track dependencies and execute effects in response to changes.
- Signals-based — Built on the [TC39 proposal signals](https://github.com/tc39/proposal-signals), providing a proposal-based reactive API for standalone and component-based state management.

## Install

Install the core package:

```bash
npx jsr add @whitebox/core
```

Choose a renderer:

### React

```bash
npx jsr add @whitebox/react
```

### Preact

```bash
npx jsr add @whitebox/preact
```

## Usage

The following example defines a custom button with a reactive counter, a `label` attribute, and an effect that logs the counter value whenever it changes.

```tsx
import { customElement, attr, reactive, effect, style } from "@whitebox/core";
import { template } from "@whitebox/react";
import css from "./style.css" with { type: "css" };

@customElement("my-button")
@template(({ count, handleClick, label }) => (
  <button aria-label={label} onClick={handleClick}>
    {count}
  </button>
))
@style(css)
@effect(function () {
  this.log();
})
class MyButton extends HTMLElement {
  @reactive
  accessor count = 0;

  handleClick = (): void => {
    this.count++;
  };

  log(): void {
    console.log(this.count);
  }

  @attr
  @reactive
  accessor label: string | null = null;
}
```

- `@customElement` registers the class as a custom element.
- `@template` declares its rendered UI using the selected renderer.
- `@style` applies a `CSSStyleSheet` to the shadow root when available, or to the document otherwise.
- `@effect` runs a side effect that tracks and logs changes to count.
- `@reactive` makes a property reactive, allowing changes to trigger dependent effects and template updates.
- `@attr` exposes `label` as a custom element attribute.

### Signals

Whitebox provides a reactive API based on the TC39 Signals proposal.

Signals are independent of the DOM, Web Components, and rendering frameworks. They can be used in any JavaScript environment.

#### Standalone usage

Create state with `Signal.State` and derive values with `Signal.Computed`.

```ts
import Signal from "@whitebox/core/signal";

const theme = new Signal.State<"light" | "dark">("light");
const isDark = new Signal.Computed(() => theme.get() === "dark");

theme.set("dark");

console.log(isDark.get()); // true
```

#### Using Signals with components

Signals can also be used within Whitebox components to drive reactive UI updates.

```tsx
import { customElement } from "@whitebox/core";
import Signal from "@whitebox/core/signal";
import { template } from "@whitebox/react";

const theme = new Signal.State<"light" | "dark">("light");

@customElement("theme-switch")
@template(() => (
  <button onClick={() => theme.set(theme.get() === "light" ? "dark" : "light")}>
    Theme: {theme.get()}
  </button>
))
class ThemeSwitch extends HTMLElement {}
```

When the theme changes, the template updates automatically.

## License

[MIT](LICENSE)
