/**
 * Core engine types — variant-agnostic.
 *
 * Architecture: a deterministic engine owns universal state (players/seats,
 * wind rotation, dealer assignment and repeats, the hand-by-hand ledger,
 * score application, undo). A variant is a VariantConfig: a bag of pure
 * functions plus UI specs. Variants never mutate engine state; the engine
 * consults them at fixed points in the hand lifecycle:
 *
 *   record hand → parseValue          (validate the entered hand value)
 *               → settle              (per-seat score deltas)
 *               → dealerRepeats       (does the dealer keep the deal?)
 *               → nextState           (variant state: honba, riichi pot, …)
 *               → gameEnd             (is the session over?)
 *
 * Adding a third variant = one new file exporting a VariantConfig, plus one
 * line in the variant registry. No engine changes.
 */

// ------------------------------------------------------------ seats & winds

export type Seat = 0 | 1 | 2 | 3;
export const SEATS: readonly Seat[] = [0, 1, 2, 3];

export type Wind = 'E' | 'S' | 'W' | 'N';
export const WIND_ORDER: readonly Wind[] = ['E', 'S', 'W', 'N'];

/** Seat wind of `seat` given the current dealer (dealer is always East). */
export function seatWind(seat: Seat, dealerSeat: Seat): Wind {
  return WIND_ORDER[(seat - dealerSeat + 4) % 4];
}

// ------------------------------------------------------------- table state

/** Engine-owned state at the start of a hand. Variants read, never write. */
export interface TableState {
  dealerSeat: Seat;
  /**
   * 0 = East round, 1 = South, 2 = West, 3 = North. The engine increments it
   * each time the deal passes beyond the fourth dealer; it may exceed 3 —
   * the variant's gameEnd decides when the session actually stops.
   */
  roundIndex: number;
  /** Consecutive deals kept by the current dealer (0 on a fresh deal). */
  dealerRepeat: number;
  /** Hand number within the current round, 1-based. Dealer repeats do not increment it. */
  handOfRound: number;
  scores: readonly [number, number, number, number];
}

export function roundWind(t: TableState): Wind {
  return WIND_ORDER[t.roundIndex % 4];
}

// ---------------------------------------------------------------- settings

export type SettingValue = boolean | string | number;
export type Settings = Record<string, SettingValue>;

/** House-rule knobs. Rendered generically by the UI on session setup. */
export type SettingSpec =
  | { id: string; label: string; help?: string; type: 'boolean'; default: boolean }
  | { id: string; label: string; help?: string; type: 'number'; default: number; min: number; max: number }
  | {
      id: string;
      label: string;
      help?: string;
      type: 'choice';
      default: string;
      options: readonly { value: string; label: string }[];
    };

export function defaultSettings(specs: readonly SettingSpec[]): Settings {
  const s: Settings = {};
  for (const spec of specs) s[spec.id] = spec.default;
  return s;
}

// ------------------------------------------------------- hand value entry
//
// The "calculator seam": v1 collects these fields manually (big buttons).
// A future tile-pattern calculator only needs to produce the same raw
// Record<string, number> — nothing downstream changes.

export interface ValueFieldSpec {
  id: string; // e.g. 'fan' | 'han' | 'fu'
  label: string;
  type: 'integer' | 'choice';
  min?: number;
  max?: number;
  /** Allowed values when type === 'choice' (e.g. fu steps). */
  choices?: readonly number[];
  default?: number;
  /** Quick-pick buttons shown prominently in the entry UI. */
  quickValues?: readonly number[];
  help?: string;
  /** UI hint: dim/skip this field given the other raw values (e.g. fu at 5+ han). */
  relevantWhen?(raw: Record<string, number>): boolean;
}

export type ParseResult<V> = { ok: true; value: V } | { ok: false; error: string };

// -------------------------------------------------------- per-hand inputs
//
// Variant-specific facts the UI must collect alongside the outcome,
// e.g. riichi declarations, tenpai players at an exhaustive draw.
// All are seat multi-selects in v1.

