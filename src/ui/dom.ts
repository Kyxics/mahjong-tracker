/** Tiny DOM helper — no framework, no virtual DOM. Full re-render per change. */

type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: {
    class?: string;
    text?: string;
    onclick?: (e: Event) => void;
    oninput?: (e: Event) => void;
    disabled?: boolean;
    value?: string;
    placeholder?: string;
    maxLength?: number;
    type?: string;
    open?: boolean;
  } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs.class) el.className = attrs.class;
  if (attrs.text !== undefined) el.textContent = attrs.text;
  if (attrs.onclick) el.addEventListener('click', attrs.onclick);
  if (attrs.oninput) el.addEventListener('input', attrs.oninput);
  if (attrs.disabled && 'disabled' in el) (el as HTMLButtonElement).disabled = true;
  if (attrs.value !== undefined && 'value' in el) (el as HTMLInputElement).value = attrs.value;
  if (attrs.placeholder && 'placeholder' in el) (el as HTMLInputElement).placeholder = attrs.placeholder;
  if (attrs.maxLength && 'maxLength' in el) (el as HTMLInputElement).maxLength = attrs.maxLength;
  if (attrs.type && 'type' in el) (el as HTMLInputElement).type = attrs.type;
  if (attrs.open !== undefined && 'open' in el) (el as HTMLDetailsElement).open = attrs.open;
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function toast(msg: string): void {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = h('div', { class: 'toast', text: msg });
  document.body.append(el);
  setTimeout(() => el.remove(), 2500);
}
