# Google Drive-synchronisatie instellen

Het onderhoudslogboek synchroniseert op dezelfde manier als het vermogensoverzicht: één versleuteld
bestand (`onderhoudslogboek-sync.json`) in je eigen Google Drive, met een wachtwoord dat alleen jij kent.

## Sleutels

Beide apps draaien op dezelfde site (de Thuis-hub), dus de Google-sleutels van het vermogensoverzicht
werken hier ook. Je hoeft niets extra's aan te maken in Google Cloud.

- **Niets doen:** staat er geen `.env` in deze map, dan gebruikt de build automatisch
  `../vermogensoverzicht-broncode/vermogensoverzicht/.env`.
- **Of eigen sleutels:** kopieer `.env.example` naar `.env` en vul de drie waarden in
  (zie `GOOGLE-DRIVE-INSTELLEN.md` in de map van het vermogensoverzicht voor het aanmaken).

Bouw daarna de app (`npm run build`) en zet de hub opnieuw op Netlify zoals je gewend bent.

## Koppelen in de app

**Eerste apparaat:** Instellingen → **Koppel Google Drive…** → log in → kies een map (bijvoorbeeld
dezelfde map als het vermogensoverzicht) → kies een wachtwoord.

**Volgende apparaten:** Instellingen → **Koppel Google Drive…** → kies het bestand
`onderhoudslogboek-sync.json` → hetzelfde wachtwoord. Staan er al gegevens, dan kies je
**Combineren** of **Gegevens uit Google Drive gebruiken**.

## Goed om te weten

- Elk apparaat houdt zijn eigen kopie; de app werkt dus ook offline. Wijzigingen gaan heen en weer
  zodra er internet is (na een wijziging, bij openen en elke 5 minuten).
- Samenvoegen gaat per item, logregel en gepland onderhoud. Alleen als hetzelfde onderdeel op twee
  apparaten anders is gewijzigd, wint de nieuwste versie en kun je daarna alsnog de andere kiezen.
- Taal, valuta en meldtermijnen reizen mee. Of systeemmeldingen aan staan, blijft per apparaat.
- Wachtwoord kwijt? Dan is het bestand niet meer te openen. Ontkoppel, verwijder het bestand in Drive
  en koppel opnieuw met een nieuw wachtwoord (je gegevens staan nog op je apparaten).
