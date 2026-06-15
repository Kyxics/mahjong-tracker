import test from 'node:test';
import assert from 'node:assert/strict';

import { createSession, recordHand } from '../engine/engine.ts';
import { defaultSettings, type HandOutcome, type Seat, type TableState } from '../engine/types.ts';
import { malaysian, type MYValue } from './malaysian.ts';

const PLAYERS = ['Ann', 'Bo', 'Cyn', 'Dee'] as const;
const SETTINGS = defaultSettings(malaysian.settings);
const TABLE: TableState = { dealerSeat: 0, roundIndex: 0, dealerRepeat: 0, handOfRound: 1, scores: [0, 0, 0, 0] };

const ron = (winner: Seat, discarder: Seat, fan: number, bonus = 0): HandOutcome<MYValue> => ({
  kind: 'win',
  wins: [{ winner, winType: 'discard', discarder, value: { fan, bonus } }],
  inputs: {},
});
const tsumo = (winner: Seat, fan: number, bonus = 0): HandOutcome<MYValue> => ({
  kind: 'win',
  wins: [{ winner, winType: 'selfDraw', value: { fan, bonus } }],
  inputs: {},
});

test('discard win: discarder alone pays 2 × points', () => {
  // 5 fan → P = 32, discarder pays 64.
  assert.deepEqual(malaysian.settle(ron(1, 3, 5), TABLE, null, SETTINGS).deltas, [0, 64, 0, -64]);
});

test('self-draw: every other player pays P', () => {
  assert.deepEqual(malaysian.settle(tsumo(1, 5), TABLE, null, SETTINGS).deltas, [-32, 96, -32, -32]);
});

test('flower/animal bonus adds to fan for points', () => {
  // 5 fan + 2 bonus = 7 → P = 128, discarder pays 256.
  assert.deepEqual(malaysian.settle(ron(0, 2, 5, 2), TABLE, null, SETTINGS).deltas, [256, 0, -256, 0]);
});

test('fan cap limits the doubling', () => {
  // 13 fan capped at 10 → P = 1024, discarder pays 2048.
  assert.deepEqual(malaysian.settle(ron(0, 1, 13), TABLE, null, SETTINGS).deltas[0], 2048);
});

test('minimum fan: bonus counts toward it by default, not when disabled', () => {
  assert.equal(malaysian.parseValue({ fan: 5, bonus: 0 }, SETTINGS).ok, true);
  assert.equal(malaysian.parseValue({ fan: 4, bonus: 0 }, SETTINGS).ok, false);
  assert.equal(malaysian.parseValue({ fan: 4, bonus: 1 }, SETTINGS).ok, true);
  assert.equal(malaysian.parseValue({ fan: 4, bonus: 2 }, { ...SETTINGS, countBonus: false }).ok, false);
});

test('settlements are zero-sum', () => {
  for (const o of [ron(2, 0, 6), tsumo(3, 7, 1), ron(0, 1, 5)]) {
    const d = malaysian.settle(o, TABLE, null, SETTINGS).deltas;
    assert.equal(d.reduce((a, b) => a + b, 0), 0);
  }
});

test('game ends after four rounds', () => {
  let s = createSession(malaysian, PLAYERS, SETTINGS);
  for (let i = 0; i < 16; i++) {
    assert.equal(s.ended, null);
    s = recordHand(malaysian, s, ron((((i + 1) % 4) as Seat), ((i % 4) as Seat), 5));
  }
  assert.ok(s.ended);
});
