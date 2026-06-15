/**
 * Malaysian mahjong — fan-based doubling with the Malaysian payment convention
 * and a flower/animal bonus seam.
 *
 * Points for a hand: P = 2^min(fan + bonus, fanCap), where `bonus` is the extra
 * fan from flowers and animals the player enters alongside the base hand fan.
 *
 * Payment (distinct from Hong Kong):
 *   Discard win (出統): the discarder alone pays 2 × P (放炮包).
 *   Self-draw (自摸):  every other player pays P each — winner collects 3 × P.
 *
 * House rules (settings, defaults flagged for review):
 *   minFan        minimum fan to win, flowers/animals count toward it (default 5)
 *   fanCap        doubling cap (default 10)
 *   countBonus    whether flower/animal bonus fan counts toward minFan (default on)
 *   drawDealer    dealer keeps the deal on a drawn hand (default on)
 *
 * Malaysian tables vary widely; this models the common Cantonese-derived style
 * documented for casual play. Out of scope v1: mid-hand instant flower/animal
 * and kong payouts, 8-flower bonanza, three-player Malaysian.
 */

import {
  SEATS,
  type ParseResult,
  type Settings,
  type Settlement,
  type VariantConfig,
} from '../engine/types.ts';

export interface MYValue {
  fan: number;
  /** Extra fan from flowers + animals. */
  bonus: number;
}

export type MYState = null;

const int = (s: Settings, id: string): number => Number(s[id]);

function points(total: number, settings: Settings): number {
  return 2 ** Math.min(total, int(settings, 'fanCap'));
}

export const malaysian: VariantConfig<MYValue, MYState> = {
  id: 'malaysian',
  name: 'Malaysian',
  description: 'Fan doubling with flowers & animals. Discarder pays double; self-draw paid by all.',

  settings: [
    { id: 'minFan', label: 'Minimum fan to win (起糊)', type: 'number', default: 5, min: 0, max: 10 },
    {
      id: 'fanCap',
      label: 'Fan cap (封頂)',
      type: 'choice',
      default: '10',
      options: [
        { value: '8', label: '8 fan' },
        { value: '10', label: '10 fan' },
        { value: '13', label: '13 fan' },
      ],
    },
    {
      id: 'countBonus',
      label: 'Flowers & animals count toward the minimum',
      type: 'boolean',
      default: true,
    },
    {
      id: 'drawDealerRepeats',
      label: 'Dealer keeps the deal on a drawn hand',
      type: 'boolean',
      default: true,
    },
    {
      id: 'gameRounds',
      label: 'Game length',
      type: 'choice',
      default: '4',
      options: [
        { value: '1', label: 'One round (一圈)' },
        { value: '4', label: 'Four rounds (一將)' },
      ],
    },
  ],

  startingScore: () => 0,

  valueFields: [
    {
      id: 'fan',
      label: 'Fan (番)',
      type: 'integer',
      min: 0,
      max: 13,
      default: 5,
      quickValues: [3, 4, 5, 6, 7, 8],
    },
    {
      id: 'bonus',
      label: 'Flowers + animals (番)',
      type: 'integer',
      min: 0,
      max: 8,
      default: 0,
      quickValues: [0, 1, 2, 3, 4],
      help: 'Extra fan from flower and animal tiles.',
    },
  ],

  parseValue(raw, settings): ParseResult<MYValue> {
    const fan = raw.fan;
    const bonus = raw.bonus ?? 0;
    if (!Number.isInteger(fan) || fan < 0) return { ok: false, error: 'Fan must be a whole number ≥ 0.' };
    if (!Number.isInteger(bonus) || bonus < 0) return { ok: false, error: 'Bonus fan must be a whole number ≥ 0.' };
    const min = int(settings, 'minFan');
    const counted = settings.countBonus === true ? fan + bonus : fan;
    if (counted < min) return { ok: false, error: `House rule: minimum ${min} fan to win.` };
    return { ok: true, value: { fan, bonus } };
  },

  describeValue(value, settings) {
    const total = value.fan + value.bonus;
    const cap = int(settings, 'fanCap');
    const capped = total >= cap ? ' · limit (封頂)' : '';
    const bonusPart = value.bonus > 0 ? ` +${value.bonus} bonus` : '';
    return `${value.fan} fan${bonusPart}${capped}`;
  },

  maxWinners: () => 1,
  handInputs: [],
  drawTypes: [{ id: 'exhaustive', label: 'Drawn hand (流局)' }],

  initState: () => null,

  settle(outcome, _table, _state, settings): Settlement {
    const deltas: [number, number, number, number] = [0, 0, 0, 0];
    if (outcome.kind === 'draw') {
      return { deltas, notes: ['Drawn hand — no payments.'] };
    }
    const win = outcome.wins[0];
    const P = points(win.value.fan + win.value.bonus, settings);
    const notes: string[] = [];

    if (win.winType === 'selfDraw') {
      for (const s of SEATS) {
        if (s === win.winner) continue;
        deltas[s] -= P;
        deltas[win.winner] += P;
      }
      notes.push(`Self-draw: each player pays ${P}.`);
    } else {
      const d = win.discarder!;
      deltas[d] -= 2 * P;
      deltas[win.winner] += 2 * P;
      notes.push(`出統: discarder pays ${2 * P}.`);
    }
    return { deltas, notes };
  },

  dealerRepeats(outcome, table, settings) {
    if (outcome.kind === 'draw') return settings.drawDealerRepeats === true;
    return outcome.wins.some((w) => w.winner === table.dealerSeat);
  },

  nextState: () => null,

  gameEnd(table, _state, settings) {
    const rounds = int(settings, 'gameRounds');
    if (table.roundIndex >= rounds) {
      return { reason: rounds === 1 ? 'East round complete.' : 'All four rounds complete.' };
    }
    return null;
  },
};
