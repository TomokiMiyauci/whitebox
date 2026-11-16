import {
  customElement,
  attr,
  reactive,
  shadowHost,
  style,
} from "@whitebox/core";
import styles from "./style.css" with { type: "css" };

@customElement("my-button")
@shadowHost
@style(styles)
class MyBytton extends HTMLElement {
  /** The button label. */
  @attr
  @reactive
  accessor label: string | null = null;
}
