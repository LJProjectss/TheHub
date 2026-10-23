# Onderhoudslogboek

De vormgeving is gelijk aan die van het huishoudboekje: een marineblauwe zijbalk, dunne lijnen en een lichte en donkere modus.

Een lokale webapp voor het onderhoud van je auto's, huizen en apparaten. Alle gegevens blijven in je eigen browser (localStorage). Er is geen server en geen account nodig.

## Starten

Je hebt **Node.js** nodig (versie 18 of hoger).

**Windows:** dubbelklik op `start.bat`.
**macOS / Linux:** `./start.sh`

Of handmatig:

```bash
npm install        # eenmalig
npm start          # bouwt de app en opent hem op http://localhost:4174
```

Voor ontwikkelen met automatisch herladen: `npm run dev` (http://localhost:5174).

## Installeren als app (PWA)

Open de app via `npm start` in Chrome of Edge en klik op het installatie-icoon in de adresbalk ("App installeren"). Daarna staat hij met een eigen icoon in je startmenu of op je bureaublad en werkt hij ook offline.

Let op: de gegevens horen bij het adres (`localhost:4174`). Gebruik dus steeds dezelfde manier van starten. Voor een overstap naar een andere pc of browser gebruik je de back-up (export/import).

## Functies

- **Items**: een lijst van auto's, huizen en apparaten, met filter en zoekfunctie. Elk item heeft een eigen logboek.
  - Auto: kenteken, merk, model, bouwjaar, km-stand
  - Huis: adres, bouwjaar
  - Apparaat: merk, typenummer, aankoopdatum, garantie tot
- **Logboek** per item: datum, naam, omschrijving, kosten, km-stand (bij auto's) en het volgende onderhoud.
- **Volgend onderhoud plannen**: op een vaste datum of met een interval (elke X maanden). Bij auto's kan dat ook op km-stand of per X km. Wat het eerst komt, telt.
- **Uitgevoerd**: vink gepland onderhoud af. Er wordt meteen een logregel gemaakt en het volgende moment wordt ingepland.
- **Planning**: een overzicht van al het toekomstige onderhoud, verdeeld in "Te laat", "Binnenkort" en "Later". Per onderhoud stel je in hoeveel dagen (en km) van tevoren je een melding krijgt. Er is ook een standaardwaarde.
- **Balk "Binnenkort / te laat"** bovenaan. Je kunt hem sluiten; hij komt pas terug als er iets nieuws bij komt.
- **Kostenoverzicht** per item en per jaar, met een totaal en een gemiddelde.
- **Synchroniseren via Google Drive**: hetzelfde logboek op je telefoon en computer, via een versleuteld bestand in je eigen Drive (Instellingen). Zie `GOOGLE-DRIVE-INSTELLEN.md`.
- **Export**: een back-up als JSON (die je ook weer kunt importeren), een Excel-bestand (.xlsx) en een agenda-bestand (.ics).
- **Lichte/donkere modus**: je wisselt via de knop onderin de zijbalk (op mobiel via het maan-icoon bovenaan).
- **Taal en valuta**: Nederlands en euro zijn de standaard; je kunt overschakelen naar Engels en dollar. Datums staan altijd als dd-mm-jjjj.

## Over meldingen

Omdat de app zonder server draait, kan hij je geen melding sturen als hij dicht is. Er zijn twee mogelijkheden:

1. **Systeemmeldingen** (Instellingen → Meldingen): je krijgt een melding als je de app opent, of zolang hij openstaat. Dat gebeurt maximaal één keer per dag per onderhoud.
2. **Agenda-export (.ics)**: importeer het bestand in Outlook, Google Agenda of je iPhone. Je agenda geeft de herinnering dan het ingestelde aantal dagen van tevoren om 09:00 uur, ook als de app dicht is. Exporteer opnieuw als je de planning wijzigt. Bestaande afspraken worden dan bijgewerkt, want ze houden hetzelfde ID.

Onderhoud dat alleen op km-stand is gepland, kan niet in de agenda. Dat zie je wel in de app.
