/**
 * UI shell. One module-level app state, full re-render on change.
 * The UI is variant-blind: everything variant-specific is rendered from
 * VariantConfig specs (valueFields, handInputs, drawTypes, settings).
 */

import {
  createSession,
  overrideTable,
  recordHand,
  undo,
  type Session,
} from '../engine/engine.ts';
import {
  SEATS,
  defaultSettings,
  seatWind,
  type AnyVariant,
  type HandInputs,
  type HandOutcome,
  type Seat,
  type Settings,
  type WinDeclaration,
} from '../engine/types.ts';
import { VARIANTS } from '../variants/index.ts';
import {
  DRAGONS,
  SUITS,
  WINDS,
  sortTiles,
  tileGlyph,
  type TileId,
} from '../engine/tiles.ts';
import { h, toast } from './dom.ts';
import { clearSavedSession, loadSavedSession, saveSession, variantById } from './store.ts';
import { renderSummary } from './summary.ts';
import { applyTheme, getTheme, toggleTheme } from './theme.ts';
import { syncScene } from './scene.ts';

// Mahjong tile glyphs, U+1F000 block (East, South, West, North winds).
export const WIND_TILES = ['\u{1F000}', '\u{1F001}', '\u{1F002}', '\u{1F003}'] as const;

// ------------------------------------------------------------------ state

type Screen = 'setup' | 'table' | 'summary';
type TableTab = 'table' | 'history';

interface CurrentWin {
  winner?: Seat;
  winType?: 'selfDraw' | 'discard';
  discarder?: Seat;
  raw: Record<string, number>;
  /** Recorded tiles (optional). `hand` excludes the winning tile. */
  hand: TileId[];
  winningTile?: TileId;
}

type Sheet =
  | {
      kind: 'win';
      step: 'winner' | 'how' | 'value' | 'tiles' | 'extras' | 'confirm';
      wins: WinDeclaration<unknown>[];
      cur: CurrentWin;
      inputs: HandInputs;
      error?: string;
      /** Which target a tile-grid tap fills on the 'tiles' step. */
      tileMode?: 'winning' | 'hand';
    }
  | { kind: 'draw'; step: 'type' | 'extras' | 'confirm'; drawType?: string; inputs: HandInputs }
  | { kind: 'override'; dealerSeat: Seat; roundIndex: number; dealerRepeat: number }
  | { kind: 'menu' };

let root: HTMLElement;
let screen: Screen = 'setup';
let tableTab: TableTab = 'table';
let variant: AnyVariant | null = null;
let session: Session<unknown, unknown> | null = null;
let sheet: Sheet | null = null;

// Last-seen numeric values, so a full re-render can detect which numbers
// changed and roll only those (full re-render recreates every node).
const rollState = new Map<string, number>();
function resetRolls(): void {
  rollState.clear();
}

// Setup-screen scratch state.
const setup = {
  variantId: VARIANTS[0].id,
  names: ['', '', '', ''],
  settings: {} as Record<string, Settings>, // per variant id
};

export function initApp(el: HTMLElement): void {
  root = el;
  applyTheme();
  for (const v of VARIANTS) setup.settings[v.id] = defaultSettings(v.settings);
  const saved = loadSavedSession();
  if (saved) {
    variant = saved.variant;
    session = saved.session;
    screen = saved.session.ended ? 'summary' : 'table';
  }
  resetRolls();
  tableTab = 'table';
  render();
}

function render(): void {
  const view =
    screen === 'setup' ? renderSetup()
    : screen === 'summary' ? renderSummaryScreen()
    : renderTable();
  const layers: (HTMLElement | null)[] = [view];
  if (sheet) {
    layers.push(h('div', { class: 'backdrop', onclick: () => closeSheet() }));
    layers.push(renderSheet());
  }
  root.replaceChildren(...layers.filter((x): x is HTMLElement => x !== null));
  const variantId = screen === 'setup' ? setup.variantId : variant?.id ?? null;
  syncScene(variantId, getTheme());
}

function closeSheet(): void {
  sheet = null;
  render();
}

function commit(next: Session<unknown, unknown>): void {
  session = next;
  saveSession(next);
  sheet = null;
  if (next.ended) screen = 'summary';
  render();
}

// ------------------------------------------------------------------ setup

