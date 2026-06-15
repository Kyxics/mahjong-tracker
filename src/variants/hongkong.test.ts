import test from 'node:test';
import assert from 'node:assert/strict';

import { createSession, recordHand } from '../engine/engine.ts';
import { defaultSettings, type HandOutcome, type Seat, type TableState } from '../engine/types.ts';
import { hongKong, type HKValue } from './hongkong.ts';

const PLAYERS = ['Ann', 'Bo', 'Cyn', 'Dee'] as const;
const SETTINGS = defaultSettings(hongKong.settings);
const TABLE: TableState = { dealerSeat: 0, roundIndex: 0, dealerRepeat: 0, handOfRound: 1, scores: [0, 0, 0, 0] };

const ron = (winner: Seat, discarder: Seat, fan: number): HandOutcome<HKValue> => ({
  kind: 'win',
  wins: [{ winner, winType: 'discard', discarder, value: { fan } }],
  inputs: {},
});
const tsumo = (winner: Seat, fan: number): HandOutcome<HKValue> => ({
  kind: 'win',
  wins: [{ winner, winType: 'selfDraw', value: { fan } }],
  inputs: {},
});

test('half-shooter: discarder 2 shares, others 1 share; self-draw 2 shares each', () => {
  // 3 fan → base 8. Ron: 16 + 8 + 8 = 32 to winner.
  assert.deepEqual(hongKong.settle(ron(1, 3, 3), TABLE, null, SETTINGS).deltas, [-8, 32, -8, -16]);
  // Self-draw: 16 × 3 = 48.
  assert.deepEqual(hongKong.settle(tsumo(1, 3), TABLE, null, SETTINGS).deltas, [-16, 48, -16, -16]);
});

test('full-shooter: discarder alone pays the self-draw total', () => {
  const s = { ...SETTINGS, payment: 'full' };
  assert.deepEqual(hongKong.settle(ron(1, 3, 3), TABLE, null, s).deltas, [0, 48, 0, -48]);
  assert.deepEqual(hongKong.settle(tsumo(1, 3), TABLE, null, s).deltas, [-16, 48, -16, -16]);
});

test('fan cap limits the base', () => {
  // Cap 8: 13 fan pays as 8 fan (base 256).
  assert.deepEqual(hongKong.settle(ron(0, 1, 13), TABLE, null, SETTINGS).deltas, [1024, -512, -256, -256]);
  const s13 = { ...SETTINGS, fanCap: '13' };
  assert.deepEqual(hongKong.settle(ron(0, 1, 13), TABLE, null, s13).deltas[0], 4 * 8192);
});

test('zero-sum in both payment styles', () => {
  for (const payment of ['half', 'full']) {
    const d = hongKong.settle(ron(2, 0, 5), TABLE, null, { ...SETTINGS, payment }).deltas;
    assert.equal(d.reduce((a, b) => a + b, 0), 0);
  }
});

test('minimum fan to win is enforced at parse time', () => {
  assert.equal(hongKong.parseValue({ fan: 2 }, SETTINGS).ok, false);
  assert.equal(hongKong.parseValue({ fan: 3 }, SETTINGS).ok, true);
  assert.equal(hongKong.parseValue({ fan: 0 }, { ...SETTINGS, minFan: 0 }).ok, true);
  assert.equal(hongKong.parseValue({ fan: 2.5 }, { ...SETTINGS, minFan: 0 }).ok, false);
});

test('draw: no payments, dealer keeps deal by default, passes if configured', () => {
  let s = createSession(hongKong, PLAYERS, SETTINGS);
  s = recordHand(hongKong, s, { kind: 'draw', drawType: 'exhaustive', inputs: {} });
  assert.deepEqual(s.table.scores, [0, 0, 0, 0]);
  assert.equal(s.table.dealerSeat, 0);
  assert.equal(s.table.dealerRepeat, 1);

  let t = createSession(hongKong, PLAYERS, { ...SETTINGS, drawDealerRepeats: false });
  t = recordHand(hongKong, t, { kind: 'draw', drawType: 'exhaustive', inputs: {} });
  assert.equal(t.table.dealerSeat, 1);
});

test('game ends after four rounds (16 dealer passes)', () => {
  let s = createSession(hongKong, PLAYERS, SETTINGS);
  for (let i = 0; i < 16; i++) {
    assert.equal(s.ended, null);
    s = recordHand(hongKong, s, ron((((i + 1) % 4) as Seat), ((i % 4) as Seat), 3));
  }
  assert.ok(s.ended);
  assert.match(s.ended!.reason, /four rounds/);
});

test('dealer streak: repeated dealer wins keep the seat and count repeats', () => {
  let s = createSession(hongKong, PLAYERS, SETTINGS);
  for (let i = 0; i < 3; i++) s = recordHand(hongKong, s, tsumo(0, 4));
  assert.equal(s.table.dealerSeat, 0);
  assert.equal(s.table.dealerRepeat, 3);
  assert.equal(s.table.handOfRound, 1);
});
