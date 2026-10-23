// Bouwt de hele site in één keer: de drie apps, daarna de hub en "combine".
// Resultaat: thuis-hub/deploy (dat publiceert Netlify).
//
// Gebruik:  npm run build                (alles bouwen, zoals Netlify doet)
//           npm test                     (alleen de automatische tests van alle apps)
//
// Werkt op Windows, macOS en Linux. Per app wordt "npm ci" gedraaid als node_modules ontbreekt
// of als package-lock.json nieuwer is dan de laatste installatie.

import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const alleenTests = process.argv.includes('--alleen-tests');

const apps = [
  { naam: 'huishoudboekje', map: 'huishoudboekje-src' },
  { naam: 'vermogen', map: 'vermogensoverzicht-broncode/vermogensoverzicht' },
  { naam: 'onderhoud', map: 'onderhoudslogboek' },
];
const hub = { naam: 'hub', map: 'thuis-hub' };

const run = (cmd, cwd) => {
  console.log(`\n$ ${cmd}   (${cwd.replace(root, '.')})`);
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
};

function installeer(dir) {
  const nm = join(dir, 'node_modules', '.package-lock.json');
  const lock = join(dir, 'package-lock.json');
  if (!existsSync(nm) || statSync(lock).mtimeMs > statSync(nm).mtimeMs) run('npm ci --no-audit --no-fund', dir);
}

const google = ['VITE_GOOGLE_CLIENT_ID', 'VITE_GOOGLE_API_KEY', 'VITE_GOOGLE_APP_ID'].filter((k) => !process.env[k]);
if (!alleenTests && google.length)
  console.warn(`⚠ Niet ingesteld: ${google.join(', ')}. De site werkt, maar Google Drive-synchronisatie staat uit tot je deze in Netlify invult.`);

for (const app of [...apps, hub]) {
  const dir = resolve(root, app.map);
  console.log(`\n━━ ${app.naam} ━━`);
  installeer(dir);
  if (alleenTests) {
    if (app !== hub) run('npm test', dir);
  } else {
    run('npm run build', dir);
  }
}

if (!alleenTests) {
  run('npm run combine', resolve(root, hub.map));
  console.log('\n✔ Klaar: thuis-hub/deploy');
}
