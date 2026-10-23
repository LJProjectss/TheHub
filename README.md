# Thuis – hub voor je apps

Startpagina voor het huishoudboekje, vermogensoverzicht en onderhoudslogboek, met:

- **tegels** naar de drie apps;
- een **opslagmeter**: hoeveel localStorage elke app gebruikt, met waarschuwing vanaf 70% en 90%;
- **permanente opslag**: de hub vraagt de browser bij de eerste start om je gegevens niet op te ruimen
  (`navigator.storage.persist()`), en toont de status;
- **één back-up**: alle apps in één JSON-bestand, en terugzetten per app met een voorbeeld vooraf;
- **instelbare sleutels per app**, plus een lijst met alle gevonden sleutels die je met één klik koppelt.

De hub en de apps moeten op **hetzelfde adres** draaien (bijv. `mijn-huis.netlify.app`), anders zien ze elkaars
localStorage niet.

```
/                  → hub
/huishoudboekje/   → huishoudboekje
/vermogen/         → vermogensoverzicht
/onderhoud/        → onderhoudslogboek
```

---

## 1. Hub installeren

```bash
npm install
npm run dev      # lokaal bekijken op http://localhost:5173
npm run build    # bouwt naar dist/
```

## 2. De drie apps (al aangepast)

De apps staan naast deze map en zijn ingesteld voor een submap:

| App | Projectmap | Basispad |
|---|---|---|
| Huishoudboekje | `../huishoudboekje-src` | `/huishoudboekje/` |
| Vermogensoverzicht | `../vermogensoverzicht-broncode/vermogensoverzicht` | `/vermogen/` |
| Onderhoudslogboek | `../onderhoudslogboek` | `/onderhoud/` |

Per app is aangepast: `base` in `vite.config.js`, het manifest (`start_url`/`scope`), de service worker
(werkt alleen binnen de eigen map, dus offline gebruik blijft werken) en een link **Thuis** linksboven.
Bij het huishoudboekje komt Google-inloggen nu terug op `/huishoudboekje/`; bij het vermogensoverzicht
zijn ook `sw-template.js` en `public/manifest.webmanifest` aangepast.

De localStorage-sleutels zijn al uniek per app (`huishoudboekje-…`, `vermogensoverzicht.…`,
`onderhoudslogboek-…`) en staan als standaard in `src/config.js`.

## 3. Alles bouwen en samenvoegen

```bash
cd ../huishoudboekje-src && npm run build
cd ../vermogensoverzicht-broncode/vermogensoverzicht && npm run build
cd ../../onderhoudslogboek && npm run build
cd ../thuis-hub && npm run build && npm run combine
```

Dit maakt de map `deploy/` met de hub, de drie apps in hun submap, één `_redirects` en één `_headers`
(de beveiligingsheaders van het vermogensoverzicht gelden alleen voor `/vermogen/`).
Het script waarschuwt als een app nog niet met het juiste basispad is gebouwd.

Sleep `deploy/` naar Netlify (of zip de **inhoud** van de map en upload die zip).

## 4. Overstappen zonder gegevensverlies

Een nieuw adres betekent lege localStorage. Daarom:

1. Exporteer in **elke oude app** je gegevens met de eigen exportfunctie (gedaan).
2. Zet de nieuwe versie online als **nieuwe** Netlify-site en open de hub en elke app één keer.
3. Importeer in **elke app** het export-bestand uit stap 1 (met de eigen importknop van die app).
4. Controleer in de hub of de opslagmeter per app iets laat zien en maak een **back-up**.
5. **Google Drive-synchronisatie**: voeg in Google Cloud Console bij je OAuth-client het nieuwe adres toe:
   - Geautoriseerde JavaScript-bronnen: `https://<nieuwe-site>.netlify.app`
   - Geautoriseerde omleidings-URI's: `https://<nieuwe-site>.netlify.app/huishoudboekje/`
   Log daarna in de app opnieuw in bij Google.
6. Installeer op telefoon/computer de **hub** als app (Thuis) en verwijder de oude losse app-iconen.
7. Haal de oude Netlify-sites pas weg als alles klopt.

## 5. Instellingen

- **Sleutels per app** stel je in de hub zelf in (tabblad Instellingen). Ze worden bewaard in localStorage
  onder `hub_config` en gaan niet mee in de back-up. Wil je ze vast in de code, vul ze dan in `src/config.js` in;
  dat zijn de standaardwaarden.
- **Patronen**: `huishoudboekje-data` = precies die sleutel, `huishoudboekje-*` = alles wat zo begint,
  `!huishoudboekje-gdrive-token` = hoort bij de app maar gaat niet mee in de back-up (inlogtokens, caches).
  Een sleutel hoort bij de eerste app waarvan een patroon past.
- **Kleuren**: in `src/styles.css` bovenaan; overgenomen uit het huishoudboekje (`theme.js`).
- **Limiet en drempels**: `LIMIET_TEKENS`, `DREMPEL_WAARSCHUWING`, `DREMPEL_KRITIEK` en
  `BACKUP_HERINNERING_DAGEN` in `src/config.js`.

## Back-upformaat

```json
{
  "formaat": "thuis-hub-backup",
  "versie": 1,
  "gemaakt": "2026-10-05T10:00:00.000Z",
  "apps": {
    "huishoudboekje": { "naam": "Huishoudboekje", "sleutels": { "huishoudboekje-data": "…" } },
    "vermogen":       { "naam": "Vermogensoverzicht", "sleutels": { … } }
  }
}
```

Waarden worden exact als tekst bewaard, zoals ze in localStorage staan; de hub hoeft het dataformaat van de apps
dus niet te kennen. Bij terugzetten:

- kies je per app wat je terugzet;
- worden standaard eerst de huidige sleutels van die app verwijderd (geen oude restjes);
- wordt standaard eerst een back-up van de huidige situatie gedownload;
- wordt alles teruggedraaid als de opslag vol raakt halverwege.

Sleutels die met `hub_` beginnen zijn van de hub zelf en gaan nooit mee in een back-up.
Wat in IndexedDB staat (de versleutelingssleutel voor Google Drive-synchronisatie en de gekozen
automatische back-upmap van het huishoudboekje) gaat niet mee; die stel je na een herstel opnieuw in.
