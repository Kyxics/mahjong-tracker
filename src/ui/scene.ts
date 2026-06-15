/**
 * Per-variant animated lofi background scenes. Each variant gets a day scene
 * (light theme) and a night scene (dark theme), drawn as inline SVG with simple
 * CSS-animated, seamlessly looping motion (steam, drifting petals, a strolling
 * cat, swaying lanterns, a ceiling fan, fireflies …). The scene sits behind the
 * UI and is veiled down so text stays readable.
 *
 * Adding/altering a scene = edit one builder below. Motion classes (sc-steam,
 * sc-petal, …) are styled in style.css.
 */

import type { Theme } from './theme.ts';

// ----------------------------------------------------------- small builders

/** A cream mahjong tile with an optional ink mark. */
function tile(x: number, y: number, mark = '', w = 13, h = 19): string {
  return `<g transform="translate(${x},${y})"><rect width="${w}" height="${h}" rx="2.4" fill="#f3ead2" stroke="#cdbf9c" stroke-width="0.8"/>${mark}</g>`;
}

/** A short row of tiles standing on a surface. */
function tileRow(x: number, y: number): string {
  return (
    tile(x, y, '<circle cx="6.5" cy="9.5" r="3" fill="#cf4b3e"/>') +
    tile(x + 16, y, '<rect x="4" y="5" width="5" height="9" fill="#2f7d52"/>') +
    tile(x + 32, y, '<circle cx="6.5" cy="6" r="1.7" fill="#cf4b3e"/><circle cx="6.5" cy="13" r="1.7" fill="#2f7d52"/>') +
    tile(x + 48, y, '<path d="M3 14 L6.5 5 L10 14" fill="none" stroke="#2f6db0" stroke-width="1.4"/>')
  );
}

/** Rising steam ribbon (loops). `i` staggers multiple ribbons. */
function steam(x: number, y: number, i = 0): string {
  return `<path class="sc-steam" style="animation-delay:${i * 1.1}s" d="M${x} ${y} q-6 -9 0 -18 q6 -9 0 -18"/>`;
}

function cup(x: number, y: number, fill: string): string {
  return `<g transform="translate(${x},${y})">
    <path d="M0 0 h26 l-2.5 15 a10 5 0 0 1 -21 0 Z" fill="#fbf6ec" stroke="#d8cbac" stroke-width="0.8"/>
    <path d="M2.5 2 h21 l-1.2 7 a9.5 3.5 0 0 1 -18.6 0 Z" fill="${fill}"/>
    <path d="M26 3 q9 1 8 7 q-1 5 -8 5" fill="none" stroke="#d8cbac" stroke-width="1.6"/>
  </g>`;
}

const catSilhouette = (fill: string) =>
  `<path class="sc-body" d="M2 18 q0 -10 7 -10 l1 -6 l3 6 l4 0 l3 -6 l1 6 q7 0 7 10 Z" fill="${fill}"/>` +
  `<path d="M27 18 q9 -1 9 -9" fill="none" stroke="${fill}" stroke-width="3" stroke-linecap="round"/>`;

