import test from 'node:test';
import assert from 'node:assert/strict';

import { createSession, recordHand } from '../engine/engine.ts';
import { defaultSettings, type HandOutcome, type Seat, type TableState } from '../engine/types.ts';
import { riichi, basePoints, type RiichiValue, type RiichiState } from './riichi.ts';

const PLAYERS = ['Ann', 'Bo', 'Cyn', 'Dee'] as const;
const SETTINGS = defaultSettings(riichi.settings);
const TABLE: TableState = { dealerSeat: 0, roundIndex: 0, dealerRepeat: 0, handOfRound: 1, scores: [25000, 25000, 25000, 25000] };
const ST: RiichiState = { honba: 0, riichiPot: 0 };

const ron = (winner: Seat, discarder: Seat, han: number, fu = 30): HandOutcome<RiichiValue> => ({
  kind: 'win',
  wins: [{ winner, winType: 'discard', discarder, value: { han, fu } }],
  inputs: {},
});
const tsumo = (winner: Seat, han: number, fu = 30): HandOutcome<RiichiValue> => ({
  kind: 'win',
  wins: [{ winner, winType: 'selfDraw', value: { han, fu } }],
  inputs: {},
});

test('base points: limits and the standard table', () => {
  assert.equal(basePoints(1, 30, false).base, 240);
  assert.equal(basePoints(2, 25, false).base, 400); // chiitoitsu fu
  assert.equal(basePoints(4, 40, false).base, 2000); // 2560 capped to mangan
  assert.equal(basePoints(5, 0, false).base, 2000);
  assert.equal(basePoints(6, 0, false).base, 3000);
  assert.equal(basePoints(8, 0, false).base, 4000);
  assert.equal(basePoints(11, 0, false).base, 6000);
  assert.equal(basePoints(13, 0, false).base, 8000);
  assert.equal(basePoints(26, 0, false).base, 16000); // double yakuman
  assert.equal(basePoints(4, 30, false).base, 1920);
  assert.equal(basePoints(4, 30, true).base, 2000); // kiriage
  assert.equal(basePoints(3, 60, true).base, 2000); // kiriage
});

test('payments: dealer/non-dealer ron and tsumo with rounding', () => {
  // Non-dealer ron 1 han 30 fu = 1000
  assert.deepEqual(riichi.settle(ron(1, 0, 1), TABLE, ST, SETTINGS).deltas, [-1000, 1000, 0, 0]);
  // Dealer ron 3 han 30 fu = 5800
  assert.deepEqual(riichi.settle(ron(0, 2, 3), TABLE, ST, SETTINGS).deltas, [5800, 0, -5800, 0]);
  // Non-dealer tsumo 3 han 30 fu = 1000/2000
  assert.deepEqual(riichi.settle(tsumo(1, 3), TABLE, ST, SETTINGS).deltas, [-2000, 4000, -1000, -1000]);
  // Dealer tsumo 3 han 30 fu = 2000 all
  assert.deepEqual(riichi.settle(tsumo(0, 3), TABLE, ST, SETTINGS).deltas, [6000, -2000, -2000, -2000]);
  // Non-dealer ron haneman = 12000
  assert.deepEqual(riichi.settle(ron(2, 3, 6), TABLE, ST, SETTINGS).deltas, [0, 0, 12000, -12000]);
});

test('honba: +300 on ron, +100 per payer on tsumo', () => {
  const st = { honba: 2, riichiPot: 0 };
  assert.deepEqual(riichi.settle(ron(1, 0, 1), TABLE, st, SETTINGS).deltas, [-1600, 1600, 0, 0]);
  assert.deepEqual(riichi.settle(tsumo(1, 3), TABLE, st, SETTINGS).deltas, [-2200, 4600, -1200, -1200]);
});

test('riichi sticks: paid at declaration, pot carries over draws, winner collects', () => {
  let s = createSession(riichi, PLAYERS, SETTINGS);
  // Hand 1: seats 1 and 2 declare riichi, exhaustive draw, only dealer tenpai.
  s = recordHand(riichi, s, { kind: 'draw', drawType: 'exhaustive', inputs: { riichi: [1, 2], tenpai: [0] } });
  assert.deepEqual(s.table.scores, [28000, 23000, 23000, 24000]);
  assert.deepEqual(s.state, { honba: 1, riichiPot: 2 });
  assert.equal(s.table.dealerSeat, 0); // dealer tenpai → repeats
  assert.equal(s.table.dealerRepeat, 1);
  // Hand 2: seat 3 declares riichi and tsumos 2/30 (500/1000 + honba 100 each), takes pot (2000 + own 1000).
  s = recordHand(riichi, s, { kind: 'win', wins: [{ winner: 3, winType: 'selfDraw', value: { han: 2, fu: 30 } }], inputs: { riichi: [3] } });
  // payments: dealer 1000+100, others 500+100 each → winner +2300; sticks: -1000 +3000
  assert.deepEqual(s.table.scores, [26900, 22400, 22400, 28300]);
  assert.deepEqual(s.state, { honba: 0, riichiPot: 0 });
  assert.equal(s.table.dealerSeat, 1);
  // Total points conserved (sticks returned from pot).
  assert.equal(s.table.scores.reduce((a, b) => a + b, 0), 100000);
});