function renderSetup(): HTMLElement {
  const v = variantById(setup.variantId)!;
  const saved = loadSavedSession();

  const start = () => {
    const players = setup.names.map((n, i) => n.trim() || `Player ${i + 1}`) as unknown as readonly [
      string, string, string, string,
    ];
    variant = variantById(setup.variantId)!;
    session = createSession(variant, players, { ...setup.settings[variant.id] });
    saveSession(session);
    resetRolls();
    tableTab = 'table';
    screen = 'table';
    render();
  };

  return h(
    'div',
    { class: 'setup' },
    h('div', { class: 'setup-topbar' }, themeToggleButton()),
    h('div', { class: 'brand' },
      h('div', { class: 'logo', text: '\u{1F004}' }),
      h('h1', { text: 'Mahjong Tracker' }),
      h('div', { class: 'muted small', text: 'Scores, winds and payouts — works offline.' }),
    ),
    saved &&
      h('button', { class: 'variant-card', onclick: () => {
          variant = saved.variant;
          session = saved.session;
          screen = saved.session.ended ? 'summary' : 'table';
          resetRolls();
          tableTab = 'table';
          render();
        } },
        h('b', { text: 'Resume last session' }),
        h('span', { class: 'muted small', text: `${saved.variant.name} · ${saved.session.players.join(', ')}` }),
      ),
    h('h3', { text: 'Variant' }),
    ...VARIANTS.map((opt) =>
      h('button', {
          class: `variant-card${opt.id === setup.variantId ? ' on' : ''}`,
          onclick: () => { setup.variantId = opt.id; render(); },
        },
        h('b', { text: opt.name }),
        h('span', { class: 'muted small', text: opt.description }),
      ),
    ),
    h('h3', { text: 'Players (East first)' }),
    ...SEATS.map((i) =>
      h('div', { class: 'seat-input' },
        h('span', { class: 'windtile', text: WIND_TILES[i] }),
        h('input', {
          placeholder: `Player ${i + 1}`,
          value: setup.names[i],
          maxLength: 14,
          oninput: (e) => { setup.names[i] = (e.target as HTMLInputElement).value; },
        }),
      ),
    ),
    renderSettingsEditor(v),
    h('button', { class: 'btn-primary btn-big', text: 'Start session', onclick: start }),
  );
}

function renderSettingsEditor(v: AnyVariant): HTMLElement {
  const s = setup.settings[v.id];
  return h('details', { class: 'settings' },
    h('summary', { text: `House rules — ${v.name}` }),
    ...v.settings.map((spec) => {
      let ctl: HTMLElement;
      if (spec.type === 'boolean') {
        ctl = h('button', {
            class: `toggle${s[spec.id] ? ' on' : ''}`,
            onclick: () => { s[spec.id] = !s[spec.id]; render(); },
          },
          h('span', { class: 'knob' }),
        );
      } else if (spec.type === 'choice') {
        ctl = h('div', { class: 'seg' },
          ...spec.options.map((o) =>
            h('button', {
              class: s[spec.id] === o.value ? 'on' : '',
              text: o.label,
              onclick: () => { s[spec.id] = o.value; render(); },
            }),
          ),
        );
      } else {
        ctl = h('div', { class: 'seg' },
          h('button', { text: '−', onclick: () => { s[spec.id] = Math.max(spec.min, (s[spec.id] as number) - 1); render(); } }),
          h('button', { class: 'on', text: String(s[spec.id]) }),
          h('button', { text: '+', onclick: () => { s[spec.id] = Math.min(spec.max, (s[spec.id] as number) + 1); render(); } }),
        );
      }
      return h('div', { class: 'setting-row' }, h('div', { class: 'lab', text: spec.label }), h('div', { class: 'ctl' }, ctl));
    }),
  );
}

// ------------------------------------------------------------------ table

const fmt = (n: number) => n.toLocaleString('en-US');
const fmtDelta = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n));

/**
 * A number that rolls (slide + fade) when its value changes between renders.
 * `key` must be stable across renders for the same logical number.
 */
function rollNum(key: string, value: number, text?: string): HTMLElement {
  const prev = rollState.get(key);
  rollState.set(key, value);
  const dir = prev === undefined || prev === value ? '' : value > prev ? ' roll-up' : ' roll-down';
  return h('span', { class: `num${dir}`, text: text ?? fmt(value) });
}

function lastHandDeltas(): readonly number[] | null {
  if (!session) return null;
  for (let i = session.ledger.length - 1; i >= 0; i--) {
    const e = session.ledger[i];
    if (e.kind === 'hand') return e.settlement.deltas;
  }
  return null;
}

function roundLabel(t: { roundIndex: number; handOfRound: number; dealerRepeat: number }): string {
  const wind = ['E', 'S', 'W', 'N'][t.roundIndex % 4];
  return `${wind}${t.handOfRound}${t.dealerRepeat ? `·${t.dealerRepeat}` : ''}`;
}

