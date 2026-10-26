export interface Renderer<P> {
  render(props: P, container: HTMLElement): void;
  dispose(containerr: HTMLElement): void;
}