test('exhaustive draw noten payments: 1, 2 and 3 tenpai', () => {
  const draw = (tenpai: Seat[]): HandOutcome<RiichiValue> => ({ kind: 'draw', drawType: 'exhaustive', inputs: { tenpai } });
  assert.deepEqual(riichi.settle(draw([0]), TABLE, ST, SETTINGS).deltas, [3000, -1000, -1000, -1000]);
  assert.deepEqual(riichi.settle(draw([0, 1]), TABLE, ST, SETTINGS).deltas, [1500, 1500, -1500, -1500]);
  assert.deepEqual(riichi.settle(draw([0, 1, 2]), TABLE, ST, SETTINGS).deltas, [1000, 1000, 1000, -3000]);
  assert.deepEqual(riichi.settle(draw([]), TABLE, ST, SETTINGS).deltas, [0, 0, 0, 0]);
  assert.deepEqual(riichi.settle(draw([0, 1, 2, 3]), TABLE, ST, SETTINGS).deltas, [0, 0, 0, 0]);
});

test('abortive draw: no payments, honba +1, dealer keeps deal', () => {
  let s = createSession(riichi, PLAYERS, SETTINGS);
  s = recordHand(riichi, s, { kind: 'draw', drawType: 'abortive', inputs: {} });
  assert.deepEqual(s.table.scores, [25000, 25000, 25000, 25000]);
  assert.deepEqual(s.state, { honba: 1, riichiPot: 0 });
  assert.equal(s.table.dealerSeat, 0);
});

test('honba resets on non-dealer win, accumulates over dealer wins', () => {
  let s = createSession(riichi, PLAYERS, SETTINGS);
  s = recordHand(riichi, s, tsumo(0, 1)); // dealer win → honba 1
  s = recordHand(riichi, s, tsumo(0, 1)); // honba 2
  assert.equal((s.state as RiichiState).honba, 2);
  s = recordHand(riichi, s, ron(2, 0, 1)); // non-dealer win → reset
  assert.deepEqual(s.state, { honba: 0, riichiPot: 0 });
});

test('double ron: each winner paid by discarder; pot and honba to nearest from discarder', () => {
  const st = { honba: 1, riichiPot: 1 };
  const outcome: HandOutcome<RiichiValue> = {
    kind: 'win',
    wins: [
      { winner: 3, winType: 'discard', discarder: 1, value: { han: 1, fu: 30 } },
      { winner: 2, winType: 'discard', discarder: 1, value: { han: 2, fu: 30 } },
    ],
    inputs: {},
  };
  // Turn order from discarder 1: seat 2 is nearest → gets honba 300 and pot 1000.
  // Seat 2: ron 2000 + 300 + 1000 = 3300. Seat 3: ron 1000.
  const { deltas } = riichi.settle(outcome, TABLE, st, SETTINGS);
  assert.deepEqual(deltas, [0, -3300, 3300, 1000]);
});

test('tobi ends the game immediately', () => {
  let s = createSession(riichi, PLAYERS, SETTINGS);
  s = recordHand(riichi, s, ron(0, 1, 13)); // dealer yakuman 48000 → seat 1 at -23000
  assert.ok(s.ended);
  assert.match(s.ended!.reason, /tobi/);
});

test('hanchan ends after South 4 unless the dealer repeats; tonpuusen after East 4', () => {
  let s = createSession(riichi, PLAYERS, SETTINGS);
  // 8 dealer-passing hands = E1..S4
  for (let i = 0; i < 7; i++) s = recordHand(riichi, s, ron((((i + 1) % 4) as Seat), ((i % 4) as Seat), 1));
  assert.equal(s.ended, null);
  assert.equal(s.table.roundIndex, 1);
  assert.equal(s.table.handOfRound, 4); // South 4, dealer seat 3
  // Dealer wins S4 → repeats, game continues.
  s = recordHand(riichi, s, ron(3, 0, 1));
  assert.equal(s.ended, null);
  assert.equal(s.table.dealerRepeat, 1);
  // Non-dealer wins → game over.
  s = recordHand(riichi, s, ron(0, 3, 1));
  assert.ok(s.ended);
  assert.match(s.ended!.reason, /South round complete/);

  let t = createSession(riichi, PLAYERS, { ...SETTINGS, gameLength: 'tonpuusen', tobi: false });
  for (let i = 0; i < 4; i++) t = recordHand(riichi, t, ron((((i + 1) % 4) as Seat), ((i % 4) as Seat), 1));
  assert.ok(t.ended);
});

test('atamahane limits winners to one', () => {
  assert.equal(riichi.maxWinners(SETTINGS), 3);
  assert.equal(riichi.maxWinners({ ...SETTINGS, atamahane: true }), 1);
});

test('parseValue: fu rules and limit hands', () => {
  assert.deepEqual(riichi.parseValue({ han: 3, fu: 30 }, SETTINGS), { ok: true, value: { han: 3, fu: 30 } });
  assert.deepEqual(riichi.parseValue({ han: 5, fu: 999 }, SETTINGS), { ok: true, value: { han: 5, fu: 0 } });
  assert.equal(riichi.parseValue({ han: 2, fu: 33 }, SETTINGS).ok, false);
  assert.equal(riichi.parseValue({ han: 0, fu: 30 }, SETTINGS).ok, false);
});

test('finalStandings: uma 10-20 sums to zero; oka shifts target', () => {
  const fs = riichi.finalStandings!([42000, 31000, 18000, 9000], SETTINGS)!;
  assert.deepEqual(fs.values, [37, 16, -17, -36]);
  assert.equal(fs.values.reduce((a, b) => a + b, 0), 0);
  const oka = riichi.finalStandings!([42000, 31000, 18000, 9000], { ...SETTINGS, oka: true })!;
  assert.equal(oka.values.reduce((a, b) => a + b, 0), 0);
  assert.equal(riichi.finalStandings!([1, 2, 3, 4], { ...SETTINGS, uma: 'none' }), null);
});
