/** End-of-session summary: standings, stats, export as text or image. */

import type { Session } from '../engine/engine.ts';
import { SEATS, type AnyVariant, type Seat } from '../engine/types.ts';
import { h, toast } from './dom.ts';
import { WIND_TILES } from './app.ts';
import { handsChart, scoreLineChart } from './graph.ts';

interface SummaryProps {
  session: Session<unknown, unknown>;
  variant: AnyVariant;
  /** Re-render the app (used by the graph view toggle). */
  rerender: () => void;
  onBack: (() => void) | null;
  onUndo: () => void;
  onNew: () => void;
}

// Which graph the summary is currently showing. Module-level so it survives the
// app's full re-render between toggle taps.
let graphMode: 'scores' | 'hands' = 'scores';

interface Stats {
  hands: number;
  biggest: { seat: Seat; amount: number; label: string; round: string } | null;
  winCounts: number[];
  longestRun: { seat: Seat; length: number } | null;
}

const fmt = (n: number) => n.toLocaleString('en-US');

function computeStats(s: Session<unknown, unknown>, v: AnyVariant): Stats {
  let hands = 0;
  let biggest: Stats['biggest'] = null;
  const winCounts = [0, 0, 0, 0];
  let longestRun: Stats['longestRun'] = null;

  for (const e of s.ledger) {
    if (e.kind !== 'hand') continue;
    hands++;
    const run = e.tableBefore.dealerRepeat + 1;
    if (!longestRun || run > longestRun.length) longestRun = { seat: e.tableBefore.dealerSeat, length: run };
    if (e.outcome.kind !== 'win') continue;
    for (const w of e.outcome.wins) {
      winCounts[w.winner]++;
      const amount = e.settlement.deltas[w.winner];
      if (!biggest || amount > biggest.amount) {
        const wind = ['E', 'S', 'W', 'N'][e.tableBefore.roundIndex % 4];
        biggest = {
          seat: w.winner,
          amount,
          label: v.describeValue(w.value, s.settings),
          round: `${wind}${e.tableBefore.handOfRound}`,
        };
      }
    }
  }
  return { hands, biggest, winCounts, longestRun };
}

function ranking(s: Session<unknown, unknown>): Seat[] {
  return [...SEATS].sort((a, b) => s.table.scores[b] - s.table.scores[a] || a - b);
}

function summaryText(s: Session<unknown, unknown>, v: AnyVariant): string {
  const stats = computeStats(s, v);
  const standings = v.finalStandings?.(s.table.scores, s.settings) ?? null;
  const order = ranking(s);
  const medals = ['1.', '2.', '3.', '4.'];
  const lines = [
    `\u{1F004} ${v.name} — ${new Date(s.startedAt).toLocaleDateString()}`,
    `${stats.hands} hands${s.ended ? ` · ${s.ended.reason}` : ''}`,
    ...order.map((seat, i) => {
      const extra = standings ? ` (${standings.values[seat] > 0 ? '+' : ''}${Math.round(standings.values[seat] * 10) / 10})` : '';
      return `${medals[i]} ${s.players[seat]} ${fmt(s.table.scores[seat])}${extra}`;
    }),
  ];
  if (stats.biggest) {
    lines.push(`Biggest hand: ${s.players[stats.biggest.seat]} — ${stats.biggest.label}, +${fmt(stats.biggest.amount)} (${stats.biggest.round})`);
  }
  if (stats.longestRun && stats.longestRun.length > 1) {
    lines.push(`Longest dealer run: ${s.players[stats.longestRun.seat]} ×${stats.longestRun.length}`);
  }
  return lines.join('\n');
}

async function shareText(text: string): Promise<void> {
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch { /* cancelled */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Summary copied to clipboard');
  } catch {
    toast('Could not copy — long-press to select instead');
  }
}

