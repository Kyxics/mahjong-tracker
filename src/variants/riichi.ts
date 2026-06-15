/**
 * Riichi (Japanese) mahjong — han + fu with point tables.
 *
 * base = fu × 2^(2+han), capped by limits:
 *   base > 2000 → Mangan (2000) · han 5 → Mangan · 6–7 → Haneman (3000)
 *   8–10 → Baiman (4000) · 11–12 → Sanbaiman (6000) · 13+ → Yakuman (8000,
 *   stacked: 26 han = double yakuman). Optional kiriage mangan rounds
 *   4 han 30 fu and 3 han 60 fu up to mangan.
 *
 * Payments (rounded up to the nearest 100):
 *   non-dealer ron 4×base · dealer ron 6×base
 *   non-dealer tsumo: dealer 2×base, others 1×base · dealer tsumo: all 2×base
 *   honba: +300 per counter on ron (from discarder), +100 per payer on tsumo
 *
 * Riichi sticks: 1000 from each declarer when declared (recorded with the
 * hand); winner takes the pot. Pot carries over draws. With multiple ron the
 * pot and honba go to the winner nearest the discarder's right (documented
 * simplification: honba to that winner only).
 *
 * Exhaustive draw: noten penalty totalling 3000 between tenpai/noten players;
 * dealer keeps the deal iff tenpai. Abortive draw: no payments, dealer keeps,
 * honba +1. Out of scope v1: nagashi mangan, agariyame, enchousen (West-round
 * extension), pao.
 */

import {
  SEATS,
  type ParseResult,
  type Seat,
  type Settlement,
  type VariantConfig,
} from '../engine/types.ts';

export interface RiichiValue {
  han: number;
  /** Ignored (0) when han ≥ 5. */
  fu: number;
}

export interface RiichiState {
  honba: number;
  /** Riichi sticks in the pot (count, 1000 points each). */
  riichiPot: number;
}

const FU_CHOICES = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110] as const;

const ceil100 = (x: number) => Math.ceil(x / 100) * 100;

export function basePoints(
  han: number,
  fu: number,
  kiriage: boolean,
): { base: number; limit: string | null } {
  if (han >= 13) return { base: 8000 * Math.floor(han / 13), limit: 'Yakuman' };
  if (han >= 11) return { base: 6000, limit: 'Sanbaiman' };
  if (han >= 8) return { base: 4000, limit: 'Baiman' };
  if (han >= 6) return { base: 3000, limit: 'Haneman' };
  if (han === 5) return { base: 2000, limit: 'Mangan' };
  const raw = fu * 2 ** (2 + han);
  if (raw > 2000) return { base: 2000, limit: 'Mangan' };
  if (kiriage && ((han === 4 && fu === 30) || (han === 3 && fu === 60))) {
    return { base: 2000, limit: 'Mangan (kiriage)' };
  }
  return { base: raw, limit: null };
}

/** Winner nearest the discarder's right (turn order) — gets pot + honba on multi-ron. */
function nearestWinner(discarder: Seat, winners: readonly Seat[]): Seat {
  for (let i = 1; i <= 3; i++) {
    const s = ((discarder + i) % 4) as Seat;
    if (winners.includes(s)) return s;
  }
  return winners[0];
}

