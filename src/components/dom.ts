/**
 * Tiny DOM helper. Text is always set with textContent, never innerHTML (XSS protection).
 */
type Attrs = Record<string, string | boolean | undefined>;
type Child = Node | string | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function setText(node: Element, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export function show(node: HTMLElement, visible: boolean): void {
  node.hidden = !visible;
}

/** Replaces the <option>s of a select while keeping the chosen value. */
export function setOptions(
  select: HTMLSelectElement,
  options: { value: string; label: string }[],
  selected: string,
): void {
  const signature = JSON.stringify(options);
  if (select.dataset.sig !== signature) {
    select.replaceChildren(...options.map((o) => el('option', { value: o.value }, [o.label])));
    select.dataset.sig = signature;
  }
  select.value = selected;
}
