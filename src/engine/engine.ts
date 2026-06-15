/**
 * Deterministic core engine. Owns: session lifecycle, score application,
 * dealer/wind rotation, dealer repeats, the ledger, undo, manual override,
 * serialization. All variant knowledge comes through VariantConfig.
 *
 * Sessions are immutable: every operation returns a new Session. Undo is a
 * snapshot restore — each ledger entry carries the table + variant state
 * as they were before the entry was applied.
 */

import {
  type GameEnd,
  type HandOutcome,
  type Seat,
  type Settings,
  type Settlement,
  type TableState,
  type VariantConfig,
} from './types.ts';

// ------------------------------------------------------------------ ledger

export type LedgerEntry<V, S> =
  | {
      kind: 'hand';
      at: number;
      outcome: HandOutcome<V>;
      settlement: Settlement;
      tableBefore: TableState;
      stateBefore: S;
      dealerRepeated: boolean;
    }
  | {
      kind: 'override';
      at: number;
      note: string;
      tableBefore: TableState;
      stateBefore: S;
    };

export interface Session<V, S> {
  variantId: string;
  players: readonly [string, string, string, string]; // by seat; seat 0 starts as East
  settings: Settings;
  table: TableState;
  state: S;
  ledger: readonly LedgerEntry<V, S>[];
  ended: GameEnd | null;
  startedAt: number;
}

// ---------------------------------------------------------------- creation

export function createSession<V, S>(
  variant: VariantConfig<V, S>,
  players: readonly [string, string, string, string],
  settings: Settings,
): Session<V, S> {
  const start = variant.startingScore(settings);
  return {
    variantId: variant.id,
    players,
    settings,
    table: {
      dealerSeat: 0,
      roundIndex: 0,
      dealerRepeat: 0,
      handOfRound: 1,
      scores: [start, start, start, start],
    },
    state: variant.initState(settings),
    ledger: [],
    ended: null,
    startedAt: Date.now(),
  };
}

// ----------------------------------------------------------------- helpers

function advanceTable(
  t: TableState,
  dealerRepeats: boolean,
  scores: readonly [number, number, number, number],
): TableState {
  if (dealerRepeats) {
    return { ...t, scores, dealerRepeat: t.dealerRepeat + 1 };
  }
  const nextDealer = ((t.dealerSeat + 1) % 4) as Seat;
  const wrapped = nextDealer === 0; // seat 0 is always the starting East
  return {
    dealerSeat: nextDealer,
    roundIndex: wrapped ? t.roundIndex + 1 : t.roundIndex,
    dealerRepeat: 0,
    handOfRound: wrapped ? 1 : t.handOfRound + 1,
    scores,
  };
}

function validateOutcome<V, S>(
  variant: VariantConfig<V, S>,
  settings: Settings,
  outcome: HandOutcome<V>,
): void {
  if (outcome.kind === 'win') {
    if (outcome.wins.length === 0) throw new Error('A win needs at least one winner.');
    const max = variant.maxWinners(settings);
    if (outcome.wins.length > max) {
      throw new Error(`This variant allows at most ${max} winner(s) per hand.`);
    }
    const seen = new Set<Seat>();
    for (const w of outcome.wins) {
      if (seen.has(w.winner)) throw new Error('Duplicate winner.');
      seen.add(w.winner);
      if (w.winType === 'discard') {
        if (w.discarder === undefined) throw new Error('A discard win needs a discarder.');
        if (w.discarder === w.winner) throw new Error('Winner cannot discard to themselves.');
      }
    }
    if (outcome.wins.length > 1) {
      const d = outcome.wins[0].discarder;
      const sameDiscard = outcome.wins.every((w) => w.winType === 'discard' && w.discarder === d);
      if (!sameDiscard) throw new Error('Multiple winners must all win off the same discard.');
    }
  } else if (!variant.drawTypes.some((d) => d.id === outcome.drawType)) {
    throw new Error(`Unknown draw type "${outcome.drawType}".`);
  }
}

// -------------------------------------------------------------- operations

export function recordHand<V, S>(
  variant: VariantConfig<V, S>,
  session: Session<V, S>,
  outcome: HandOutcome<V>,
): Session<V, S> {
  if (session.ended) throw new Error('Session has ended; undo or start a new one.');
  validateOutcome(variant, session.settings, outcome);

  const { table, state, settings } = session;
  const settlement = variant.settle(outcome, table, state, settings);
  const scores = table.scores.map((s, i) => s + settlement.deltas[i]) as unknown as readonly [
    number, number, number, number,
  ];
  const dealerRepeated = variant.dealerRepeats(outcome, table, settings);
  const nextTable = advanceTable(table, dealerRepeated, scores);
  const nextState = variant.nextState(outcome, table, state, settings);
  const ended = variant.gameEnd(nextTable, nextState, settings);

  return {
    ...session,
    table: nextTable,
    state: nextState,
    ended,
    ledger: [
      ...session.ledger,
      {
        kind: 'hand',
        at: Date.now(),
        outcome,
        settlement,
        tableBefore: table,
        stateBefore: state,
        dealerRepeated,
      },
    ],
  };
}

/** Undo the most recent ledger entry (hand or override). Full snapshot restore. */
export function undo<V, S>(session: Session<V, S>): Session<V, S> {
  const last = session.ledger[session.ledger.length - 1];
  if (!last) throw new Error('Nothing to undo.');
  return {
    ...session,
    table: last.tableBefore,
    state: last.stateBefore,
    ended: null, // a hand was recorded from that point, so the game had not ended there
    ledger: session.ledger.slice(0, -1),
  };
}

/** Manual override of rotation state (wrong dealer, skipped round, …). Undoable. */
export function overrideTable<V, S>(
  session: Session<V, S>,
  changes: Partial<Pick<TableState, 'dealerSeat' | 'roundIndex' | 'dealerRepeat' | 'handOfRound'>>,
  note = 'Manual override',
): Session<V, S> {
  return {
    ...session,
    ended: null,
    table: { ...session.table, ...changes },
    ledger: [
      ...session.ledger,
      { kind: 'override', at: Date.now(), note, tableBefore: session.table, stateBefore: session.state },
    ],
  };
}

// ------------------------------------------------------------ serialization

/** Sessions are plain JSON-safe data (variant state must be JSON-safe too). */
export function serializeSession<V, S>(session: Session<V, S>): string {
  return JSON.stringify(session);
}

export function deserializeSession<V, S>(json: string): Session<V, S> {
  return JSON.parse(json) as Session<V, S>;
}
