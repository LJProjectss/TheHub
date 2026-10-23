// Zet de build van de hub en de builds van de apps samen in één map,
// klaar om als geheel naar Netlify te slepen (of te zippen).
//
// Gebruik:  npm run build  (hub)  →  npm run combine
// Paden staan in combine.config.json (relatief aan deze projectmap).
//
// Netlify leest _headers en _redirects alleen in de hoofdmap van de site. Daarom:
//   - _redirects van de apps worden vervangen door één regel per app
//     (/<map>/*  →  /<map>/index.html), zodat herladen binnen een app werkt;
//   - _headers van een app (bijv. de Content-Security-Policy van het vermogensoverzicht)
//     wordt overgenomen in de hoofd-_headers, met alle paden onder /<map>/.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'combine.config.json'), 'utf8'));

const uitvoer = resolve(root, config.uitvoer ?? 'deploy');
const hubDist = resolve(root, config.hub ?? 'dist');

const fout = (m) => {
  console.error(`✖ ${m}`);
  process.exit(1);
};

if (!existsSync(join(hubDist, 'index.html')))
  fout(`Geen hub-build gevonden in ${hubDist}. Draai eerst "npm run build".`);

const ontbrekend = config.apps.filter((a) => !existsSync(join(resolve(root, a.dist), 'index.html')));
if (ontbrekend.length)
  fout(
    'Geen build gevonden voor:\n' +
      ontbrekend.map((a) => `  - ${a.map}: ${resolve(root, a.dist)}`).join('\n') +
      '\nBouw die app eerst (npm run build) of pas het pad aan in combine.config.json.'
  );

rmSync(uitvoer, { recursive: true, force: true });
mkdirSync(uitvoer, { recursive: true });

cpSync(hubDist, uitvoer, { recursive: true });
console.log(`✔ hub            → ${uitvoer}`);

const redirects = [];
const headers = [];
let waarschuwingen = 0;

/** Zet de paden in een _headers-bestand onder /<map>/. Regels die met witruimte beginnen zijn headers. */
function verplaatsHeaders(tekst, map) {
  return tekst
    .split(/\r?\n/)
    .map((regel) => {
      if (!regel.trim() || regel.trimStart().startsWith('#') || /^\s/.test(regel)) return regel;
      const pad = regel.trim();
      return pad.startsWith('/') ? `/${map}${pad}` : regel;
    })
    .join('\n')
    .trim();
}

for (const app of config.apps) {
  const doel = join(uitvoer, app.map);
  cpSync(resolve(root, app.dist), doel, { recursive: true });
  console.log(`✔ ${app.map.padEnd(14)} → ${doel}`);

  // Basis-pad controleren: verwijst index.html naar /<map>/assets/... ?
  const html = readFileSync(join(doel, 'index.html'), 'utf8');
  if (/(src|href)="\/(assets|favicon|icons|manifest)/.test(html)) {
    waarschuwingen++;
    console.warn(
      `⚠ ${app.map}: index.html verwijst naar de hoofdmap in plaats van /${app.map}/.\n` +
        `  Zet in vite.config van die app: base: '/${app.map}/' en bouw opnieuw.`
    );
  }

  // _headers van de app overnemen, anders standaard cacheregels.
  const eigenHeaders = join(doel, '_headers');
  if (existsSync(eigenHeaders)) {
    headers.push(`# ${app.map} (uit de eigen _headers van de app)\n` + verplaatsHeaders(readFileSync(eigenHeaders, 'utf8'), app.map));
    rmSync(eigenHeaders);
  } else {
    headers.push(
      `# ${app.map}\n/${app.map}/sw.js\n  Cache-Control: no-cache\n/${app.map}/manifest.webmanifest\n  Cache-Control: no-cache\n/${app.map}/assets/*\n  Cache-Control: public, max-age=31536000, immutable`
    );
  }
  rmSync(join(doel, '_redirects'), { force: true });

  // Netlify: diepe links binnen de app terugsturen naar de index van die app.
  redirects.push(`/${app.map}/*  /${app.map}/index.html  200`);
}

const bestaandeRedirects = existsSync(join(uitvoer, '_redirects')) ? readFileSync(join(uitvoer, '_redirects'), 'utf8') : '';
writeFileSync(join(uitvoer, '_redirects'), redirects.join('\n') + '\n' + bestaandeRedirects);
console.log('✔ _redirects geschreven');

const bestaandeHeaders = existsSync(join(uitvoer, '_headers')) ? readFileSync(join(uitvoer, '_headers'), 'utf8').trim() : '';
writeFileSync(join(uitvoer, '_headers'), [bestaandeHeaders, ...headers].filter(Boolean).join('\n\n') + '\n');
console.log('✔ _headers geschreven');

console.log(
  `\nKlaar${waarschuwingen ? ` (met ${waarschuwingen} waarschuwing${waarschuwingen > 1 ? 'en' : ''})` : ''}. ` +
    `Sleep de map "${config.uitvoer ?? 'deploy'}" naar Netlify, of zip de inhoud ervan.`
);
