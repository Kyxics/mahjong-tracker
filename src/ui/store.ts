/** localStorage persistence: resume an interrupted session after reload. */

import { deserializeSession, serializeSession, type Session } from '../engine/engine.ts';
import type { AnyVariant } from '../engine/types.ts';
import { VARIANTS } from '../variants/index.ts';

const KEY = 'mahjong-tracker:v1:session';

export function variantById(id: string): AnyVariant | undefined {
  return VARIANTS.find((v) => v.id === id);
}

export function saveSession(session: Session<unknown, unknown>): void {
  try {
    localStorage.setItem(KEY, serializeSession(session));
  } catch {
    /* storage full/unavailable — tracking continues in memory */
  }
}

export function loadSavedSession(): { session: Session<unknown, unknown>; variant: AnyVariant } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const session = deserializeSession<unknown, unknown>(raw);
    const variant = variantById(session.variantId);
    if (!variant) return null;
    return { session, variant };
  } catch {
    return null;
  }
}

export function clearSavedSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
