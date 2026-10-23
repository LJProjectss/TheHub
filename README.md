# Thuis

De Thuis-hub en de drie apps in één repository, als één Netlify-site:

| Pad | App | Map |
|---|---|---|
| `/` | Thuis-hub | `thuis-hub/` |
| `/huishoudboekje/` | Huishoudboekje | `huishoudboekje-src/` |
| `/vermogen/` | Vermogensoverzicht | `vermogensoverzicht-broncode/vermogensoverzicht/` |
| `/onderhoud/` | Onderhoudslogboek | `onderhoudslogboek/` |

De mappen hebben dezelfde namen als in de werkmap `Eigen-Financiele-Apps`, zodat de relatieve paden
(`thuis-hub/combine.config.json`, de `.env`-terugval van het onderhoudslogboek) ongewijzigd werken.

## Bouwen

```bash
npm run build   # installeert per app (npm ci), bouwt alles en voegt samen in thuis-hub/deploy
npm test        # alle automatische tests
```

## Automatisch online (Netlify)

Netlify leest `netlify.toml`: bouwcommando `npm run build`, publicatiemap `thuis-hub/deploy`, Node 22.
Elke push naar `main` zet de site automatisch online.

Google Drive-synchronisatie (vermogen en onderhoud gebruiken dezelfde sleutels) krijgt zijn sleutels uit
omgevingsvariabelen in Netlify, niet uit de repository:

- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_API_KEY`
- `VITE_GOOGLE_APP_ID`

Lokaal kun je ze in `vermogensoverzicht-broncode/vermogensoverzicht/.env` zetten (staat in `.gitignore`).
Zie `vermogensoverzicht-broncode/vermogensoverzicht/GOOGLE-DRIVE-INSTELLEN.md`.

## Losse repositories

`Huishoudboekje`, `Vermogensoverzicht` en `OnderhoudsLogboek` bestaan nog als losse repositories,
maar deze repository is vanaf nu de bron voor de site.