function themeToggleButton(): HTMLElement {
  const dark = getTheme() === 'dark';
  return h('button', {
    class: 'btn-ghost theme-toggle',
    text: dark ? '☾' : '☀',
    onclick: () => { toggleTheme(); render(); },
  });
}

// Screen layout of seats: own seat at the bottom, then clockwise on screen.
const DIAMOND_POS = ['bottom', 'right', 'top', 'left'] as const;

function renderDiamond(): HTMLElement {
  const s = session!;
  const t = s.table;
  return h('div', { class: 'diamond' },
    h('div', { class: 'felt' },
      h('div', { class: 'felt-center' },
        h('span', { class: 'rwind', text: WIND_TILES[t.roundIndex % 4] }),
        h('span', { class: 'rlabel', text: roundLabel(t) }),
      ),
    ),
    ...SEATS.map((seat) => {
      const isDealer = seat === t.dealerSeat;
      const wind = seatWind(seat, t.dealerSeat);
      const windIdx = ['E', 'S', 'W', 'N'].indexOf(wind);
      return h('div', { class: `seat-plate ${DIAMOND_POS[seat]}${isDealer ? ' dealer' : ''}` },
        h('span', { class: 'windtile mini', text: WIND_TILES[windIdx] }),
        h('span', { class: 'pname', text: s.players[seat] }),
        isDealer ? h('span', { class: 'dealer-badge', text: '莊' }) : null,
      );
    }),
  );
}

function renderTabs(): HTMLElement {
  const handCount = session!.ledger.filter((e) => e.kind === 'hand').length;
  return h('div', { class: 'tabs' },
    h('button', { class: tableTab === 'table' ? 'on' : '', text: 'Table', onclick: () => { tableTab = 'table'; render(); } }),
    h('button', {
      class: tableTab === 'history' ? 'on' : '',
      text: handCount ? `History · ${handCount}` : 'History',
      onclick: () => { tableTab = 'history'; render(); },
    }),
  );
}

function renderTableTab(): HTMLElement {
  const s = session!;
  const v = variant!;
  const deltas = lastHandDeltas();
  const status = v.statusText?.(s.state, s.table, s.settings) ?? null;
  return h('div', {},
    renderDiamond(),
    h('div', { class: 'scores' },
      ...SEATS.map((seat) => {
        const isDealer = seat === s.table.dealerSeat;
        const wind = seatWind(seat, s.table.dealerSeat);
        const windIdx = ['E', 'S', 'W', 'N'].indexOf(wind);
        const d = deltas ? deltas[seat] : 0;
        return h('div', { class: `player${isDealer ? ' dealer' : ''}` },
          h('div', { class: 'who' },
            h('span', { class: 'windtile', text: WIND_TILES[windIdx] }),
            h('span', { class: 'name', text: s.players[seat] }),
          ),
          h('div', { class: 'score' }, rollNum(`score-${seat}`, s.table.scores[seat])),
          h('div', { class: `delta ${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}` },
            deltas && d !== 0 ? rollNum(`delta-${seat}`, d, fmtDelta(d)) : null,
          ),
        );
      }),
    ),
    h('div', { class: 'statusline', text: status ?? '' }),
  );
}

function renderTable(): HTMLElement {
  const s = session!;
  const v = variant!;

  return h('div', {},
    h('div', { class: 'topbar' },
      h('div', { class: 'round-pill' },
        h('span', { class: 'tile', text: WIND_TILES[s.table.roundIndex % 4] }),
        h('b', { text: roundLabel(s.table) }),
        h('span', { class: 'muted small', text: v.name }),
      ),
      h('div', { class: 'topbar-actions' },
        themeToggleButton(),
        h('button', { class: 'btn-ghost', text: '⋯', onclick: () => { sheet = { kind: 'menu' }; render(); } }),
      ),
    ),
    renderTabs(),
    tableTab === 'history' ? renderHistory() : renderTableTab(),
    tableTab === 'table'
      ? h('div', { class: 'actionbar' },
          h('div', { class: 'inner' },
            h('button', { class: 'undo', text: '↩', disabled: s.ledger.length === 0, onclick: doUndo }),
            h('button', { class: 'draw', text: 'Draw', onclick: openDraw }),
            h('button', { class: 'btn-primary btn-big win', text: 'Win', onclick: openWin }),
          ),
        )
      : null,
  );
}

function doUndo(): void {
  if (!session || session.ledger.length === 0) return;
  session = undo(session);
  saveSession(session);
  screen = 'table';
  toast('Last entry undone');
  render();
}