function svg(inner: string): string {
  return `<svg class="scene-svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

const grad = (id: string, from: string, to: string) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`;

// ----------------------------------------------------------------- Hong Kong

function hongKongDay(): string {
  return svg(`
    <defs>${grad('hkd', '#f6e3c4', '#e9c79a')}</defs>
    <rect width="400" height="300" fill="url(#hkd)"/>
    <circle cx="330" cy="60" r="40" fill="#fff3d6" opacity="0.7"/>
    <!-- distant tong lau buildings -->
    <g fill="#d9b483" opacity="0.55">
      <rect x="10" y="120" width="70" height="120"/><rect x="86" y="95" width="58" height="145"/>
      <rect x="300" y="110" width="64" height="130"/><rect x="356" y="135" width="40" height="105"/>
    </g>
    <g fill="#caa06f" opacity="0.5">
      <rect x="150" y="130" width="60" height="110"/><rect x="216" y="150" width="70" height="90"/>
    </g>
    <!-- table ledge -->
    <rect x="0" y="236" width="400" height="64" fill="#9c6f43"/>
    <rect x="0" y="232" width="400" height="6" fill="#b9895a"/>
    ${tileRow(150, 214)}
    ${cup(70, 214, '#c98a55')}
    ${steam(86, 210, 0)}${steam(92, 212, 1)}
    <!-- bamboo steamer -->
    <g transform="translate(280,206)">
      <ellipse cx="22" cy="30" rx="26" ry="7" fill="#c79a5e"/>
      <rect x="-4" y="14" width="52" height="16" rx="3" fill="#d8ad6e"/>
      <rect x="-4" y="2" width="52" height="14" rx="3" fill="#e0b873"/>
      <ellipse cx="22" cy="2" rx="26" ry="6" fill="#eccb8e"/>
    </g>
    ${steam(300, 198, 0.5)}
    <!-- strolling cat -->
    <g class="sc-cat"><g transform="translate(0,212) scale(0.9)">${catSilhouette('#6e4a2c')}</g></g>
  `);
}

function hongKongNight(): string {
  return svg(`
    <defs>${grad('hkn', '#10243a', '#1d2f3f')}</defs>
    <rect width="400" height="300" fill="url(#hkn)"/>
    <circle cx="320" cy="56" r="26" fill="#f3ead0" opacity="0.85"/>
    <circle cx="310" cy="50" r="26" fill="#10243a"/>
    <!-- skyline with lit windows -->
    <g fill="#0c1a2a">
      <rect x="6" y="120" width="60" height="130"/><rect x="72" y="86" width="52" height="164"/>
      <rect x="130" y="140" width="46" height="110"/><rect x="270" y="100" width="56" height="150"/>
      <rect x="332" y="128" width="60" height="122"/>
    </g>
    <g fill="#ffd877">
      <rect class="sc-tw" x="16" y="132" width="7" height="9"/><rect class="sc-tw" style="animation-delay:.7s" x="34" y="150" width="7" height="9"/>
      <rect class="sc-tw" style="animation-delay:1.3s" x="82" y="100" width="7" height="9"/><rect class="sc-tw" style="animation-delay:.4s" x="100" y="130" width="7" height="9"/>
      <rect class="sc-tw" style="animation-delay:1.7s" x="284" y="116" width="7" height="9"/><rect class="sc-tw" style="animation-delay:.9s" x="302" y="150" width="7" height="9"/>
      <rect class="sc-tw" style="animation-delay:2.1s" x="346" y="142" width="7" height="9"/><rect class="sc-tw" style="animation-delay:1.1s" x="364" y="168" width="7" height="9"/>
    </g>
    <!-- vertical neon sign -->
    <g class="sc-glow"><rect x="196" y="96" width="16" height="78" rx="3" fill="#ff5d73"/>
      <rect x="199" y="104" width="10" height="10" fill="#fff0f2"/><rect x="199" y="122" width="10" height="10" fill="#fff0f2"/><rect x="199" y="140" width="10" height="10" fill="#fff0f2"/></g>
    <!-- ledge -->
    <rect x="0" y="240" width="400" height="60" fill="#0a1620"/>
    <rect x="0" y="236" width="400" height="5" fill="#173144"/>
    ${tileRow(150, 218)}
    ${cup(78, 218, '#caa05f')}
    ${steam(94, 214, 0)}${steam(100, 216, 1.2)}
    <g class="sc-cat"><g transform="translate(0,216) scale(0.9)">${catSilhouette('#05101a')}</g></g>
  `);
}

// --------------------------------------------------------------- Riichi (JP)

function riichiDay(): string {
  return svg(`
    <defs>${grad('rjd', '#fbe7ec', '#f6d9c0')}</defs>
    <rect width="400" height="300" fill="url(#rjd)"/>
    <circle cx="60" cy="58" r="34" fill="#fff4ea" opacity="0.7"/>
    <!-- sakura branch -->
    <g stroke="#7a5a48" stroke-width="4" fill="none" stroke-linecap="round">
      <path d="M0 26 q80 6 130 56"/><path d="M70 40 q20 -16 44 -10"/>
    </g>
    <g fill="#f7a8c4">
      ${[[18, 30], [52, 36], [92, 40], [120, 28], [128, 64], [104, 78]].map(([x, y]) => `<g transform="translate(${x},${y})"><circle r="5"/><circle cx="4" cy="-4" r="4"/><circle cx="-4" cy="-4" r="4"/><circle cx="4" cy="4" r="4"/><circle cx="-4" cy="4" r="4"/><circle r="2.2" fill="#fff0f5"/></g>`).join('')}
    </g>
    <!-- drifting petals -->
    ${[0, 1, 2, 3, 4].map((i) => `<g class="sc-petal" style="animation-delay:${i * 1.6}s;--x:${40 + i * 70}px"><ellipse rx="4" ry="2.6" fill="#f7a8c4" opacity="0.9"/></g>`).join('')}
    <!-- tatami ledge -->
    <rect x="0" y="240" width="400" height="60" fill="#cdb079"/>
    <g stroke="#bfa069" stroke-width="2"><line x1="0" y1="252" x2="400" y2="252"/><line x1="0" y1="270" x2="400" y2="270"/><line x1="0" y1="288" x2="400" y2="288"/></g>
    ${tileRow(150, 218)}
    ${cup(96, 218, '#9bbf6e')}
    ${steam(112, 214, 0)}${steam(118, 216, 1)}
  `);
}

function riichiNight(): string {
  // Old Japanese bar alleyway (Omoide Yokocho): a narrow lane of tiny bars,
  // red lanterns, warm windows, steam from a stall, a wet-reflection floor.
  return svg(`
    <defs>${grad('rjn', '#161320', '#241a22')}</defs>
    <rect width="400" height="300" fill="url(#rjn)"/>
    <!-- alley walls converging -->
    <polygon points="0,40 150,150 150,300 0,300" fill="#1e1822"/>
    <polygon points="400,40 250,150 250,300 400,300" fill="#221a20"/>
    <polygon points="150,150 250,150 250,300 150,300" fill="#0f0c14"/>
    <!-- warm shop windows on the walls -->
    <g fill="#ffba6b">
      <rect class="sc-tw" x="40" y="120" width="22" height="16" rx="2"/><rect class="sc-tw" style="animation-delay:.8s" x="78" y="135" width="20" height="15" rx="2"/>
      <rect class="sc-tw" style="animation-delay:1.4s" x="312" y="122" width="22" height="16" rx="2"/><rect class="sc-tw" style="animation-delay:.5s" x="284" y="137" width="20" height="15" rx="2"/>
    </g>
    <!-- noren curtain over the central bar -->
    <rect x="158" y="150" width="84" height="20" fill="#7a2230"/>
    <g fill="#e9d9c0"><rect x="170" y="156" width="3" height="12"/><rect x="198" y="156" width="3" height="12"/><rect x="226" y="156" width="3" height="12"/></g>
    <!-- string of akachochin lanterns -->
    ${[60, 120, 200, 280, 340].map((x, i) => `<g class="sc-sway" style="animation-delay:${i * 0.4}s;transform-origin:${x}px 70px"><line x1="${x}" y1="70" x2="${x}" y2="86" stroke="#3a2a1c" stroke-width="1.5"/><ellipse class="sc-glow" style="animation-delay:${i * 0.5}s" cx="${x}" cy="98" rx="11" ry="14" fill="#e8533f"/><rect x="${x - 11}" y="95" width="22" height="2.5" fill="#7a2a20"/><rect x="${x - 11}" y="100" width="22" height="2.5" fill="#7a2a20"/></g>`).join('')}
    <!-- stall steam -->
    ${steam(200, 150, 0)}${steam(208, 152, 1.1)}${steam(192, 152, 0.6)}
    <!-- wet floor reflections -->
    <rect x="0" y="276" width="400" height="24" fill="#0c0a12"/>
    <g opacity="0.35" fill="#e8533f"><rect x="54" y="278" width="12" height="18"/><rect x="194" y="278" width="12" height="20"/><rect x="334" y="278" width="12" height="18"/></g>
  `);
}

// ----------------------------------------------------------- Taiwanese (16)

function taiwaneseDay(): string {
  return svg(`
    <defs>${grad('twd', '#e8f3e4', '#f3ecd2')}</defs>
    <rect width="400" height="300" fill="url(#twd)"/>
    <circle cx="320" cy="56" r="32" fill="#fff7df" opacity="0.7"/>
    <g fill="#cfe0c0" opacity="0.6"><rect x="0" y="150" width="120" height="90"/><rect x="300" y="140" width="100" height="100"/></g>
    <!-- ledge -->
    <rect x="0" y="240" width="400" height="60" fill="#b98c5a"/>
    <rect x="0" y="236" width="400" height="5" fill="#cda06b"/>
    ${tileRow(150, 218)}
    <!-- bubble tea -->
    <g transform="translate(70,196)">
      <path d="M2 8 h30 l-3 44 a12 5 0 0 1 -24 0 Z" fill="#efe2c8" stroke="#cbb78f" stroke-width="0.8"/>
      <path d="M3 14 h28 l-2.4 32 a11 4 0 0 1 -23.2 0 Z" fill="#c79b6b"/>
      <rect x="2" y="6" width="30" height="5" rx="2.5" fill="#dff" opacity="0.5"/>
      <rect x="19" y="-6" width="4" height="30" rx="2" fill="#d56b86" transform="rotate(12 21 9)"/>
      <g fill="#3a2a1c">${[[8, 44], [14, 47], [20, 45], [25, 48], [11, 49], [22, 50]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2"/>`).join('')}</g>
    </g>
    <!-- teapot + steam -->
    ${cup(300, 222, '#caa05f')}
    ${steam(316, 218, 0)}${steam(322, 220, 1)}
    <!-- scooter passing -->
    <g class="sc-scoot"><g transform="translate(0,224) scale(0.8)">
      <circle cx="6" cy="20" r="7" fill="#2b2b2b"/><circle cx="44" cy="20" r="7" fill="#2b2b2b"/>
      <path d="M6 20 q6 -20 24 -18 l12 0 l2 18" fill="none" stroke="#3f7fb0" stroke-width="4"/>
      <rect x="26" y="-2" width="14" height="8" rx="2" fill="#3f7fb0"/>
    </g></g>
  `);
}

function taiwaneseNight(): string {
  return svg(`
    <defs>${grad('twn', '#1a1430', '#2a1c2e')}</defs>
    <rect width="400" height="300" fill="url(#twn)"/>
    <!-- market stalls -->
    <g fill="#0f0b1e"><rect x="0" y="150" width="150" height="100"/><rect x="250" y="150" width="150" height="100"/></g>
    <!-- glowing stall sign -->
    <g class="sc-glow"><rect x="160" y="120" width="80" height="26" rx="4" fill="#ff6a3d"/><rect x="168" y="127" width="64" height="12" rx="2" fill="#ffd9a8"/></g>
    <!-- strings of red lanterns -->
    <path d="M0 64 q200 40 400 64" fill="none" stroke="#3a2a1c" stroke-width="1.5"/>
    ${[40, 110, 200, 290, 360].map((x, i) => { const y = 70 + Math.sin(i) * 6 + 10; return `<g class="sc-sway" style="animation-delay:${i * 0.5}s;transform-origin:${x}px ${y}px"><line x1="${x}" y1="${y}" x2="${x}" y2="${y + 12}" stroke="#3a2a1c" stroke-width="1.2"/><ellipse class="sc-glow" style="animation-delay:${i * 0.6}s" cx="${x}" cy="${y + 24}" rx="10" ry="13" fill="#e8453f"/></g>`; }).join('')}
    <!-- ledge -->
    <rect x="0" y="244" width="400" height="56" fill="#0c0818"/>
    <rect x="0" y="240" width="400" height="5" fill="#241a2e"/>
    ${tileRow(150, 222)}
    ${cup(78, 222, '#caa05f')}
    ${steam(94, 218, 0)}${steam(100, 220, 1.1)}
  `);
}

// ----------------------------------------------------------------- Malaysian

function malaysianDay(): string {
  return svg(`
    <defs>${grad('myd', '#f6ead0', '#efd9b0')}</defs>
    <rect width="400" height="300" fill="url(#myd)"/>
    <!-- ceiling fan -->
    <g transform="translate(200,40)"><rect x="-2" y="-18" width="4" height="18" fill="#7a6a4f"/>
      <g class="sc-fan"><ellipse rx="3.5" ry="3.5" fill="#5c4d36"/>
        <g fill="#8a7656"><path d="M0 0 L44 -7 L44 7 Z"/><path d="M0 0 L-44 -7 L-44 7 Z" /><path d="M0 0 L-7 44 L7 44 Z"/><path d="M0 0 L-7 -44 L7 -44 Z"/></g>
      </g>
    </g>
    <!-- wall tiles hint -->
    <g stroke="#e0c79c" stroke-width="1.5" opacity="0.5"><line x1="0" y1="150" x2="400" y2="150"/><line x1="100" y1="110" x2="100" y2="190"/><line x1="200" y1="110" x2="200" y2="190"/><line x1="300" y1="110" x2="300" y2="190"/></g>
    <!-- ledge -->
    <rect x="0" y="238" width="400" height="62" fill="#9c7144"/>
    <rect x="0" y="234" width="400" height="5" fill="#b98c5a"/>
    ${tileRow(150, 216)}
    <!-- kopi cup -->
    ${cup(70, 216, '#6b4326')}
    ${steam(86, 212, 0)}${steam(92, 214, 1)}
    <!-- kaya toast plate -->
    <g transform="translate(280,224)"><ellipse cx="26" cy="14" rx="30" ry="8" fill="#efe6d2"/>
      <rect x="10" y="2" width="32" height="14" rx="2" fill="#d8a85e"/><rect x="13" y="5" width="26" height="3" fill="#5b8f3a"/>
    </g>
  `);
}

function malaysianNight(): string {
  return svg(`
    <defs>${grad('myn', '#0c1f24', '#12281f')}</defs>
    <rect width="400" height="300" fill="url(#myn)"/>
    <circle cx="320" cy="54" r="24" fill="#f3ead0" opacity="0.85"/>
    <!-- palm tree -->
    <g stroke="#0a161a" stroke-width="6" fill="none"><path d="M52 240 q6 -90 0 -150"/></g>
    <g fill="#0a161a"><path d="M52 92 q-46 -16 -64 6 q40 -2 64 8"/><path d="M52 92 q46 -16 64 6 q-40 -2 -64 8"/><path d="M52 92 q-30 -40 -56 -38 q26 14 56 40"/><path d="M52 92 q30 -40 56 -38 q-26 14 -56 40"/></g>
    <!-- kampung house on stilts -->
    <g fill="#0c1c18"><rect x="250" y="170" width="110" height="70"/><polygon points="244,170 366,170 305,138"/><rect x="262" y="240" width="8" height="30"/><rect x="340" y="240" width="8" height="30"/></g>
    <rect class="sc-tw" x="276" y="190" width="20" height="18" fill="#ffce6b"/><rect class="sc-tw" style="animation-delay:1s" x="316" y="190" width="20" height="18" fill="#ffce6b"/>
    <!-- fireflies -->
    ${[[120, 150], [160, 190], [200, 160], [180, 120], [230, 200], [140, 210]].map(([x, y], i) => `<circle class="sc-fly" style="animation-delay:${i * 0.9}s;--fx:${x}px;--fy:${y}px" cx="${x}" cy="${y}" r="2.4" fill="#d8f37a"/>`).join('')}
    <!-- ledge -->
    <rect x="0" y="244" width="400" height="56" fill="#08120f"/>
    <rect x="0" y="240" width="400" height="5" fill="#163026"/>
    ${tileRow(150, 222)}
    ${cup(78, 222, '#6b4326')}
    ${steam(94, 218, 0)}${steam(100, 220, 1.1)}
  `);
}

// ------------------------------------------------------------------- neutral

function neutralScene(theme: Theme): string {
  const a = theme === 'dark' ? '#13201b' : '#eef0e6';
  const b = theme === 'dark' ? '#0e1213' : '#e3e6d8';
  return svg(`
    <defs>${grad('neu', a, b)}</defs>
    <rect width="400" height="300" fill="url(#neu)"/>
    ${[[60, 90], [320, 70], [120, 200], [300, 220]].map(([x, y], i) => `<g class="sc-float" style="animation-delay:${i * 1.3}s"><g transform="translate(${x},${y})">${tile(0, 0, '<circle cx="6.5" cy="9.5" r="2.6" fill="#cf4b3e"/>')}</g></g>`).join('')}
  `);
}

// -------------------------------------------------------------------- driver

type Builder = (theme: Theme) => string;

const SCENES: Record<string, { day: Builder; night: Builder }> = {
  'hk-old-style': { day: hongKongDay, night: hongKongNight },
  riichi: { day: riichiDay, night: riichiNight },
  'taiwanese-16': { day: taiwaneseDay, night: taiwaneseNight },
  malaysian: { day: malaysianDay, night: malaysianNight },
};

let mount: HTMLElement | null = null;
let lastKey = '';

/** Update the background scene to match the active variant + theme. Idempotent. */
export function syncScene(variantId: string | null, theme: Theme): void {
  if (!mount) {
    mount = document.createElement('div');
    mount.className = 'scene';
    mount.setAttribute('aria-hidden', 'true');
    document.body.prepend(mount);
  }
  const id = variantId ?? 'none';
  const key = `${id}|${theme}`;
  if (key === lastKey) return;
  lastKey = key;
  document.documentElement.dataset.variant = id;

  const def = SCENES[id];
  const art = def ? (theme === 'dark' ? def.night(theme) : def.day(theme)) : neutralScene(theme);
  mount.innerHTML = `<div class="scene-art">${art}</div><div class="scene-veil"></div>`;
}
