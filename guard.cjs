const { chromium } = require('playwright');
const ROUTES = [
  '/dashboard',
  '/institutions',
  '/users',
  '/students',
  '/guardians',
  '/classes',
  '/status',
  '/audit',
  '/menu',
  '/analytics',
  '/review',
  '/today',
  '/kitchen',
  '/deliveries',
  '/reports',
  '/ops',
  '/absences',
  '/parent',
  '/institutions/abc',
  '/students/abc',
];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  let leaks = 0;
  for (const r of ROUTES) {
    await p.goto('http://localhost:4173' + r, { waitUntil: 'networkidle' });
    const url = new URL(p.url()).pathname;
    const redirected = url === '/login';
    if (!redirected) leaks++;
    console.log(
      r.padEnd(22) +
        '-> ' +
        url.padEnd(14) +
        (redirected ? 'PASS (redirected to login)' : '*** FAIL: reachable unauthenticated ***'),
    );
  }
  console.log(
    leaks === 0
      ? '\nRESULT: all protected routes redirect unauthenticated users'
      : '\nRESULT: ' + leaks + ' route(s) reachable without auth',
  );
  await b.close();
})();
