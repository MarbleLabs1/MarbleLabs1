import { chromium } from 'playwright';
const OUT='/tmp/claude-0/-home-user-MarbleLabs1/bae4e0e1-d885-589f-9264-688e1734b7e3/scratchpad';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
const errs=[]; p.on('pageerror', e => errs.push(e.message));
const step = (s) => console.log('  ·', s);

await p.goto('http://localhost:3000/submit', { waitUntil:'networkidle' });

step('submit button starts disabled');
const btn = p.getByRole('button', { name: /Publish anonymously/ });
if (!(await btn.isDisabled())) throw new Error('submit should be disabled on an empty form');

step('fill the job');
await p.getByPlaceholder('Acme Logistics Ltd').fill('Pinewright Media');
await p.getByPlaceholder('Logistics', { exact: true }).fill('Media');
await p.getByPlaceholder('UK', { exact: true }).fill('UK');

step('pick reasons');
await p.getByRole('button', { name: /Burnout, unsustainable workload/ }).click();
await p.getByRole('button', { name: /Micromanagement/ }).click();

step('would-warn checkbox');
await p.locator('input[type=checkbox]:not([required])').first().check();

step('headline + body');
await p.getByPlaceholder(/Promoted on paper/).fill('Three tracking tools and a daily stand-up about the other two');
await p.getByPlaceholder(/I was hired to lead a team of four/).fill(
  'We logged the same work in three separate systems and then discussed the discrepancies in a daily meeting. ' +
  'I raised it twice and was told visibility was a priority for leadership. Nobody could tell me who read any of it. ' +
  'By the end I was spending about six hours a week reporting on four hours of work, and I left for a job with one spreadsheet.'
);

step('add a chat receipt');
await p.getByRole('button', { name: '+ Chat message' }).click();
await p.getByPlaceholder('Friday 6:47 PM').fill('Friday 6:47 PM');
await p.getByPlaceholder('you around? quick call?').fill('you around? quick call?');
await p.waitForTimeout(300);
const flagged = await p.getByText('Outside working hours').first().isVisible();
console.log('    after-hours auto-detected:', flagged);
if (!flagged) throw new Error('6:47 PM should auto-flag as after hours');

step('receipt preview renders as a chat bubble');
if (!(await p.getByText('sent outside working hours').first().isVisible()))
  throw new Error('preview badge missing');
await p.screenshot({ path: `${OUT}/e2e-composer.png` });

step('attest, then submit');
await p.locator('input[type=checkbox][required]').check();
if (await btn.isDisabled()) throw new Error('submit should be enabled now');
await btn.click();
await p.waitForURL(/\/stories\/.+/, { timeout: 15000 });

step('landed on the published story');
if (!(await p.getByText('Published.').isVisible())) throw new Error('no confirmation banner');
if (!(await p.getByText('you around? quick call?').isVisible())) throw new Error('receipt not shown');
console.log('    url:', p.url());
await p.screenshot({ path: `${OUT}/e2e-published.png` });

step('echo button increments');
const echo = p.getByRole('button', { name: 'This happened to me too' });
const before = await echo.textContent();
await echo.click();
await p.waitForTimeout(600);
console.log('    echo:', before?.trim(), '->', (await echo.textContent())?.trim());

step('new company page now scores as unrated (1 story)');
await p.goto('http://localhost:3000/companies/pinewright-media', { waitUntil:'networkidle' });
const idx = await p.locator('dl').first().textContent();
if (!idx?.includes('needs 3+ stories')) throw new Error('single-story company must not be scored: '+idx);
console.log('    threshold respected');

console.log(errs.length ? 'PAGE ERRORS: '+errs.join('; ') : '\nall e2e steps passed, no page errors');
await b.close();
