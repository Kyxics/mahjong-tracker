import test from 'node:test';
import assert from 'node:assert/strict';

import { createSession, recordHand, undo, overrideTable, serializeSession, deserializeSession } from './engine.ts';
import { defaultSettings, seatWind, type HandOutcome, type Seat } from './types.ts';
import { hongKong, type HKValue } from '../variants/hongkong.ts';
import { riichi, type RiichiValue, type RiichiState } from '../variants/riichi.ts';

const PLAYERS = ['Ann', 'Bo', 'Cyn', 'Dee'] as const;

const hkWin = (winner: Seat, fan: number, discarder?: Seat): HandOutcome<HKValue> => ({
  kind: 'win',
  wins: [
    discarder === undefined
      ? { winner, winType: 'selfDraw', value: { fan } }
      : { winner, winType: 'discard', discarder, value: { fan } },
  ],
  inputs: {},
});

test('seat winds follow the dealer', () => {
  assert.equal(seatWind(0, 0), 'E');
  assert.equal(seatWind(1, 0), 'S');
  assert.equal(seatWind(0, 1), 'N');
  assert.equal(seatWind(3, 2), 'S');
});

test('rotation: deal passes on non-dealer win, round advances after seat 3', () => {
  let s = createSession(hongKong, PLAYERS, defaultSettings(hongKong.settings));
  for (const winner of [1, 2, 3] as Seat[]) {
    s = recordHand(hongKong, s, hkWin(winner, 3, 0));
    assert.equal(s.table.dealerSeat, winner); // next dealer is the next seat
  }
  assert.equal(s.table.roundIndex, 0);
  assert.equal(s.table.handOfRound, 4);
  s = recordHand(hongKong, s, hkWin(0, 3, 1)); // dealer is seat 3; seat 0 wins
  assert.equal(s.table.dealerSeat, 0);
  assert.equal(s.table.roundIndex, 1); // South round
  assert.equal(s.table.handOfRound, 1);
});

test('dealer win repeats the deal and bumps dealerRepeat', () => {
  let s = createSession(hongKong, PLAYERS, defaultSettings(hongKong.settings));
  s = recordHand(hongKong, s, hkWin(0, 4, 2));
  assert.equal(s.table.dealerSeat, 0);
  assert.equal(s.table.dealerRepeat, 1);
  assert.equal(s.table.handOfRound, 1);
});

test('undo restores table, state, scores and ledger exactly', () => {
  const settings = defaultSettings(riichi.settings);
  let s = createSession(riichi, PLAYERS, settings);
  const snapshot = JSON.stringify(s.table);
  s = recordHand(riichi, s, {
    kind: 'win',
    wins: [{ winner: 1, winType: 'discard', discarder: 0, value: { han: 3, fu: 30 } }],
    inputs: { riichi: [1] },
  });
  s = recordHand(riichi, s, { kind: 'draw', drawType: 'exhaustive', inputs: { tenpai: [0, 1] } });
  s = undo(s);
  s = undo(s);
  assert.equal(JSON.stringify(s.table), snapshot);
  assert.deepEqual(s.state, { honba: 0, riichiPot: 0 });
  assert.equal(s.ledger.length, 0);
  assert.throws(() => undo(s), /Nothing to undo/);
});

test('manual override changes rotation and is undoable', () => {
  let s = createSession(hongKong, PLAYERS, defaultSettings(hongKong.settings));
  s = overrideTable(s, { dealerSeat: 2, roundIndex: 1 });
  assert.equal(s.table.dealerSeat, 2);
  assert.equal(s.table.roundIndex, 1);
  s = undo(s);
  assert.equal(s.table.dealerSeat, 0);
  assert.equal(s.table.roundIndex, 0);
});

test('validation: discarder required, no duplicate winners, max winners, same discard', () => {
  const s = createSession(riichi, PLAYERS, defaultSettings(riichi.settings));
  const v: RiichiValue = { han: 1, fu: 30 };
  assert.throws(
    () => recordHand(riichi, s, { kind: 'win', wins: [{ winner: 1, winType: 'discard', value: v }], inputs: {} }),
    /discarder/,
  );
  assert.throws(
    () =>
      recordHand(riichi, s, {
        kind: 'win',
        wins: [
          { winner: 1, winType: 'discard', discarder: 0, value: v },
          { winner: 2, winType: 'discard', discarder: 3, value: v },
        ],
        inputs: {},
      }),
    /same discard/,
  );
  const hk = createSession(hongKong, PLAYERS, defaultSettings(hongKong.settings));
  assert.throws(
    () =>
      recordHand(hongKong, hk, {
        kind: 'win',
        wins: [
          { winner: 1, winType: 'discard', discarder: 0, value: { fan: 3 } },
          { winner: 2, winType: 'discard', discarder: 0, value: { fan: 3 } },
        ],
        inputs: {},
      }),
    /at most 1/,
  );
  assert.throws(() => recordHand(hongKong, hk, { kind: 'draw', drawType: 'bogus', inputs: {} }), /Unknown draw type/);
});

test('cannot record after game end; undo reopens it', () => {
  const settings = { ...defaultSettings(hongKong.settings), gameRounds: '1' };
  let s = createSession(hongKong, PLAYERS, settings);
  for (const winner of [1, 2, 3, 0] as Seat[]) s = recordHand(hongKong, s, hkWin(winner, 3, ((winner + 1) % 4) as Seat));
  assert.ok(s.ended);
  assert.match(s.ended!.reason, /East round complete/);
  assert.throws(() => recordHand(hongKong, s, hkWin(0, 3, 1)), /ended/);
  s = undo(s);
  assert.equal(s.ended, null);
});

test('serialization round-trips and play continues after resume', () => {
  const settings = defaultSettings(riichi.settings);
  let s = createSession(riichi, PLAYERS, settings);
  s = recordHand(riichi, s, { kind: 'draw', drawType: 'exhaustive', inputs: { tenpai: [0], riichi: [2] } });
  const restored = deserializeSession<RiichiValue, RiichiState>(serializeSession(s));
  assert.deepEqual(restored.table, s.table);
  assert.deepEqual(restored.state, { honba: 1, riichiPot: 1 });
  const next = recordHand(riichi, restored, {
    kind: 'win',
    wins: [{ winner: 2, winType: 'selfDraw', value: { han: 1, fu: 30 } }],
    inputs: {},
  });
  assert.equal(next.ledger.length, 2);
});