function renderHistory(): HTMLElement {
  const s = session!;
  const v = variant!;
  const items = [...s.ledger].reverse().map((e) => {
    if (e.kind === 'override') {
      return h('div', { class: 'hist-item' },
        h('span', { class: 'tag', text: roundLabel(e.tableBefore) }),
        h('div', { class: 'body' }, h('span', { class: 'muted', text: e.note })),
      );
    }
    const o = e.outcome;
    let text: string;
    const tileRows: (HTMLElement | null)[] = [];
    if (o.kind === 'win') {
      text = o.wins
        .map((w) => {
          const how = w.winType === 'selfDraw' ? 'self-draw' : `off ${s.players[w.discarder!]}`;
          return `${s.players[w.winner]} — ${v.describeValue(w.value, s.settings)}, ${how}`;
        })
        .join(' & ');
      for (const w of o.wins) tileRows.push(tileRow(w.hand as TileId[] | undefined, w.winningTile));
    } else {
      text = v.drawTypes.find((d) => d.id === o.drawType)?.label ?? 'Draw';
    }
    const deltaText = SEATS.filter((i) => e.settlement.deltas[i] !== 0)
      .map((i) => `${s.players[i]} ${fmtDelta(e.settlement.deltas[i])}`)
      .join(' · ');
    return h('div', { class: 'hist-item' },
      h('span', { class: 'tag', text: roundLabel(e.tableBefore) }),
      h('div', { class: 'body' },
        h('div', { text }),
        ...tileRows,
        deltaText ? h('div', { class: 'deltas', text: deltaText }) : null,
      ),
    );
  });
  return h('div', { class: 'history' },
    items.length ? null : h('div', { class: 'muted small', text: 'No hands yet. Tap Win or Draw to record the first hand.' }),
    ...items,
  );
}

// ------------------------------------------------------------- entry: win

function defaultRaw(): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const f of variant!.valueFields) raw[f.id] = f.default ?? f.min ?? f.choices?.[0] ?? 0;
  return raw;
}

function openWin(): void {
  sheet = { kind: 'win', step: 'winner', wins: [], cur: { raw: defaultRaw(), hand: [] }, inputs: {} };
  render();
}

/** Full recorded hand for a win (concealed tiles + winning tile), or undefined. */
function recordedHand(cur: CurrentWin): { hand?: readonly TileId[]; winningTile?: TileId } {
  const full = cur.winningTile ? sortTiles([...cur.hand, cur.winningTile]) : sortTiles(cur.hand);
  return {
    hand: full.length ? full : undefined,
    winningTile: cur.winningTile,
  };
}

function openDraw(): void {
  const v = variant!;
  const single = v.drawTypes.length === 1 ? v.drawTypes[0].id : undefined;
  sheet = { kind: 'draw', step: single ? 'extras' : 'type', drawType: single, inputs: {} };
  if (single && applicableInputs('draw', single).length === 0) (sheet as { step: string }).step = 'confirm';
  render();
}

function applicableInputs(mode: 'win' | 'draw', drawType?: string) {
  return variant!.handInputs.filter((i) =>
    i.appliesTo === 'always' ? true
    : i.appliesTo === 'win' ? mode === 'win'
    : mode === 'draw' && i.appliesTo.draw === drawType,
  );
}

function buildOutcome(sh: Sheet): HandOutcome<unknown> | null {
  if (sh.kind === 'win') {
    const v = variant!;
    const parsed = v.parseValue(sh.cur.raw, session!.settings);
    if (!parsed.ok) return null;
    const wins = [
      ...sh.wins,
      {
        winner: sh.cur.winner!,
        winType: sh.cur.winType!,
        discarder: sh.cur.discarder,
        value: parsed.value,
        ...recordedHand(sh.cur),
      },
    ];
    return { kind: 'win', wins, inputs: sh.inputs };
  }
  if (sh.kind === 'draw') return { kind: 'draw', drawType: sh.drawType!, inputs: sh.inputs };
  return null;
}

function confirmSheet(): void {
  const o = buildOutcome(sheet!);
  if (!o) return;
  try {
    commit(recordHand(variant!, session!, o));
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err));
  }
}

function seatChips(selected: readonly Seat[], onToggle: (s: Seat) => void, exclude: Seat[] = []): HTMLElement {
  const s = session!;
  return h('div', { class: 'chip-row' },
    ...SEATS.filter((i) => !exclude.includes(i)).map((i) =>
      h('button', {
        class: `chip${selected.includes(i) ? ' on' : ''}`,
        text: s.players[i],
        onclick: () => onToggle(i),
      }),
    ),
  );
}

