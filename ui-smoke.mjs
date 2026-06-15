import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'https://localhost/' });
for (const k of ['window', 'document', 'localStorage', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'HTMLDetailsElement', 'Node']) {
  Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
}
globalThis.confirm = () => true;

const { initApp } = await import('./src/ui/app.ts');
const app = dom.window.document.getElementById('app');
initApp(app);

const fail = (msg) => { console.error('FAIL:', msg); console.error(app.textContent.slice(0, 400)); process.exit(1); };
const btn = (label) => {
  const b = [...app.querySelectorAll('button')].find((x) => x.textContent.trim() === label || x.textContent.trim().startsWith(label));
  if (!b) fail(`button "${label}" not found`);
  return b;
};
const scores = () => [...app.querySelectorAll('.player .score')].map((e) => e.textContent);

// --- setup screen
if (!app.textContent.includes('Mahjong Tracker')) fail('setup screen missing');
if (!app.textContent.includes('Hong Kong')) fail('variant cards missing');
btn('Start session').click();

// --- table screen, empty
if (scores().join(',') !== '0,0,0,0') fail('starting scores wrong: ' + scores());
if (!app.textContent.includes('E1')) fail('round label missing');

// --- record: Player 2 wins 3 fan off Player 1
btn('Win').click();
btn('Player 2').click();          // winner
btn('Player 1').click();          // discarder (in "how" step)
btn('Next').click();              // value: default 3 fan
btn('Confirm').click();
if (scores().join(',') !== '-16,32,-8,-8') fail('post-hand scores wrong: ' + scores());
if (!app.textContent.includes('E2')) fail('rotation did not advance: deal should pass to seat 1');
if (!app.textContent.includes('3 fan')) fail('history missing hand description');

// --- draw (HK: single type, no extras → straight to confirm)
btn('Draw').click();
btn('Confirm').click();
if (scores().join(',') !== '-16,32,-8,-8') fail('draw changed scores');

// --- undo the draw and the hand
btn('↩').click();
btn('↩').click();
if (scores().join(',') !== '0,0,0,0') fail('undo failed: ' + scores());

// --- min-fan validation: enter 0 fan via stepper
btn('Win').click();
btn('Player 3').click();
btn('Self-draw').click();
btn('−').click(); btn('−').click(); btn('−').click();
btn('Next').click();
if (!app.textContent.includes('minimum 3 fan')) fail('min-fan error not shown');
btn('Cancel').click();

// --- menu: end session → summary
btn('⋯').click();
btn('End session & show summary').click();
if (!app.textContent.includes('Session summary')) fail('summary screen missing');
if (!app.textContent.includes('Hands won')) fail('summary stats missing');

// --- persistence: re-init from a fresh app root simulating reload
btn('Back to table').click();
btn('Win').click();
btn('Player 4').click();
btn('Player 2').click();
btn('Next').click();
btn('Confirm').click();
const before = scores().join(',');
const app2 = dom.window.document.createElement('div');
dom.window.document.body.append(app2);
initApp(app2);
const scores2 = [...app2.querySelectorAll('.player .score')].map((e) => e.textContent).join(',');
if (scores2 !== before) fail(`resume mismatch: ${scores2} vs ${before}`);

console.log('UI_SMOKE_OK');
