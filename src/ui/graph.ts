/**
 * Inline-SVG charts for the end-of-session summary. No chart library — keeps the
 * PWA self-contained and offline. Two views:
 *   1. Cumulative score per player across the session (line chart).
 *   2. Winning-hand sizes, with self-draws flagged (bar chart + tally).
 *
 * Colours come from CSS custom properties (--p0..--p3) so both themes work.
 */

import type { Session } from '../engine/engine.ts';
import { SEATS, type AnyVariant, type Seat } from '../engine/types.ts';

const NS = 'http://www.w3.org/2000/svg';

type Attrs = Record<string, string | number>;

function s(tag: string, attrs: Attrs = {}, ...kids: (SVGElement | null)[]): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of kids) if (c) el.append(c);
  return el;
}

function text(x: number, y: number, str: string, cls: string, attrs: Attrs = {}): SVGElement {
  const el = s('text', { x, y, class: cls, ...attrs });
  el.textContent = str;
  return el;
}

const seatColor = (seat: Seat) => `var(--p${seat})`;
const fmt = (n: number) => n.toLocaleString('en-US');

function handEntries(session: Session<unknown, unknown>) {
  return session.ledger.filter((e): e is Extract<typeof e, { kind: 'hand' }> => e.kind === 'hand');
}

function legend(session: Session<unknown, unknown>): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'chart-legend';
  for (const seat of SEATS) {
    const item = document.createElement('span');
    item.className = 'leg';
    const dot = document.createElement('span');
    dot.className = 'leg-dot';
    dot.style.background = seatColor(seat);
    const name = document.createElement('span');
    name.textContent = session.players[seat];
    item.append(dot, name);
    wrap.append(item);
  }
  return wrap;
}

function emptyNote(msg: string): HTMLElement {
  const d = document.createElement('div');
  d.className = 'chart-empty muted small';
  d.textContent = msg;
  return d;
}

// --------------------------------------------------------------- score line

export function scoreLineChart(session: Session<unknown, unknown>): HTMLElement {
  const hands = handEntries(session);
  const wrap = document.createElement('div');
  wrap.className = 'chart';

  const start = hands.length ? hands[0].tableBefore.scores : session.table.scores;
  const points: number[][] = [[...start]];
  let cur = [...start];
  for (const e of hands) {
    cur = cur.map((v, i) => v + e.settlement.deltas[i]);
    points.push([...cur]);
  }

  if (points.length < 2) {
    wrap.append(emptyNote('Play a few hands to see the score trend.'));
    return wrap;
  }

  const W = 320, H = 188;
  const padL = 6, padR = 6, padT = 12, padB = 20;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const all = points.flat();
  let lo = Math.min(...all), hi = Math.max(...all);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12;
  lo -= pad; hi += pad;

  const xAt = (i: number) => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const yAt = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * plotH;

  const svg = s('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'chart-svg',
    role: 'img',
    'aria-label': 'Cumulative scores per player',
  });

  // zero baseline if it's within range
  if (lo < 0 && hi > 0) {
    const y0 = yAt(0);
    svg.append(s('line', { x1: padL, y1: y0, x2: W - padR, y2: y0, class: 'g-zero' }));
    svg.append(text(padL, y0 - 3, '0', 'g-axis'));
  }

  for (const seat of SEATS) {
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(p[seat]).toFixed(1)}`).join(' ');
    svg.append(s('path', { d, class: 'g-line', stroke: seatColor(seat), 'data-seat': seat }));
    // end dot + final value
    const last = points.length - 1;
    svg.append(s('circle', { cx: xAt(last), cy: yAt(points[last][seat]), r: 2.6, fill: seatColor(seat) }));
  }

  // x endpoints
  svg.append(text(padL, H - 6, 'Start', 'g-axis'));
  svg.append(text(W - padR, H - 6, `${hands.length} hand${hands.length === 1 ? '' : 's'}`, 'g-axis', { 'text-anchor': 'end' }));

  wrap.append(svg, legend(session));
  return wrap;
}

// ------------------------------------------------------- winning-hand sizes

export function handsChart(session: Session<unknown, unknown>, _v: AnyVariant): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'chart';

  const wins: { seat: Seat; amount: number; selfDraw: boolean }[] = [];
  const selfDraws = [0, 0, 0, 0];
  const winCounts = [0, 0, 0, 0];
  for (const e of handEntries(session)) {
    if (e.outcome.kind !== 'win') continue;
    for (const w of e.outcome.wins) {
      const amount = e.settlement.deltas[w.winner];
      const selfDraw = w.winType === 'selfDraw';
      wins.push({ seat: w.winner, amount, selfDraw });
      winCounts[w.winner]++;
      if (selfDraw) selfDraws[w.winner]++;
    }
  }

  if (wins.length === 0) {
    wrap.append(emptyNote('No winning hands recorded yet.'));
    return wrap;
  }

  const W = 320, H = 188;
  const padL = 6, padR = 6, padT = 16, padB = 18;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxAmt = Math.max(...wins.map((w) => w.amount), 1);

  const n = wins.length;
  const gap = n > 1 ? Math.min(6, plotW / n / 3) : 0;
  const bw = (plotW - gap * (n - 1)) / n;

  const svg = s('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'chart-svg',
    role: 'img',
    'aria-label': 'Winning hand sizes; diamonds mark self-draws',
  });
  const baseY = padT + plotH;

  wins.forEach((w, i) => {
    const x = padL + i * (bw + gap);
    const bh = Math.max(2, (w.amount / maxAmt) * plotH);
    const y = baseY - bh;
    svg.append(s('rect', {
      x: x.toFixed(1), y: y.toFixed(1), width: bw.toFixed(1), height: bh.toFixed(1),
      rx: Math.min(2, bw / 2), fill: seatColor(w.seat),
      class: w.selfDraw ? 'g-bar self' : 'g-bar',
    }));
    if (w.selfDraw) {
      const cx = x + bw / 2;
      const my = y - 5;
      svg.append(s('path', { d: `M${cx.toFixed(1)},${(my - 3).toFixed(1)} L${(cx + 3).toFixed(1)},${my.toFixed(1)} L${cx.toFixed(1)},${(my + 3).toFixed(1)} L${(cx - 3).toFixed(1)},${my.toFixed(1)} Z`, class: 'g-self' }));
    }
  });

  svg.append(s('line', { x1: padL, y1: baseY, x2: W - padR, y2: baseY, class: 'g-zero' }));
  svg.append(text(padL, padT - 5, `max +${fmt(maxAmt)}`, 'g-axis'));
  svg.append(text(W - padR, H - 5, '◆ self-draw', 'g-axis', { 'text-anchor': 'end' }));

  wrap.append(svg);

  // self-draw / wins tally
  const tally = document.createElement('div');
  tally.className = 'chart-tally';
  for (const seat of SEATS) {
    const row = document.createElement('div');
    row.className = 'tally-row';
    const dot = document.createElement('span');
    dot.className = 'leg-dot';
    dot.style.background = seatColor(seat);
    const name = document.createElement('span');
    name.className = 'tally-name';
    name.textContent = session.players[seat];
    const val = document.createElement('span');
    val.className = 'tally-val muted small';
    val.textContent = `${winCounts[seat]} win${winCounts[seat] === 1 ? '' : 's'} · ${selfDraws[seat]} self-draw`;
    row.append(dot, name, val);
    tally.append(row);
  }
  wrap.append(tally);
  return wrap;
}