function sheetHead(title: string, crumbs?: string): HTMLElement {
  return h('div', { class: 'head' },
    h('div', {}, h('h3', { text: title }), crumbs ? h('div', { class: 'crumbs', text: crumbs }) : null),
    h('button', { class: 'btn-ghost', text: 'Cancel', onclick: () => closeSheet() }),
  );
}

function renderSheet(): HTMLElement {
  const sh = sheet!;
  if (sh.kind === 'menu') return renderMenu();
  if (sh.kind === 'override') return renderOverride(sh);
  if (sh.kind === 'draw') return renderDrawSheet(sh);
  return renderWinSheet(sh);
}

function renderWinSheet(sh: Extract<Sheet, { kind: 'win' }>): HTMLElement {
  const s = session!;
  const v = variant!;
  const body: (HTMLElement | null)[] = [];
  const taken = sh.wins.map((w) => w.winner);

  if (sh.step === 'winner') {
    body.push(sheetHead(sh.wins.length ? 'Another winner' : 'Who won?'));
    body.push(h('div', { class: 'btn-grid' },
      ...SEATS.filter((i) => !taken.includes(i) && (sh.wins.length === 0 || i !== sh.wins[0].discarder)).map((i) =>
        h('button', { class: 'btn-big', text: s.players[i], onclick: () => {
            sh.cur.winner = i;
            if (sh.wins.length > 0) {
              // multi-ron: same discard as the first winner
              sh.cur.winType = 'discard';
              sh.cur.discarder = sh.wins[0].discarder;
              sh.step = 'value';
            } else {
              sh.step = 'how';
            }
            render();
          } }),
      ),
    ));
  } else if (sh.step === 'how') {
    body.push(sheetHead('How?', s.players[sh.cur.winner!]));
    body.push(h('button', { class: 'btn-primary btn-big', text: `Self-draw ${'\u{1F004}'}`, onclick: () => {
        sh.cur.winType = 'selfDraw';
        sh.cur.discarder = undefined;
        sh.step = 'value';
        render();
      } }));
    body.push(h('div', { class: 'field-label', text: 'or off a discard by' }));
    body.push(h('div', { class: 'btn-grid' },
      ...SEATS.filter((i) => i !== sh.cur.winner).map((i) =>
        h('button', { text: s.players[i], onclick: () => {
            sh.cur.winType = 'discard';
            sh.cur.discarder = i;
            sh.step = 'value';
            render();
          } }),
      ),
    ));
  } else if (sh.step === 'value') {
    body.push(sheetHead('Hand value', `${s.players[sh.cur.winner!]} · ${sh.cur.winType === 'selfDraw' ? 'self-draw' : `off ${s.players[sh.cur.discarder!]}`}`));
    for (const f of v.valueFields) {
      const relevant = f.relevantWhen ? f.relevantWhen(sh.cur.raw) : true;
      body.push(h('div', { class: `field-label${relevant ? '' : ' dim'}`, text: f.label + (relevant ? '' : ' (not needed)') }));
      const group = h('div', { class: relevant ? '' : 'dim' });
      if (f.quickValues) {
        group.append(h('div', { class: 'chip-row' },
          ...f.quickValues.map((q) =>
            h('button', { class: `chip${sh.cur.raw[f.id] === q ? ' on' : ''}`, text: String(q), onclick: () => { sh.cur.raw[f.id] = q; render(); } }),
          ),
        ));
      }
      if (f.type === 'integer') {
        group.append(h('div', { class: 'stepper' },
          h('button', { text: '−', onclick: () => { sh.cur.raw[f.id] = Math.max(f.min ?? 0, sh.cur.raw[f.id] - 1); render(); } }),
          h('div', { class: 'val', text: String(sh.cur.raw[f.id]) }),
          h('button', { text: '+', onclick: () => { sh.cur.raw[f.id] = Math.min(f.max ?? 99, sh.cur.raw[f.id] + 1); render(); } }),
        ));
      } else if (f.choices) {
        group.append(h('div', { class: 'chip-row' },
          ...f.choices.map((c) =>
            h('button', { class: `chip${sh.cur.raw[f.id] === c ? ' on' : ''}`, text: String(c), onclick: () => { sh.cur.raw[f.id] = c; render(); } }),
          ),
        ));
      }
      body.push(group);
    }
    if (sh.error) body.push(h('div', { class: 'error', text: sh.error }));
    body.push(h('button', { class: 'btn-primary btn-big', text: 'Next', onclick: () => {
        const parsed = v.parseValue(sh.cur.raw, s.settings);
        if (!parsed.ok) { sh.error = parsed.error; render(); return; }
        sh.error = undefined;
        sh.tileMode = sh.cur.winningTile ? 'hand' : 'winning';
        sh.step = 'tiles';
        render();
      } }));
  } else if (sh.step === 'tiles') {
    body.push(...renderTilesStep(sh));
  } else if (sh.step === 'extras') {
    body.push(sheetHead('Details'));
    for (const input of applicableInputs('win')) {
      body.push(h('div', { class: 'field-label', text: input.label }));
      body.push(seatChips(sh.inputs[input.id] ?? [], (seat) => {
        const cur = sh.inputs[input.id] ?? [];
        sh.inputs = { ...sh.inputs, [input.id]: cur.includes(seat) ? cur.filter((x) => x !== seat) : [...cur, seat] };
        render();
      }));
    }
    body.push(h('button', { class: 'btn-primary btn-big', text: 'Next', onclick: () => { sh.step = 'confirm'; render(); } }));
  } else {
    // confirm
    const outcome = buildOutcome(sh)!;
    const settlement = v.settle(outcome, s.table, s.state, s.settings);
    body.push(sheetHead('Confirm'));
    if (outcome.kind === 'win') {
      for (const w of outcome.wins) {
        body.push(h('div', { class: 'notes', text: `${s.players[w.winner]} — ${v.describeValue(w.value, s.settings)}, ${w.winType === 'selfDraw' ? 'self-draw' : `off ${s.players[w.discarder!]}`}` }));
        body.push(tileRow(w.hand, w.winningTile));
      }
    }
    body.push(renderPreview(settlement.deltas, settlement.notes));
    const canAddWinner =
      outcome.kind === 'win' &&
      sh.cur.winType === 'discard' &&
      outcome.wins.length < v.maxWinners(s.settings);
    body.push(h('div', { class: 'btn-row' },
      h('button', { text: 'Back', onclick: () => { sh.step = 'tiles'; render(); } }),
      canAddWinner
        ? h('button', { text: '+ Winner', onclick: () => {
            const parsed = v.parseValue(sh.cur.raw, s.settings);
            if (!parsed.ok) return;
            sh.wins.push({ winner: sh.cur.winner!, winType: 'discard', discarder: sh.cur.discarder, value: parsed.value, ...recordedHand(sh.cur) });
            sh.cur = { raw: defaultRaw(), hand: [] };
            sh.step = 'winner';
            render();
          } })
        : null,
      h('button', { class: 'btn-primary', text: 'Confirm', onclick: confirmSheet }),
    ));
  }
  return h('div', { class: 'sheet' }, ...body.filter((x): x is HTMLElement => x !== null));
}

