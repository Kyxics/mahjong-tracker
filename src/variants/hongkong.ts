/**
 * Hong Kong Old Style (廣東牌 / HKOS) — fan-based doubling.
 *
 * Scoring: base = 2^min(fan, fanCap). Payment styles (house rules vary —
 * both are settings, defaults flagged for review):
 *
 *   Half-shooter (半銃, default):
 *     ron   — discarder pays 2×base, the other two pay 1×base each (total 4×)
 *     tsumo — every player pays 2×base (total 6×)
 *   Full-shooter (全銃):
 *     ron   — discarder alone pays the full self-draw total, 6×base
 *     tsumo — every player pays 2×base
 *
 * No cross-hand state (no honba/pot). Draws: traditionally replayed with the
 * same dealer (連莊) and no payments; dealer-keeps is a setting.
 * One winner per hand (搶糊 — nearest claimant takes it).
 */

import {
  SEATS,
  type ParseResult,
  type Settings,
  type Settlement,
  type VariantConfig,
} from '../engine/types.ts';

export interface HKValue {
  fan: number;
}

/** HK carries no state between hands. */
export type HKState = null;

const int = (s: Settings, id: string): number => Number(s[id]);

function baseShare(fan: number, settings: Settings): number {
  return 2 ** Math.min(fan, int(settings, 'fanCap'));
}

export const hongKong: VariantConfig<HKValue, HKState> = {
  id: 'hk-old-style',
  name: 'Hong Kong (Old Style)',
  description: 'Fan-based doubling with a cap. Half- or full-shooter payment.',

  settings: [
    {
      id: 'minFan',
      label: 'Minimum fan to win (起糊)',
      type: 'number',
      default: 3,
      min: 0,
      max: 8,
    },
    {
      id: 'fanCap',
      label: 'Fan cap (滿糊)',
      type: 'choice',
      default: '8',
      options: [
        { value: '8', label: '8 fan' },
        { value: '10', label: '10 fan' },
        { value: '13', label: '13 fan' },
      ],
    },
    {
      id: 'payment',
      label: 'Payment style',
      type: 'choice',
      default: 'half',
      options: [
        { value: 'half', label: 'Half-shooter (半銃)' },
        { value: 'full', label: 'Full-shooter (全銃)' },
      ],
      help: 'Half: discarder pays double share, others single. Full: discarder pays the whole self-draw amount alone.',
    },
    {
      id: 'drawDealerRepeats',
      label: 'Dealer keeps deal on a drawn hand',
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

  startingScore: () => 0, // running net points; negatives are fine

  valueFields: [
    {
      id: 'fan',
      label: 'Fan (番)',
      type: 'integer',
      min: 0,
      max: 13,
      default: 3,
      quickValues: [3, 4, 5, 6, 7, 8],
    },
  ],

  parseValue(raw, settings): ParseResult<HKValue> {
    const fan = raw.fan;
    if (!Number.isInteger(fan) || fan < 0) return { ok: false, error: 'Fan must be a whole number ≥ 0.' };
    const min = int(settings, 'minFan');
    if (fan < min) return { ok: false, error: `House rule: minimum ${min} fan to win.` };
    return { ok: true, value: { fan } };
  },

  describeValue(value, settings) {
    const cap = int(settings, 'fanCap');
    const capped = value.fan >= cap ? ' · limit (滿糊)' : '';
    return `${value.fan} fan${capped}`;
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
    const share = baseShare(win.value.fan, settings);
    const notes: string[] = [];

    if (win.winType === 'selfDraw') {
      for (const s of SEATS) {
        if (s === win.winner) continue;
        deltas[s] -= 2 * share;
        deltas[win.winner] += 2 * share;
      }
      notes.push(`Self-draw: each player pays ${2 * share}.`);
    } else {
      const d = win.discarder!;
      if (settings.payment === 'full') {
        deltas[d] -= 6 * share;
        deltas[win.winner] += 6 * share;
        notes.push(`Full-shooter: discarder pays ${6 * share}.`);
      } else {
        for (const s of SEATS) {
          if (s === win.winner) continue;
          const pay = s === d ? 2 * share : share;
          deltas[s] -= pay;
          deltas[win.winner] += pay;
        }
        notes.push(`Discarder pays ${2 * share}, the other two pay ${share} each.`);
      }
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
