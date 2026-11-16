# Publishing Web Components with Whitebox

This example demonstrates how to build and publish a Web Components library using Whitebox.

Web Components libraries should provide a [Custom Elements Manifest (CEM)](https://github.com/webcomponents/custom-elements-manifest) to make their public APIs discoverable by editors and development tools.

## Project Setup

This example uses:

- [Whitebox](../../README.md)
- [CEM Generator](https://github.com/wc-toolkit/cem-generator)
- [CEM Generator Plugin Whitebox](https://github.com/TomokiMiyauci/cem-generator-plugin-whitebox)

See [package.json](./package.json) for dependencies and scripts.

## CEM Generation

The [CEM generator configuration](./cem-generator.config.mjs) registers the Whitebox plugin and specifies the source files to analyze.

Generate the manifest by running:

```sh
bun install
bun run generate
```

This produces [custom-elements.json](./custom-elements.json) containing the metadata extracted from your components.

## Publishing

Include the generated `custom-elements.json` in your published package.

The `customElements` field in [package.json](./package.json) declares the manifest location, allowing compatible tools to discover it.

Regenerate the manifest whenever your public component APIs change, and ensure the latest version is included when publishing your library.

## Reference

- [Web Components Language Server](https://marketplace.visualstudio.com/items?itemName=wc-toolkit.web-components-language-server)