// ------------------------------------------------------ entry: tile recorder

/** Render a recorded hand as glyphs, winning tile flagged. Null if nothing recorded. */
function tileRow(hand?: readonly TileId[], winningTile?: TileId): HTMLElement | null {
  if (!hand?.length && !winningTile) return null;
  const rest = winningTile && hand ? hand.filter((t, i) => !(t === winningTile && i === hand.indexOf(winningTile))) : (hand ?? []);
  return h('div', { class: 'hand-row wrap recorded' },
    ...rest.map((t) => h('span', { class: 'tileface sm', text: tileGlyph(t) })),
    winningTile ? h('span', { class: 'tileface sm win', text: tileGlyph(winningTile) }) : null,
  );
}

function advanceFromTiles(sh: Extract<Sheet, { kind: 'win' }>): void {
  sh.step = sh.wins.length === 0 && applicableInputs('win').length > 0 ? 'extras' : 'confirm';
  render();
}

function renderTileGrid(onPick: (id: TileId) => void): HTMLElement {
  const rows: HTMLElement[] = [];
  for (const suit of SUITS) {
    rows.push(
      h('div', { class: 'tile-grid-row' },
        ...Array.from({ length: 9 }, (_, i) => `${suit.id}${i + 1}`).map((id) =>
          h('button', { class: 'tilebtn', onclick: () => onPick(id) },
            h('span', { class: 'tileface', text: tileGlyph(id) }),
          ),
        ),
      ),
    );
  }
  rows.push(
    h('div', { class: 'tile-grid-row honors' },
      ...[...WINDS, ...DRAGONS].map((t) =>
        h('button', { class: 'tilebtn', onclick: () => onPick(t.id) },
          h('span', { class: 'tileface', text: tileGlyph(t.id) }),
        ),
      ),
    ),
  );
  return h('div', { class: 'tile-grid' }, ...rows);
}

