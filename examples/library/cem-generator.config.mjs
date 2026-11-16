import { whiteboxPlugins } from "@whitebox/cem-generator-plugin";

/** @type {import("@wc-toolkit/cem-generator").GeneratorConfig} */
export default {
  plugins: whiteboxPlugins(),
  include: ["src/**/*.ts"],
};
