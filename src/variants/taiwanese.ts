/**
 * Taiwanese 16-tile mahjong (台灣十六張麻將) — 底 + 台 scoring.
 *
 * Each hand is worth a fixed base (底) plus its tai count (台) times a per-tai
 * value. Payment per paying player:
 *
 *   amount = 底 + (台 + bonuses) × taiValue
 *
 *   Discard win (放槍): the discarder alone pays `amount` (放槍包賠).
 *   Self-draw (自摸):  every other player pays `amount` (winner collects 3×).
 *
 * Bonuses (settings-driven, defaults flagged for review):
 *   self-draw            +selfDrawTai 台 (自摸, default 1)
 *   dealer continuation  +lianzhuangTai × dealerRepeat 台 (連N拉N, default 2/streak),
 *                        carried by the dealer only: the dealer pays it when
 *                        losing the hand and collects it when winning.
 *
 * Rotation: dealer keeps the deal on a win or (configurable) a draw — 連莊.
 * One winner per hand (搶聽 nearest claimant). Running net points; no pot.
 *
 * Out of scope v1: per-tai pattern detection (the player enters the tai total),
 * 詐胡 penalties, 花槓 instant flower payouts, 包牌 liability transfer.
 */

import {
  SEATS,
  type ParseResult,
  type Settings,
  type Settlement,
  type VariantConfig,
} from '../engine/types.ts';

export interface TWValue {
  tai: number;
}

/** Taiwanese carries no cross-hand state; 連莊 lives in engine dealerRepeat. */
export type TWState = null;

const int = (s: Settings, id: string): number => Number(s[id]);

export const taiwanese: VariantConfig<TWValue, TWState> = {
  id: 'taiwanese-16',
  name: 'Taiwanese (16-tile)',
  description: '底 + 台 scoring. Shooter pays alone; self-draw paid by all three.',

  handTileCount: 17, // 16 + the winning tile

  settings: [
    { id: 'baseDi', label: 'Base (底)', type: 'number', default: 1, min: 0, max: 100 },
    { id: 'taiValue', label: 'Points per tai (台)', type: 'number', default: 1, min: 1, max: 100 },
    { id: 'minTai', label: 'Minimum tai to win (起胡台)', type: 'number', default: 0, min: 0, max: 10 },
    {
      id: 'selfDrawTai',
      label: 'Self-draw bonus (自摸台)',
      type: 'number',
      default: 1,
      min: 0,
      max: 5,
    },
    {
      id: 'lianzhuangTai',
      label: 'Dealer-streak bonus per repeat (連N拉N 台)',
      type: 'number',
      default: 2,
      min: 0,
      max: 4,
    },
    {
      id: 'drawDealerRepeats',
      label: 'Dealer keeps the deal on a drawn hand (流局連莊)',
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

  startingScore: () => 0, // running net points

  valueFields: [
    {
      id: 'tai',
      label: 'Tai (台)',
      type: 'integer',
      min: 0,
      max: 50,
      default: 1,
      quickValues: [1, 2, 3, 4, 5, 8],
    },
  ],

  parseValue(raw, settings): ParseResult<TWValue> {
    const tai = raw.tai;
    if (!Number.isInteger(tai) || tai < 0) return { ok: false, error: 'Tai must be a whole number ≥ 0.' };
    const min = int(settings, 'minTai');
    if (tai < min) return { ok: false, error: `House rule: minimum ${min} tai to win.` };
    return { ok: true, value: { tai } };
  },

  describeValue(value) {
    return `${value.tai} 台`;
  },

  maxWinners: () => 1,
  handInputs: [],
  drawTypes: [{ id: 'exhaustive', label: 'Drawn hand (流局)' }],

  initState: () => null,

  settle(outcome, table, _state, settings): Settlement {
    const deltas: [number, number, number, number] = [0, 0, 0, 0];
    if (outcome.kind === 'draw') {
      return { deltas, notes: ['Drawn hand — no payments.'] };
    }

    const win = outcome.wins[0];
    const baseDi = int(settings, 'baseDi');
    const taiValue = int(settings, 'taiValue');
    const selfDrawTai = int(settings, 'selfDrawTai');
    const lzTai = int(settings, 'lianzhuangTai') * table.dealerRepeat;
    const lzPoints = lzTai * taiValue;
    const notes: string[] = [];

    const taiCount = win.value.tai + (win.winType === 'selfDraw' ? selfDrawTai : 0);
    const amount = baseDi + taiCount * taiValue;
    const dealer = table.dealerSeat;

    const pay = (payer: number, base: number) => {
      // The dealer's streak bonus rides with the dealer: collected if the dealer
      // wins, surcharged if the dealer is the one paying.
      let extra = 0;
      if (lzPoints > 0) {
        if (win.winner === dealer) extra = lzPoints;
        else if (payer === dealer) extra = lzPoints;
      }
      deltas[payer] -= base + extra;
      deltas[win.winner] += base + extra;
    };

    if (win.winType === 'selfDraw') {
      for (const s of SEATS) if (s !== win.winner) pay(s, amount);
      notes.push(`Self-draw: each player pays ${amount}${win.value.tai >= 0 ? ` (${taiCount} 台)` : ''}.`);
    } else {
      pay(win.discarder!, amount);
      notes.push(`放槍: discarder pays ${amount} (${taiCount} 台).`);
    }
    if (lzPoints > 0) notes.push(`連莊 bonus: ${lzTai} 台 (${lzPoints}) on the dealer.`);
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

  statusText(_state, table) {
    return table.dealerRepeat > 0 ? `連莊 ×${table.dealerRepeat}` : null;
  },
};