function renderTilesStep(sh: Extract<Sheet, { kind: 'win' }>): (HTMLElement | null)[] {
  const s = session!;
  const v = variant!;
  const cur = sh.cur;
  const handMax = (v.handTileCount ?? 14) - 1; // winning tile is held separately
  const mode = sh.tileMode ?? 'winning';
  const how = cur.winType === 'selfDraw' ? 'self-draw' : `off ${s.players[cur.discarder!]}`;
  const out: (HTMLElement | null)[] = [];

  out.push(sheetHead('Winning hand', `${s.players[cur.winner!]} · ${how}`));
  out.push(h('div', { class: 'muted small', text:
    cur.winType === 'selfDraw'
      ? 'Tap the tile you drew to win, then add the rest of the hand. Optional — Skip to leave it out.'
      : 'Tap the discard that completed the hand, then add the rest. Optional — Skip to leave it out.',
  }));

  out.push(h('div', { class: 'tile-targets' },
    h('button', {
        class: `tile-slot${mode === 'winning' ? ' active' : ''}`,
        onclick: () => { sh.tileMode = 'winning'; render(); },
      },
      h('span', { class: 'slot-cap', text: cur.winType === 'selfDraw' ? 'Drawn tile' : 'Winning tile' }),
      cur.winningTile
        ? h('span', { class: 'tileface big', text: tileGlyph(cur.winningTile) })
        : h('span', { class: 'tileface big empty', text: '＋' }),
    ),
    h('button', {
        class: `tile-slot grow${mode === 'hand' ? ' active' : ''}`,
        onclick: () => { sh.tileMode = 'hand'; render(); },
      },
      h('span', { class: 'slot-cap', text: `Rest of hand · ${cur.hand.length}/${handMax}` }),
      h('div', { class: 'hand-row' },
        ...(cur.hand.length
          ? sortTiles(cur.hand).map((t) => h('span', { class: 'tileface sm', text: tileGlyph(t) }))
          : [h('span', { class: 'muted small', text: 'optional' })]),
      ),
    ),
  ));

  if (cur.hand.length) {
    out.push(h('div', { class: 'field-label', text: 'Tap a hand tile to remove' }));
    out.push(h('div', { class: 'hand-row wrap' },
      ...sortTiles(cur.hand).map((t) =>
        h('button', { class: 'tilebtn', onclick: () => {
            const i = cur.hand.indexOf(t);
            if (i >= 0) cur.hand.splice(i, 1);
            render();
          } },
          h('span', { class: 'tileface', text: tileGlyph(t) }),
        ),
      ),
    ));
  }

  out.push(renderTileGrid((id) => {
    if ((sh.tileMode ?? 'winning') === 'winning') {
      cur.winningTile = id;
      sh.tileMode = 'hand';
    } else if (cur.hand.length < handMax) {
      cur.hand.push(id);
    } else {
      toast(`Hand holds ${handMax} tiles plus the winning tile.`);
    }
    render();
  }));

  const hasTiles = !!cur.winningTile || cur.hand.length > 0;
  out.push(h('div', { class: 'btn-row' },
    h('button', { text: hasTiles ? 'Clear' : 'Skip', onclick: () => {
        if (hasTiles) { cur.winningTile = undefined; cur.hand = []; sh.tileMode = 'winning'; render(); }
        else advanceFromTiles(sh);
      } }),
    h('button', { class: 'btn-primary', text: 'Next', onclick: () => advanceFromTiles(sh) }),
  ));
  return out;
}

function renderDrawSheet(sh: Extract<Sheet, { kind: 'draw' }>): HTMLElement {
  const s = session!;
  const v = variant!;
  const body: (HTMLElement | null)[] = [];

  if (sh.step === 'type') {
    body.push(sheetHead('Drawn hand'));
    for (const d of v.drawTypes) {
      body.push(h('button', { class: 'btn-big', text: d.label, onclick: () => {
          sh.drawType = d.id;
          sh.step = applicableInputs('draw', d.id).length > 0 ? 'extras' : 'confirm';
          render();
        } }));
      if (d.help) body.push(h('div', { class: 'muted small', text: d.help }));
    }
  } else if (sh.step === 'extras') {
    const label = v.drawTypes.find((d) => d.id === sh.drawType)?.label ?? 'Draw';
    body.push(sheetHead(label));
    for (const input of applicableInputs('draw', sh.drawType)) {
      body.push(h('div', { class: 'field-label', text: input.label }));
      body.push(seatChips(sh.inputs[input.id] ?? [], (seat) => {
        const cur = sh.inputs[input.id] ?? [];
        sh.inputs = { ...sh.inputs, [input.id]: cur.includes(seat) ? cur.filter((x) => x !== seat) : [...cur, seat] };
        render();
      }));
    }
    body.push(h('button', { class: 'btn-primary btn-big', text: 'Next', onclick: () => { sh.step = 'confirm'; render(); } }));
  } else {
    const outcome = buildOutcome(sh)!;
    const settlement = v.settle(outcome, s.table, s.state, s.settings);
    body.push(sheetHead('Confirm draw', v.drawTypes.find((d) => d.id === sh.drawType)?.label));
    body.push(renderPreview(settlement.deltas, settlement.notes));
    body.push(h('div', { class: 'btn-row' },
      h('button', { text: 'Back', onclick: () => { sh.step = v.drawTypes.length === 1 ? 'extras' : 'type'; render(); } }),
      h('button', { class: 'btn-primary', text: 'Confirm', onclick: confirmSheet }),
    ));
  }
  return h('div', { class: 'sheet' }, ...body.filter((x): x is HTMLElement => x !== null));
}

