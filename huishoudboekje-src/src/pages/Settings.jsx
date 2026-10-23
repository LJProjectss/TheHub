import { useState } from "react";
import { Cloud, FolderOpen, Plus, RefreshCw, Trash2 } from "lucide-react";
import { P } from "../theme";
import { formatDate, newId } from "../lib/format";
import { redirectUri, setClientId } from "../lib/gdrive";
import { TRANSFER_CATEGORY, ensureTransferCategory, formatIban, markTransfers, normalizeIban } from "../lib/accounts";
import { Button, Select } from "../components/ui";

const card = () => ({ borderColor: P.border, backgroundColor: P.surface });
const field = () => ({ borderColor: P.border });
const timeOf = (ms) =>
  ms ? `${formatDate(new Date(ms))} ${new Date(ms).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}` : "";

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border hb-card p-5" style={card()}>
      <h2 className="text-sm font-semibold mb-2" style={{ color: P.heading }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Note({ children, color }) {
  return (
    <p className="text-xs" style={{ color: color || P.muted }}>
      {children}
    </p>
  );
}

// Stappen om eenmalig een Google-"app" te registreren (nodig voor de toegang tot Drive).
function GoogleSetupSteps() {
  return (
    <ol className="list-decimal pl-5 space-y-1 text-xs" style={{ color: P.text }}>
      <li>
        Ga naar{" "}
        <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="underline" style={{ color: P.blue }}>
          console.cloud.google.com
        </a>{" "}
        en maak een nieuw project, bijvoorbeeld "Huishoudboekje".
      </li>
      <li>Zet bij "API's en services" → "Bibliotheek" de <strong>Google Drive API</strong> aan.</li>
      <li>
        Stel bij "OAuth-toestemmingsscherm" een app in (type <strong>Extern</strong>, status <strong>Testen</strong>) en voeg
        je eigen Google-adres toe als testgebruiker.
      </li>
      <li>
        Maak bij "Inloggegevens" een <strong>OAuth-client-ID</strong> van het type <strong>Webapplicatie</strong>. Vul bij
        "Geautoriseerde JavaScript-bronnen" <code>{window.location.origin}</code> in en bij "Geautoriseerde
        omleidings-URI's" <code>{redirectUri()}</code>.
      </li>
      <li>Kopieer de client-ID (eindigt op .apps.googleusercontent.com) en plak die hieronder.</li>
    </ol>
  );
}

function PasswordForm({ mode, onSubmit, onReset, busy }) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [problem, setProblem] = useState("");
  const isNew = mode === "new";
  const submit = () => {
    if (password.length < 8) return setProblem("Kies een wachtwoord van minstens 8 tekens.");
    if (isNew && password !== repeat) return setProblem("De twee wachtwoorden zijn niet gelijk.");
    setProblem("");
    onSubmit(password);
  };
  return (
    <div className="space-y-2 mt-3">
      <Note color={P.text}>
        {isNew
          ? "Kies een wachtwoord voor het versleutelen van je gegevens. Je hebt het nodig op elk apparaat dat je koppelt. Raak je het kwijt, dan is het bestand in Google Drive niet meer te openen (je gegevens op dit apparaat blijven wel staan)."
          : "Er staat al een versleuteld bestand in je Google Drive. Voer het wachtwoord in dat je op je andere apparaat hebt gekozen."}
      </Note>
      <div className="flex flex-wrap gap-2">
        <input
          type="password"
          autoComplete={isNew ? "new-password" : "current-password"}
          placeholder="Wachtwoord"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border text-sm"
          style={field()}
        />
        {isNew && (
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Herhaal wachtwoord"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border text-sm"
            style={field()}
          />
        )}
        <Button variant="primary" onClick={submit} disabled={busy}>
          {busy ? "Even geduld..." : isNew ? "Wachtwoord instellen" : "Ontgrendelen"}
        </Button>
      </div>
      {problem && <Note color={P.expense}>{problem}</Note>}
      {!isNew && (
        <button
          onClick={() => {
            if (password.length < 8) return setProblem("Typ eerst een nieuw wachtwoord van minstens 8 tekens.");
            if (
              window.confirm(
                "Opnieuw beginnen met dit nieuwe wachtwoord? Het bestand in Google Drive wordt overschreven met de gegevens van dit apparaat. Op je andere apparaten moet je daarna het nieuwe wachtwoord invoeren.",
              )
            )
              onReset(password);
          }}
          className="text-xs underline"
          style={{ color: P.muted }}
        >
          Wachtwoord vergeten? Begin opnieuw met het wachtwoord hierboven
        </button>
      )}
    </div>
  );
}

