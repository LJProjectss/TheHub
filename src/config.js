// Standaardinstellingen van de hub.
// De sleutels per app kun je ook aanpassen via het tabblad "Instellingen" in de hub zelf
// (die worden in localStorage onder `hub_config` bewaard). De waarden hieronder gelden
// bij de eerste start en na "Standaard herstellen".
//
// Sleutelpatronen:
//   "huishoudboekje-data"   → precies deze sleutel
//   "huishoudboekje-*"      → alle sleutels die met "huishoudboekje-" beginnen
//   "!huishoudboekje-gdrive-token" → hoort bij de app, maar gaat niet mee in de back-up

export const DEFAULT_APPS = [
  {
    id: 'huishoudboekje',
    naam: 'Huishoudboekje',
    pad: '/huishoudboekje/',
    icoon: '💶',
    kleur: '#2563A8',
    omschrijving: 'Transacties, categorieën en budgetten',
    sleutels: [
      'huishoudboekje-*',
      '!huishoudboekje-gdrive-token', // Google-inlogtoken: kort geldig en geheim
      '!huishoudboekje-gdrive-state', // tijdelijke inlogcontrole
      '!huishoudboekje-chunk-reload' // technische vlag na een update
    ]
  },
  {
    id: 'vermogen',
    naam: 'Vermogensoverzicht',
    pad: '/vermogen/',
    icoon: '📈',
    kleur: '#1B7A4C',
    omschrijving: 'Maandelijkse snapshots van je vermogen',
    sleutels: [
      'vermogensoverzicht.*',
      '!vermogensoverzicht.gtoken', // Google-inlogtoken
      '!vermogensoverzicht.cpi' // CBS-inflatiecijfers, worden opnieuw opgehaald
    ]
  },
  {
    id: 'onderhoud',
    naam: 'Onderhoudslogboek',
    pad: '/onderhoud/',
    icoon: '🔧',
    kleur: '#C99A3E',
    omschrijving: 'Onderhoud aan auto, huis en apparaten',
    sleutels: ['onderhoudslogboek-*']
  }
];

// Sleutels die de hub zelf gebruikt. Deze tellen niet mee bij een app
// en gaan niet mee in de back-up.
export const HUB_PREFIX = 'hub_';

// localStorage-limiet per origin, in tekens (Chrome, Edge, Firefox en Safari ≈ 5 miljoen).
export const LIMIET_TEKENS = 5_000_000;
export const DREMPEL_WAARSCHUWING = 0.7;
export const DREMPEL_KRITIEK = 0.9;

// Na zoveel dagen zonder back-up toont de hub een herinnering.
export const BACKUP_HERINNERING_DAGEN = 30;

export const BACKUP_FORMAAT = 'thuis-hub-backup';
export const BACKUP_VERSIE = 1;