export const riichi: VariantConfig<RiichiValue, RiichiState> = {
  id: 'riichi',
  name: 'Riichi (Japanese)',
  description: 'Han + fu point tables, honba, riichi sticks, noten penalties.',

  settings: [
    {
      id: 'gameLength',
      label: 'Game length',
      type: 'choice',
      default: 'hanchan',
      options: [
        { value: 'tonpuusen', label: 'East only (tonpuusen)' },
        { value: 'hanchan', label: 'East + South (hanchan)' },
      ],
    },
    {
      id: 'tobi',
      label: 'Game ends if a player goes below zero (tobi)',
      type: 'boolean',
      default: true,
    },
    {
      id: 'kiriageMangan',
      label: 'Round 4 han 30 fu / 3 han 60 fu up to mangan (kiriage)',
      type: 'boolean',
      default: false,
    },
    {
      id: 'atamahane',
      label: 'Head bump: only one winner per discard (atamahane)',
      type: 'boolean',
      default: false,
      help: 'Off = multiple ron allowed. Tables that abort on triple ron can record an abortive draw instead.',
    },
    {
      id: 'uma',
      label: 'Uma (rank bonus, thousands)',
      type: 'choice',
      default: '10-20',
      options: [
        { value: 'none', label: 'None' },
        { value: '5-10', label: '5 / 10' },
        { value: '10-20', label: '10 / 20' },
      ],
    },
    {
      id: 'oka',
      label: 'Oka: rank points target 30,000, winner takes the ante (+20)',
      type: 'boolean',
      default: false,
    },
  ],

  startingScore: () => 25000,

  valueFields: [
    {
      id: 'han',
      label: 'Han (飜)',
      type: 'integer',
      min: 1,
      max: 39,
      quickValues: [1, 2, 3, 4, 5, 6, 8, 13],
    },
    {
      id: 'fu',
      label: 'Fu (符)',
      type: 'choice',
      choices: FU_CHOICES,
      default: 30,
      help: 'Ignored at 5+ han (limit hands).',
      relevantWhen: (raw) => (raw.han ?? 1) < 5,
    },
  ],

  parseValue(raw, settings): ParseResult<RiichiValue> {
    const han = raw.han;
    if (!Number.isInteger(han) || han < 1) return { ok: false, error: 'Han must be a whole number ≥ 1.' };
    if (han >= 5) return { ok: true, value: { han, fu: 0 } };
    const fu = raw.fu;
    if (!FU_CHOICES.includes(fu as (typeof FU_CHOICES)[number])) {
      return { ok: false, error: `Fu must be one of ${FU_CHOICES.join(', ')}.` };
    }
    return { ok: true, value: { han, fu } };
  },

  describeValue(value, settings) {
    const { limit } = basePoints(value.han, value.fu, settings.kiriageMangan === true);
    const fuPart = value.han >= 5 ? '' : ` ${value.fu} fu`;
    return `${value.han} han${fuPart}${limit ? ` — ${limit}` : ''}`;
  },

  maxWinners: (settings) => (settings.atamahane === true ? 1 : 3),

  handInputs: [
    { id: 'riichi', label: 'Riichi declared by', appliesTo: 'always' },
    { id: 'tenpai', label: 'Tenpai at the draw', appliesTo: { draw: 'exhaustive' } },
  ],

  drawTypes: [
    { id: 'exhaustive', label: 'Exhaustive draw (ryuukyoku)' },
    { id: 'abortive', label: 'Abortive draw', help: 'Nine terminals, four winds, four kans, etc.' },
  ],

  initState: () => ({ honba: 0, riichiPot: 0 }),

  settle(outcome, table, state, settings): Settlement {
    const deltas: [number, number, number, number] = [0, 0, 0, 0];
    const notes: string[] = [];

    // Riichi sticks are paid at declaration, i.e. with this hand's entry.
    const declarers = outcome.inputs['riichi'] ?? [];
    for (const s of declarers) deltas[s] -= 1000;
    if (declarers.length > 0) notes.push(`Riichi: ${declarers.length} × 1000 to the pot.`);
    const potValue = (state.riichiPot + declarers.length) * 1000;

    if (outcome.kind === 'draw') {
      if (outcome.drawType === 'exhaustive') {
        const tenpai = outcome.inputs['tenpai'] ?? [];
        const t = tenpai.length;
        if (t > 0 && t < 4) {
          const gain = 3000 / t;
          const loss = 3000 / (4 - t);
          for (const s of SEATS) deltas[s] += tenpai.includes(s) ? gain : -loss;
          notes.push(`Noten penalty: tenpai +${gain}, noten −${loss}.`);
        } else {
          notes.push('No noten penalty (all or none tenpai).');
        }
      } else {
        notes.push('Abortive draw — no payments.');
      }
      if (potValue > 0) notes.push(`Pot carries over: ${potValue}.`);
      return { deltas, notes };
    }

    // Win(s). Multiple entries = multi-ron off the same discard.
    const kiriage = settings.kiriageMangan === true;
    const winnerSeats = outcome.wins.map((w) => w.winner);

    for (const win of outcome.wins) {
      const isDealer = win.winner === table.dealerSeat;
      const { base, limit } = basePoints(win.value.han, win.value.fu, kiriage);
      const limitNote = limit ? ` (${limit})` : '';

      if (win.winType === 'selfDraw') {
        for (const s of SEATS) {
          if (s === win.winner) continue;
          const share = isDealer || s === table.dealerSeat ? 2 * base : base;
          const pay = ceil100(share) + 100 * state.honba;
          deltas[s] -= pay;
          deltas[win.winner] += pay;
        }
        notes.push(`Tsumo${limitNote}${state.honba ? `, +${100 * state.honba} each for honba` : ''}.`);
      } else {
        const total = ceil100((isDealer ? 6 : 4) * base);
        const honbaBonus =
          win.winner === nearestWinner(win.discarder!, winnerSeats) ? 300 * state.honba : 0;
        deltas[win.discarder!] -= total + honbaBonus;
        deltas[win.winner] += total + honbaBonus;
        notes.push(
          `Ron ${total}${limitNote}${honbaBonus ? ` +${honbaBonus} honba` : ''} from discarder.`,
        );
      }
    }

    if (potValue > 0) {
      const first = outcome.wins[0];
      const potTo =
        first.winType === 'discard'
          ? nearestWinner(first.discarder!, winnerSeats)
          : first.winner;
      deltas[potTo] += potValue;
      notes.push(`Riichi pot ${potValue} to the winner.`);
    }

    return { deltas, notes };
  },

  dealerRepeats(outcome, table, _settings) {
    if (outcome.kind === 'win') return outcome.wins.some((w) => w.winner === table.dealerSeat);
    if (outcome.drawType === 'exhaustive') {
      return (outcome.inputs['tenpai'] ?? []).includes(table.dealerSeat);
    }
    return true; // abortive: dealer keeps the deal
  },

  nextState(outcome, table, state, _settings): RiichiState {
    const declared = (outcome.inputs['riichi'] ?? []).length;
    if (outcome.kind === 'win') {
      const dealerWon = outcome.wins.some((w) => w.winner === table.dealerSeat);
      return { honba: dealerWon ? state.honba + 1 : 0, riichiPot: 0 };
    }
    return { honba: state.honba + 1, riichiPot: state.riichiPot + declared };
  },

  gameEnd(table, _state, settings) {
    if (settings.tobi === true && table.scores.some((s) => s < 0)) {
      return { reason: 'A player dropped below zero (tobi).' };
    }
    const limit = settings.gameLength === 'tonpuusen' ? 1 : 2;
    if (table.roundIndex >= limit) {
      return { reason: limit === 1 ? 'East round complete.' : 'South round complete.' };
    }
    return null;
  },

  statusText(state) {
    const parts: string[] = [];
    if (state.honba > 0) parts.push(`Honba ${state.honba}`);
    if (state.riichiPot > 0)
      parts.push(`${state.riichiPot} riichi stick${state.riichiPot > 1 ? 's' : ''}`);
    return parts.length ? parts.join(' · ') : null;
  },

  finalStandings(scores, settings) {
    const umaTable: Record<string, number[]> = {
      'none': [0, 0, 0, 0],
      '5-10': [10, 5, -5, -10],
      '10-20': [20, 10, -10, -20],
    };
    const uma = umaTable[String(settings.uma)] ?? umaTable['none'];
    const oka = settings.oka === true;
    if (!oka && settings.uma === 'none') return null;

    // Rank: score desc, ties broken by seat order (closer to starting East wins).
    const order = [...SEATS].sort((a, b) => scores[b] - scores[a] || a - b);
    const target = oka ? 30000 : 25000;
    const values = [0, 0, 0, 0];
    order.forEach((seat, rank) => {
      values[seat] = (scores[seat] - target) / 1000 + uma[rank] + (oka && rank === 0 ? 20 : 0);
    });
    return { label: 'Rank points', values };
  },
};