function renderPreview(deltas: readonly number[], notes: readonly string[]): HTMLElement {
  const s = session!;
  return h('div', { class: 'preview' },
    ...SEATS.map((i) =>
      h('div', { class: 'row' },
        h('span', { text: s.players[i] }),
        h('span', { class: `delta ${deltas[i] > 0 ? 'pos' : deltas[i] < 0 ? 'neg' : ''}`, text: deltas[i] === 0 ? '—' : fmtDelta(deltas[i]) }),
      ),
    ),
    ...notes.map((n) => h('div', { class: 'notes', text: n })),
  );
}

// ---------------------------------------------------------- menu/override

function renderMenu(): HTMLElement {
  return h('div', { class: 'sheet' },
    sheetHead('Menu'),
    h('button', { text: 'Adjust dealer / round', onclick: () => {
        const t = session!.table;
        sheet = { kind: 'override', dealerSeat: t.dealerSeat, roundIndex: t.roundIndex, dealerRepeat: t.dealerRepeat };
        render();
      } }),
    h('button', { text: 'End session & show summary', onclick: () => { sheet = null; screen = 'summary'; render(); } }),
    h('button', { class: 'btn-danger', text: 'Abandon session', onclick: () => {
        if (!confirm('Discard this session? This cannot be undone.')) return;
        clearSavedSession();
        session = null;
        variant = null;
        sheet = null;
        screen = 'setup';
        render();
      } }),
  );
}


function renderOverride(sh: Extract<Sheet, { kind: 'override' }>): HTMLElement {
  const s = session!;
  return h('div', { class: 'sheet' },
    sheetHead('Adjust dealer / round'),
    h('div', { class: 'field-label', text: 'Dealer (East)' }),
    h('div', { class: 'chip-row' },
      ...SEATS.map((i) =>
        h('button', { class: `chip${sh.dealerSeat === i ? ' on' : ''}`, text: s.players[i], onclick: () => { sh.dealerSeat = i; render(); } }),
      ),
    ),
    h('div', { class: 'field-label', text: 'Round wind' }),
    h('div', { class: 'seg' },
      ...['East', 'South', 'West', 'North'].map((w, i) =>
        h('button', { class: sh.roundIndex % 4 === i ? 'on' : '', text: w, onclick: () => { sh.roundIndex = Math.floor(sh.roundIndex / 4) * 4 + i; render(); } }),
      ),
    ),
    h('div', { class: 'field-label', text: 'Dealer repeat count' }),
    h('div', { class: 'stepper' },
      h('button', { text: '−', onclick: () => { sh.dealerRepeat = Math.max(0, sh.dealerRepeat - 1); render(); } }),
      h('div', { class: 'val', text: String(sh.dealerRepeat) }),
      h('button', { text: '+', onclick: () => { sh.dealerRepeat += 1; render(); } }),
    ),
    h('button', { class: 'btn-primary btn-big', text: 'Apply', onclick: () => {
        commit(overrideTable(session!, { dealerSeat: sh.dealerSeat, roundIndex: sh.roundIndex, dealerRepeat: sh.dealerRepeat }));
      } }),
  );
}

// ----------------------------------------------------------------- summary

function renderSummaryScreen(): HTMLElement {
  return renderSummary({
    session: session!,
    variant: variant!,
    rerender: () => render(),
    onBack: session!.ended
      ? null
      : () => { screen = 'table'; render(); },
    onUndo: () => doUndo(),
    onNew: () => {
      clearSavedSession();
      session = null;
      variant = null;
      resetRolls();
      screen = 'setup';
      render();
    },
  });
}
