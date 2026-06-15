import test from 'node:test';
import assert from 'node:assert/strict';

import { createSession, recordHand } from '../engine/engine.ts';
import { defaultSettings, type HandOutcome, type Seat, type TableState } from '../engine/types.ts';
import { taiwanese, type TWValue } from './taiwanese.ts';

const PLAYERS = ['Ann', 'Bo', 'Cyn', 'Dee'] as const;
const SETTINGS = defaultSettings(taiwanese.settings);
const TABLE: TableState = { dealerSeat: 0, roundIndex: 0, dealerRepeat: 0, handOfRound: 1, scores: [0, 0, 0, 0] };

const ron = (winner: Seat, discarder: Seat, tai: number): HandOutcome<TWValue> => ({
  kind: 'win',
  wins: [{ winner, winType: 'discard', discarder, value: { tai } }],
  inputs: {},
});
const tsumo = (winner: Seat, tai: number): HandOutcome<TWValue> => ({
  kind: 'win',
  wins: [{ winner, winType: 'selfDraw', value: { tai } }],
  inputs: {},
});

test('discard win: shooter alone pays 底 + 台×value', () => {
  // base 1 + 2 tai × 1 = 3, discarder pays alone.
  assert.deepEqual(taiwanese.settle(ron(1, 3, 2), TABLE, null, SETTINGS).deltas, [0, 3, 0, -3]);
});

test('self-draw: every other player pays, +1 self-draw tai', () => {
  // tai 2 + selfDrawTai 1 = 3 → amount 1 + 3 = 4, three payers.
  assert.deepEqual(taiwanese.settle(tsumo(1, 2), TABLE, null, SETTINGS).deltas, [-4, 12, -4, -4]);
});

test('連莊 bonus rides with the dealer when the dealer wins', () => {
  const t: TableState = { ...TABLE, dealerRepeat: 2 };
  // amount 1 + 1 = 2; lz = 2×2 = 4 added to the discarder's payment.
  assert.deepEqual(taiwanese.settle(ron(0, 2, 1), t, null, SETTINGS).deltas, [6, 0, -6, 0]);
});

test('連莊 bonus rides with the dealer when the dealer pays', () => {
  const t: TableState = { ...TABLE, dealerRepeat: 2 };
  // seat 2 wins off dealer seat 0: amount 2 + lz 4 = 6 paid by the dealer.
  assert.deepEqual(taiwanese.settle(ron(2, 0, 1), t, null, SETTINGS).deltas, [-6, 0, 6, 0]);
});

test('settlements are zero-sum', () => {
  for (const o of [ron(2, 0, 5), tsumo(3, 4), ron(0, 1, 1)]) {
    const d = taiwanese.settle(o, { ...TABLE, dealerRepeat: 1 }, null, SETTINGS).deltas;
    assert.equal(d.reduce((a, b) => a + b, 0), 0);
  }
});

test('minimum tai is enforced at parse time', () => {
  assert.equal(taiwanese.parseValue({ tai: 0 }, SETTINGS).ok, true);
  assert.equal(taiwanese.parseValue({ tai: 1 }, { ...SETTINGS, minTai: 2 }).ok, false);
  assert.equal(taiwanese.parseValue({ tai: 2.5 }, SETTINGS).ok, false);
});

test('draw keeps the deal by default; passes if configured', () => {
  let s = createSession(taiwanese, PLAYERS, SETTINGS);
  s = recordHand(taiwanese, s, { kind: 'draw', drawType: 'exhaustive', inputs: {} });
  assert.equal(s.table.dealerSeat, 0);
  assert.equal(s.table.dealerRepeat, 1);

  let t = createSession(taiwanese, PLAYERS, { ...SETTINGS, drawDealerRepeats: false });
  t = recordHand(taiwanese, t, { kind: 'draw', drawType: 'exhaustive', inputs: {} });
  assert.equal(t.table.dealerSeat, 1);
});

test('game ends after four rounds', () => {
  let s = createSession(taiwanese, PLAYERS, SETTINGS);
  for (let i = 0; i < 16; i++) {
    assert.equal(s.ended, null);
    s = recordHand(taiwanese, s, ron((((i + 1) % 4) as Seat), ((i % 4) as Seat), 2));
  }
  assert.ok(s.ended);
});
