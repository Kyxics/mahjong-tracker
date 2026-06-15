/**
 * Tile model — purely presentational metadata for recording a winning hand.
 *
 * The engine never scores from tiles; variants ignore them. A tile is a short
 * id string ('m1', 'p5', 's9', 'we', 'dr', …) that maps to a Unicode mahjong
 * glyph (U+1F000 block) for display. Stored optionally on a WinDeclaration so a
 * recorded hand can be shown in history without changing any scoring path.
 */

export type Suit = 'm' | 'p' | 's';
export type TileId = string; // 'm1'..'m9' | 'p1'..'p9' | 's1'..'s9' | wind/dragon ids

/** Suit labels: characters (萬), dots (筒), bamboo (索). */
export const SUITS: readonly { id: Suit; label: string; cjk: string }[] = [
  { id: 'm', label: 'Characters', cjk: '萬' },
  { id: 'p', label: 'Dots', cjk: '筒' },
  { id: 's', label: 'Bamboo', cjk: '索' },
];

export const WINDS: readonly { id: TileId; label: string }[] = [
  { id: 'we', label: 'East' },
  { id: 'ws', label: 'South' },
  { id: 'ww', label: 'West' },
  { id: 'wn', label: 'North' },
];

export const DRAGONS: readonly { id: TileId; label: string }[] = [
  { id: 'dr', label: 'Red' },
  { id: 'dg', label: 'Green' },
  { id: 'dw', label: 'White' },
];

// Unicode mahjong tiles. Suits are contiguous 9-tile runs.
const SUIT_BASE: Record<Suit, number> = {
  m: 0x1f007, // characters 一萬..九萬
  s: 0x1f010, // bamboo 1..9
  p: 0x1f019, // dots 1..9
};
const HONOR_CP: Record<TileId, number> = {
  we: 0x1f000,
  ws: 0x1f001,
  ww: 0x1f002,
  wn: 0x1f003,
  dr: 0x1f004, // 中
  dg: 0x1f005, // 發
  dw: 0x1f006, // 白
};

/** Glyph for a tile id, or '?' if unknown. */
export function tileGlyph(id: TileId): string {
  if (id.length === 2 && (id[0] === 'm' || id[0] === 'p' || id[0] === 's')) {
    const n = Number(id[1]);
    if (n >= 1 && n <= 9) return String.fromCodePoint(SUIT_BASE[id[0] as Suit] + (n - 1));
  }
  const cp = HONOR_CP[id];
  return cp ? String.fromCodePoint(cp) : '?';
}

/** Short human label, e.g. '5 Dots', 'East', 'Red'. */
export function tileLabel(id: TileId): string {
  if (id.length === 2 && (id[0] === 'm' || id[0] === 'p' || id[0] === 's')) {
    const suit = SUITS.find((x) => x.id === id[0]);
    return `${id[1]} ${suit ? suit.label : id[0]}`;
  }
  return (
    WINDS.find((w) => w.id === id)?.label ??
    `${DRAGONS.find((d) => d.id === id)?.label ?? id} dragon`
  );
}

/** All selectable tile ids, in display order (3 suits × 9, then winds, dragons). */
export function allTiles(): TileId[] {
  const out: TileId[] = [];
  for (const s of SUITS) for (let n = 1; n <= 9; n++) out.push(`${s.id}${n}`);
  for (const w of WINDS) out.push(w.id);
  for (const d of DRAGONS) out.push(d.id);
  return out;
}

const ORDER: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  allTiles().forEach((id, i) => (m[id] = i));
  return m;
})();

/** Stable sort by the canonical tile order (man, sou… per allTiles). */
export function sortTiles(ids: readonly TileId[]): TileId[] {
  return [...ids].sort((a, b) => (ORDER[a] ?? 99) - (ORDER[b] ?? 99));
}