function SyncSection({ sync }) {
  const [hasId, setHasId] = useState(sync.hasClientId);
  const [idDraft, setIdDraft] = useState("");
  const [showSteps, setShowSteps] = useState(!sync.hasClientId);
  const busy = sync.status === "syncing";
  const statusText = {
    off: "Uit",
    idle: sync.lastSync ? `Bijgewerkt op ${timeOf(sync.lastSync)}` : "Aan",
    syncing: "Bezig met synchroniseren...",
    login: "Opnieuw inloggen bij Google nodig (de toegang verloopt na een uur)",
    password: "Wachtwoord nodig",
    conflict: "Wacht op je keuze: op dit apparaat én in de cloud is iets gewijzigd",
    error: "Probleem",
  }[sync.status];

  return (
    <Section title="Synchroniseren via Google Drive">
      <Note>
        Houd je gegevens gelijk op je telefoon en computer. De app bewaart één versleuteld bestand (
        <code>huishoudboekje-sync.json</code>) in je eigen Google Drive. Alleen met je wachtwoord is het te lezen, ook
        Google kan er niet in kijken. De app krijgt alleen toegang tot bestanden die zij zelf heeft gemaakt.
      </Note>

      {!hasId ? (
        <div className="mt-3 space-y-3">
          <Note color={P.text}>
            Eerst eenmalig instellen: de app heeft een eigen sleutel van Google nodig (gratis, ongeveer 10 minuten werk).
          </Note>
          <GoogleSetupSteps />
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Client-ID, bv. 1234-abc.apps.googleusercontent.com"
              value={idDraft}
              onChange={(e) => setIdDraft(e.target.value)}
              className="flex-1 min-w-[240px] px-3 py-2 rounded-lg border text-sm"
              style={field()}
            />
            <Button
              variant="primary"
              disabled={!/\.apps\.googleusercontent\.com$/.test(idDraft.trim())}
              onClick={() => {
                setClientId(idDraft);
                setHasId(true);
              }}
            >
              Opslaan
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Cloud size={16} style={{ color: sync.enabled ? P.blue : P.muted }} />
            <span style={{ color: P.text }}>Status: {statusText}</span>
          </div>
          {sync.error && <Note color={P.expense}>{sync.error}</Note>}

          {sync.status === "password" && sync.passwordMode && (
            <PasswordForm
              mode={sync.passwordMode}
              busy={busy}
              onSubmit={(pw) => sync.setPassword(pw)}
              onReset={(pw) => sync.setPassword(pw, { reset: true })}
            />
          )}

          <div className="flex flex-wrap gap-2">
            {!sync.enabled && (
              <Button variant="primary" icon={Cloud} onClick={sync.connect}>
                Synchroniseren aanzetten
              </Button>
            )}
            {sync.enabled && sync.status === "login" && (
              <Button variant="primary" onClick={sync.login}>
                Inloggen bij Google
              </Button>
            )}
            {sync.enabled && ["idle", "error"].includes(sync.status) && (
              <Button variant="secondary" icon={RefreshCw} onClick={sync.syncNow} disabled={busy}>
                Nu synchroniseren
              </Button>
            )}
            {sync.enabled && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (window.confirm("Synchroniseren uitzetten op dit apparaat? Het bestand in Google Drive blijft staan."))
                    sync.disconnect();
                }}
              >
                Uitzetten
              </Button>
            )}
          </div>
          {!sync.enabled && (
            <Note>
              Je gaat naar Google om in te loggen en komt daarna vanzelf hier terug. Op een iPhone werkt dit ook vanuit de app
              op het beginscherm.
            </Note>
          )}
          <button onClick={() => setShowSteps((v) => !v)} className="text-xs underline" style={{ color: P.muted }}>
            {showSteps ? "Instelstappen verbergen" : "Instelstappen bij Google bekijken"}
          </button>
          {showSteps && <GoogleSetupSteps />}
          {!sync.enabled && (
            <button
              onClick={() => {
                setClientId("");
                setHasId(false);
              }}
              className="block text-xs underline"
              style={{ color: P.muted }}
            >
              Andere client-ID gebruiken
            </button>
          )}
        </div>
      )}
    </Section>
  );
}

