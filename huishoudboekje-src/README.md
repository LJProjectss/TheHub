# Huishoudboekje

Transacties, categorieën en budget bijhouden - lokaal in de browser (localStorage), als installeerbare PWA.

## Werken aan de app

```
npm install
npm run dev      # ontwikkelserver op http://localhost:5173
npm run build    # productieversie in dist/
npm test         # automatische tests van de rekenlogica (src/lib/*.test.js)
```

Het Excel-pakket (`xlsx`, van SheetJS) staat als `vendor/xlsx-0.20.3.tgz` in deze map, zodat `npm install` niet afhangt van cdn.sheetjs.com. Bijwerken: download een nieuwere tgz van SheetJS naar `vendor/` en pas de bestandsnaam aan in `package.json`.

Draai `npm test` na elke wijziging; alle tests moeten slagen voordat `dist/` online gaat.

Upload de inhoud van `dist/` naar de hosting (bv. Netlify). De service worker zorgt dat een geïnstalleerde app de nieuwe versie automatisch oppakt.

## Structuur

| Pad | Inhoud |
| --- | --- |
| `src/App.jsx` | Schil: zet navigatie, meldingsbalken, pagina en vensters bij elkaar |
| `src/app/` | Onderdelen van de schil: pagina's (`pages.jsx`), navigatie, meldingsbalken, import verwerken (`useImport.js`), thema/meldingen/verlengingen (`useAppState.js`) |
| `src/pages/` | Overzicht (`Dashboard.jsx`), Transacties, Categorieën, Spaardoelen, Vergelijken (`Comparison.jsx`), Abonnementen, Jaaroverzicht (`YearReport.jsx`), Instellingen |
| `src/pages/dashboard/`, `transactions/`, `comparison/` | De blokken van de grotere pagina's; het paginabestand zet ze op volgorde |
| `src/lib/comparison.js` | Vergelijken: snelkeuzes, verschillen per categorie, grafiekreeksen |
| `src/components/` | Gedeelde UI, transactierij en -kaart (mobiel), import- en back-updialoog, regelpanelen |
| `src/lib/useHuishoudboekje.js` | Alle gegevens + opslag in localStorage |
| `src/lib/csv.js` | CSV-herkenning (Rabobank, ING, ABN AMRO, SNS/ASN/RegioBank, Triodos, Knab, bunq, overig), omzetten naar transacties en CSV-export |
| `src/lib/categories.js` | Categorie hernoemen, samenvoegen en verwijderen (op alle plekken tegelijk), groepen |
| `src/lib/reserves.js` | Potjes voor onregelmatige kosten |
| `src/lib/partyGroups.js` | Categoriseren per partij: ongecategoriseerde transacties per tegenpartij met voorstel |
| `src/lib/savingsCheck.js` | Waarschuwing als een spaarrekening-categorie op gewone uitgaven of inkomsten lijkt |
| `src/lib/accounts.js` | Eigen rekeningen, overboekingen tussen eigen rekeningen herkennen |
| `src/lib/sync.js`, `gdrive.js`, `crypto.js` | Synchroniseren via één versleuteld bestand in Google Drive (AES-GCM, sleutel uit wachtwoord via PBKDF2) |
| `src/lib/autobackup.js` | Automatische back-up naar een gekozen map (Chrome/Edge op de computer) |
| `src/lib/patterns.js` | Patroonherkenning, automatische categorisatie, eigen regels, bedrag-afwijkingen |
| `src/lib/duplicates.js` | Dubbele transacties herkennen bij import |
| `src/lib/recurring.js` | Verwachte transacties van herhalende regels |
| `src/lib/backup.js` | Export (JSON/Excel), back-up terugzetten (vervangen/samenvoegen), back-upherinnering |
| `src/lib/overview.js` | Overzicht: perioden, vergelijkingen, terugbetalingen, budgetten, "nog over", opvallende verschuivingen |
| `src/lib/savings.js` | Spaarrekening-saldo, afstemmen met de bank, verdelen over doelen, verwachtingen |
| `src/lib/subscriptions.js` | Abonnementen en vaste lasten herkennen (ritme, prijswijzigingen, gestopt), meldingen na import |
| `src/lib/privacy.js` | Privacymodus (bedragen vervagen) en waas bij het verlaten van de app |

## Synchroniseren (Google Drive)

Nodig: een eigen OAuth-client-ID van Google (type Webapplicatie, scope `drive.file`). De stappen staan in de app onder Instellingen. De client-ID kan daar worden ingevuld, of vast in de build via een bestand `.env` met `VITE_GOOGLE_CLIENT_ID=...`. Zet bij Google zowel het adres van de hosting als eventueel `http://localhost:5173` bij de JavaScript-bronnen en omleidings-URI's.

## Let op

- Datums worden opgeslagen als lokale kalenderdag (`toIsoDate` in `lib/format.js`). Gebruik nooit `toISOString()` voor een datum: dat is UTC en verschuift Nederlandse datums een dag.
- Deze broncode is op 28-09-2026 gereconstrueerd uit de gebouwde versie, omdat de oorspronkelijke broncode niet meer beschikbaar was. Het gedrag is daarbij 1-op-1 vergeleken met de gebouwde versie.