export interface HandInputSpec {
  id: string;
  label: string;
  /** When the UI asks for this input. */
  appliesTo: 'always' | 'win' | { draw: string };
}

/** Collected per-hand inputs, keyed by HandInputSpec id. */
export type HandInputs = Record<string, readonly Seat[]>;

// -------------------------------------------------------------- outcomes

export interface WinDeclaration<V> {
  winner: Seat;
  winType: 'selfDraw' | 'discard';
  /** Required when winType === 'discard'. */
  discarder?: Seat;
  value: V;
  /**
   * Optional, presentational only. The full winning hand as tile ids and which
   * tile completed it (the discard thrown on a ron, the tile drawn on a tsumo).
   * The engine and variants never read these — they exist purely to record and
   * replay a hand in history. Omitted when the user skips tile entry.
   */
  hand?: readonly string[];
  winningTile?: string;
}

export interface DrawTypeSpec {
  id: string;
  label: string;
  help?: string;
}

export type HandOutcome<V> =
  | {
      kind: 'win';
      /** 1..maxWinners entries. >1 = multiple ron off the same discard. */
      wins: readonly WinDeclaration<V>[];
      inputs: HandInputs;
    }
  | {
      kind: 'draw';
      /** One of the variant's drawTypes ids. */
      drawType: string;
      inputs: HandInputs;
    };

// ------------------------------------------------------------- settlement

export interface Settlement {
  /**
   * Score change per seat. Need not sum to zero when a pot is involved
   * (riichi sticks enter/leave the pot, which lives in variant state).
   */
  deltas: [number, number, number, number];
  /** Human-readable explanation lines for the history timeline. */
  notes: string[];
}

export interface GameEnd {
  reason: string;
}

// ----------------------------------------------------------- the contract

export interface VariantConfig<V, S> {
  id: string;
  name: string;
  description: string;

  settings: readonly SettingSpec[];
  startingScore(settings: Settings): number;

  // ---- hand value entry (calculator seam) ----
  valueFields: readonly ValueFieldSpec[];
  parseValue(raw: Record<string, number>, settings: Settings): ParseResult<V>;
  /** Short label for history/summary, e.g. "5 fan" or "3 han 30 fu — Mangan". */
  describeValue(value: V, settings: Settings): string;

  // ---- outcome shape ----
  maxWinners(settings: Settings): number;
  handInputs: readonly HandInputSpec[];
  drawTypes: readonly DrawTypeSpec[];
  /**
   * Tiles in a complete winning hand including the winning tile (13+1 = 14 for
   * most variants, 16+1 = 17 for Taiwanese). UI-only: drives the optional tile
   * recorder. Defaults to 14 when omitted.
   */
  handTileCount?: number;

  // ---- variant state (honba, riichi pot, …; null if none) ----
  initState(settings: Settings): S;

  // ---- the money ----
  settle(outcome: HandOutcome<V>, table: TableState, state: S, settings: Settings): Settlement;

  // ---- rotation & flow ----
  dealerRepeats(outcome: HandOutcome<V>, table: TableState, settings: Settings): boolean;
  nextState(outcome: HandOutcome<V>, table: TableState, state: S, settings: Settings): S;
  /** Checked after deltas + rotation are applied. Return null to continue. */
  gameEnd(table: TableState, state: S, settings: Settings): GameEnd | null;

  // ---- presentation hooks ----
  /** e.g. "Honba 2 · 1 riichi stick", shown beside the round indicator. */
  statusText?(state: S, table: TableState, settings: Settings): string | null;
  /** Optional end-of-session adjusted standings (uma/oka). */
  finalStandings?(
    scores: readonly number[],
    settings: Settings,
  ): { label: string; values: number[] } | null;
}

/** Existential wrapper for registries/UI, which don't care about V/S. */
export type AnyVariant = VariantConfig<unknown, unknown>;