function AutoBackupSection({ autoBackup }) {
  if (!autoBackup.supported)
    return (
      <Section title="Automatische back-up naar een map">
        <Note>
          Deze browser kan niet zelf in een map schrijven (dat kan alleen in Chrome en Edge op een computer, niet op een
          iPhone). Gebruik hier "Exporteren (JSON)", of zet synchroniseren via Google Drive aan: Drive bewaart dan ook
          oudere versies van het bestand.
        </Note>
      </Section>
    );
  return (
    <Section title="Automatische back-up naar een map">
      <Note>
        Kies een map op deze computer (bijvoorbeeld in OneDrive of Documenten). Na elke wijziging zet de app binnen een
        halve minuut een back-up van vandaag in die map; de laatste 30 dagen blijven bewaard. Zo'n bestand zet je terug met
        "Importeren".
      </Note>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {autoBackup.status === "off" && (
          <Button variant="primary" icon={FolderOpen} onClick={autoBackup.chooseFolder}>
            Map kiezen
          </Button>
        )}
        {autoBackup.status === "permission" && (
          <>
            <Note color={P.warn}>De browser vraagt opnieuw om toestemming voor de map "{autoBackup.folderName}".</Note>
            <Button variant="primary" onClick={autoBackup.grant}>
              Toestemming geven
            </Button>
          </>
        )}
        {(autoBackup.status === "ok" || autoBackup.status === "error") && (
          <>
            <span className="text-sm" style={{ color: P.text }}>
              Map: <strong>{autoBackup.folderName}</strong>
              {autoBackup.last && (
                <span className="text-xs ml-2" style={{ color: P.muted }}>
                  laatste back-up {timeOf(autoBackup.last.at)}
                </span>
              )}
            </span>
            <Button variant="secondary" onClick={autoBackup.saveNow}>
              Nu opslaan
            </Button>
            <Button variant="ghost" onClick={autoBackup.chooseFolder}>
              Andere map
            </Button>
          </>
        )}
        {autoBackup.status !== "off" && (
          <Button variant="ghost" onClick={autoBackup.turnOff}>
            Uitzetten
          </Button>
        )}
      </div>
      {autoBackup.error && (
        <div className="mt-2">
          <Note color={P.expense}>{autoBackup.error}</Note>
        </div>
      )}
    </Section>
  );
}

const KINDS = { Betaalrekening: "betaal", Spaarrekening: "spaar" };