function drawImage(s: Session<unknown, unknown>, v: AnyVariant): HTMLCanvasElement {
  const stats = computeStats(s, v);
  const standings = v.finalStandings?.(s.table.scores, s.settings) ?? null;
  const order = ranking(s);
  const W = 720;
  const rows = 4;
  const H = 320 + rows * 64 + (stats.biggest ? 60 : 0) + (stats.longestRun && stats.longestRun.length > 1 ? 50 : 0);
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const x = c.getContext('2d')!;
  x.scale(2, 2);

  x.fillStyle = '#0e1213';
  x.fillRect(0, 0, W, H);
  x.fillStyle = '#161d1f';
  x.strokeStyle = '#2a3539';
  x.beginPath();
  x.roundRect(20, 20, W - 40, H - 40, 18);
  x.fill();
  x.stroke();

  x.fillStyle = '#e9e4d6';
  x.font = '700 30px system-ui, sans-serif';
  x.fillText('\u{1F004} ' + v.name, 48, 84);
  x.fillStyle = '#8d978f';
  x.font = '400 17px system-ui, sans-serif';
  x.fillText(`${new Date(s.startedAt).toLocaleDateString()} · ${stats.hands} hands${s.ended ? ` · ${s.ended.reason}` : ''}`, 48, 116);

  let y = 170;
  order.forEach((seat, i) => {
    x.fillStyle = i === 0 ? '#3cb27e' : '#e9e4d6';
    x.font = '700 24px system-ui, sans-serif';
    x.fillText(`${i + 1}`, 48, y);
    x.fillText(s.players[seat], 90, y);
    const score = fmt(s.table.scores[seat]);
    const extra = standings ? `  (${standings.values[seat] > 0 ? '+' : ''}${Math.round(standings.values[seat] * 10) / 10})` : '';
    x.textAlign = 'right';
    x.fillText(score + extra, W - 60, y);
    x.textAlign = 'left';
    y += 64;
  });

  x.fillStyle = '#8d978f';
  x.font = '400 17px system-ui, sans-serif';
  if (stats.biggest) {
    x.fillText(`Biggest hand: ${s.players[stats.biggest.seat]} — ${stats.biggest.label}, +${fmt(stats.biggest.amount)}`, 48, y + 8);
    y += 50;
  }
  if (stats.longestRun && stats.longestRun.length > 1) {
    x.fillText(`Longest dealer run: ${s.players[stats.longestRun.seat]} ×${stats.longestRun.length}`, 48, y + 8);
  }
  return c;
}

async function shareImage(s: Session<unknown, unknown>, v: AnyVariant): Promise<void> {
  const canvas = drawImage(s, v);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) { toast('Image export failed'); return; }
  const file = new File([blob], 'mahjong-summary.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch { /* cancelled */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mahjong-summary.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export function renderSummary(p: SummaryProps): HTMLElement {
  const { session: s, variant: v } = p;
  const stats = computeStats(s, v);
  const standings = v.finalStandings?.(s.table.scores, s.settings) ?? null;
  const order = ranking(s);

  const chart = graphMode === 'scores' ? scoreLineChart(s) : handsChart(s, v);
  const graphCard = h('div', { class: 'graph-card' },
    h('div', { class: 'graph-tabs' },
      h('button', {
        class: graphMode === 'scores' ? 'on' : '',
        text: 'Score trend',
        onclick: () => { graphMode = 'scores'; p.rerender(); },
      }),
      h('button', {
        class: graphMode === 'hands' ? 'on' : '',
        text: 'Hands & self-draws',
        onclick: () => { graphMode = 'hands'; p.rerender(); },
      }),
    ),
  );
  graphCard.append(chart);

  return h('div', { class: 'summary' },
    h('h1', { text: s.ended ? 'Game over' : 'Session summary' }),
    h('div', { class: 'muted small', text: `${v.name} · ${stats.hands} hands${s.ended ? ` · ${s.ended.reason}` : ''}` }),
    graphCard,
    ...order.map((seat, i) => {
      const windIdx = SEATS.indexOf(seat);
      return h('div', { class: 'rank-row' },
        h('span', { class: 'place', text: `${i + 1}` }),
        h('span', { class: 'windtile', text: WIND_TILES[windIdx] }),
        h('span', { class: 'name', text: s.players[seat] }),
        h('span', {},
          h('span', { class: 'pts', text: fmt(s.table.scores[seat]) }),
          standings
            ? h('span', { class: 'muted small', text: `  ${standings.values[seat] > 0 ? '+' : ''}${Math.round(standings.values[seat] * 10) / 10}` })
            : null,
        ),
      );
    }),
    standings ? h('div', { class: 'muted small', text: standings.label }) : null,
    stats.biggest
      ? h('div', { class: 'stat-card' },
          h('div', { class: 'k', text: 'Biggest hand' }),
          h('div', { class: 'v', text: `${s.players[stats.biggest.seat]} — ${stats.biggest.label}, +${fmt(stats.biggest.amount)} (${stats.biggest.round})` }),
        )
      : null,
    stats.longestRun && stats.longestRun.length > 1
      ? h('div', { class: 'stat-card' },
          h('div', { class: 'k', text: 'Longest dealer run' }),
          h('div', { class: 'v', text: `${s.players[stats.longestRun.seat]} — ${stats.longestRun.length} deals` }),
        )
      : null,
    h('div', { class: 'stat-card' },
      h('div', { class: 'k', text: 'Hands won' }),
      h('div', { class: 'v', text: SEATS.map((i) => `${s.players[i]} ${stats.winCounts[i]}`).join(' · ') }),
    ),
    h('div', { class: 'btn-row' },
      h('button', { text: 'Share text', onclick: () => void shareText(summaryText(s, v)) }),
      h('button', { text: 'Share image', onclick: () => void shareImage(s, v) }),
    ),
    h('div', { class: 'btn-row' },
      p.onBack ? h('button', { text: 'Back to table', onclick: p.onBack }) : h('button', { text: 'Undo last hand', onclick: p.onUndo }),
      h('button', { class: 'btn-primary', text: 'New session', onclick: p.onNew }),
    ),
  );
}
