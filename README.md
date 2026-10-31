# whitebox

Declarative, reactive Web Components.

## Features

- Renderer agnostic — Decoupled from rendering, enabling integration with any renderer.
- Declarative — Define components using decorators, expressing component structure and behavior declaratively.
- Reactive — Automatically track dependencies and execute effects in response to changes.

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

The following example defines a custom button with a reactive counter, `label` attribute, and an effect that logs the counter value whenever it changes.

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
@effect((instance) => instance.log())
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
- `@style` applies a `CSSStyleSheet` to the shadow root if available, otherwise to the document.
- `@effect` runs a side effect that tracks and logs changes to count.
- `@reactive` makes a property reactive, allowing changes to update dependent behavior.
- `@attr` exposes label as a custom element attribute.

## License

[MIT](LICENSE)
