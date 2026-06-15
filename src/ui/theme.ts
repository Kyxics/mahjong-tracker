/**
 * Day/night theme. The palette lives in CSS custom properties; this module only
 * flips `data-theme` on <html> and remembers the choice. Defaults to the
 * original dark ("night") look. Specifics of the light palette are easy to
 * tweak later in style.css under [data-theme='light'].
 */

export type Theme = 'dark' | 'light';

const KEY = 'mahjong-tracker:v1:theme';

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* storage unavailable */
  }
  return 'dark';
}

export function applyTheme(t: Theme = getTheme()): void {
  document.documentElement.dataset.theme = t;
}

export function setTheme(t: Theme): void {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
  applyTheme(t);
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