function AccountsSection({ data, notify }) {
  const { accounts, setAccounts, transactions, setTransactions } = data;
  const [iban, setIban] = useState("");
  const [name, setName] = useState("");
  const [problem, setProblem] = useState("");
  const counts = transactions.reduce((m, t) => (t.account ? m.set(t.account, (m.get(t.account) || 0) + 1) : m), new Map());

  const update = (target, changes) =>
    setAccounts((list) => list.map((a) => (a.iban === target ? { ...a, ...changes } : a)));
  const add = () => {
    const normalized = normalizeIban(iban);
    if (!normalized) return setProblem("Dit lijkt geen geldig rekeningnummer (IBAN).");
    if (accounts.some((a) => a.iban === normalized)) return setProblem("Deze rekening staat er al.");
    setAccounts((list) => [...list, { iban: normalized, name: name.trim() || `…${normalized.slice(-4)}`, kind: "betaal" }]);
    setIban("");
    setName("");
    setProblem("");
  };
  const findTransfers = () => {
    const tag = newId();
    const { list, count } = markTransfers(transactions, accounts, tag);
    if (count === 0) {
      notify?.("Geen nieuwe overboekingen tussen je eigen rekeningen gevonden (alleen transacties zonder categorie tellen).");
      return;
    }
    ensureTransferCategory(data);
    setTransactions(list);
    notify?.(`${count} overboeking(en) tussen eigen rekeningen op "${TRANSFER_CATEGORY}" gezet. Die tellen niet mee als inkomsten of uitgaven.`, tag);
  };

  return (
    <Section title="Rekeningen">
      <Note>
        Rekeningen worden bij het importeren herkend (als het bankbestand het rekeningnummer bevat) en hier toegevoegd. Geef
        ze een herkenbare naam. Geld dat tussen twee eigen betaalrekeningen wordt overgeboekt, telt niet als inkomsten of
        uitgaven: zulke transacties krijgen de categorie "{TRANSFER_CATEGORY}". Markeer je spaarrekening als
        Spaarrekening, dan blijven stortingen gewoon onder Sparen vallen.
      </Note>
      {accounts.length > 0 && (
        <div className="rounded-lg border overflow-hidden mt-3" style={{ borderColor: P.border }}>
          {accounts.map((a, i) => (
            <div
              key={a.iban}
              className="flex flex-wrap items-center gap-2 px-3 py-2.5"
              style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none" }}
            >
              <div className="flex-1 min-w-[180px]">
                <input
                  type="text"
                  defaultValue={a.name}
                  onBlur={(e) => e.target.value.trim() && update(a.iban, { name: e.target.value.trim() })}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className="w-full px-2 py-1.5 rounded-lg border text-sm"
                  style={field()}
                  aria-label={`Naam van rekening ${formatIban(a.iban)}`}
                />
                <div className="text-xs mt-0.5" style={{ color: P.muted }}>
                  {formatIban(a.iban)} · {counts.get(a.iban) || 0} transacties
                </div>
              </div>
              <div className="w-40">
                <Select
                  value={Object.keys(KINDS).find((k) => KINDS[k] === (a.kind || "betaal"))}
                  onChange={(label) => update(a.iban, { kind: KINDS[label] })}
                  options={Object.keys(KINDS)}
                />
              </div>
              <button
                onClick={() => {
                  if (window.confirm(`Rekening ${formatIban(a.iban)} uit de lijst halen? De transacties blijven staan.`))
                    setAccounts((list) => list.filter((x) => x.iban !== a.iban));
                }}
                className="p-1.5 rounded hover:bg-black/5"
                style={{ color: P.muted }}
                aria-label={`Rekening ${a.name} verwijderen`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-3">
        <input
          type="text"
          placeholder="IBAN, bv. NL91 ABNA 0417 1643 00"
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border text-sm"
          style={field()}
        />
        <input
          type="text"
          placeholder="Naam, bv. Gezamenlijk"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="w-48 px-3 py-2 rounded-lg border text-sm"
          style={field()}
        />
        <Button variant="secondary" icon={Plus} onClick={add}>
          Rekening toevoegen
        </Button>
      </div>
      {problem && (
        <div className="mt-2">
          <Note color={P.expense}>{problem}</Note>
        </div>
      )}
      {accounts.length > 1 && (
        <div className="mt-3">
          <Button variant="secondary" icon={RefreshCw} onClick={findTransfers}>
            Overboekingen tussen eigen rekeningen zoeken
          </Button>
        </div>
      )}
    </Section>
  );
}

export default function Settings({ data, notify, sync, autoBackup }) {
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight" style={{ color: P.heading }}>
        Instellingen
      </h1>
      <SyncSection sync={sync} />
      <AutoBackupSection autoBackup={autoBackup} />
      <AccountsSection data={data} notify={notify} />
    </div>
  );
}
