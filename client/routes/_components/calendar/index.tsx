/**
 * **Solo iframe** Google Calendar (nessun OAuth / `go()` qui).
 *
 * ### Vedere *il tuo* calendario (stessa UI che su calendar.google.com)
 * 1. Vai su [Google Calendar](https://calendar.google.com) con **il tuo** account.
 * 2. Impostazioni del calendario → **Impostazioni e condivisione** → **Integra calendario**.
 * 3. Copia l’URL dentro `src="https://calendar.google.com/calendar/embed?..."` e incollalo qui sotto → **Applica**.
 *
 * In alternativa puoi incollare solo l’**email** del calendario primario (es. `tu@gmail.com`): costruiamo l’URL embed.
 * Il calendario deve essere **visibile** per l’embed (es. “Chiunque abbia il link” per quel calendario), altrimenti l’iframe può restare vuoto — è così che funziona Google.
 *
 * Oppure: `VITE_GOOGLE_CALENDAR_EMBED_SRC` nel `.env` (stesso URL embed).
 */
import { state } from "client";

const KEY_USER = "fw:gcal:embed_user";

const DEFAULT_EMBED_SRC =
  "https://calendar.google.com/calendar/embed?height=600&wkst=2&bgcolor=%23ffffff&ctz=Europe%2FRome&src=it.italian%23holiday%40group.v.calendar.google.com&color=%230D9488";

function embedFromEnv(): string {
  const fromEnv = (import.meta.env.VITE_GOOGLE_CALENDAR_EMBED_SRC as string | undefined)?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_EMBED_SRC;
}

function readUserOverride(): string | null {
  try {
    const v = localStorage.getItem(KEY_USER)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

function buildEmbedFromEmail(email: string): string {
  const ctz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const src = encodeURIComponent(email.trim());
  return `https://calendar.google.com/calendar/embed?wkst=2&bgcolor=%23ffffff&ctz=${ctz}&src=${src}`;
}

function computeIframeSrc(): string {
  const u = readUserOverride();
  if (!u) return embedFromEnv();
  if (u.startsWith("https://calendar.google.com/calendar/embed")) return u;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return buildEmbedFromEmail(u);
  return embedFromEnv();
}

export default function Calendar() {
  const srcSig = state(computeIframeSrc());
  const draft = state(readUserOverride() ?? "");
  const hasSaved = state(!!readUserOverride());

  const apply = () => {
    const v = draft().trim();
    try {
      if (!v) localStorage.removeItem(KEY_USER);
      else localStorage.setItem(KEY_USER, v);
    } catch {
      /* */
    }
    hasSaved(Boolean(readUserOverride()));
    srcSig(computeIframeSrc());
  };

  const clearUser = () => {
    draft("");
    try {
      localStorage.removeItem(KEY_USER);
    } catch {
      /* */
    }
    hasSaved(false);
    srcSig(computeIframeSrc());
  };

  return (
    <div s="des:(w-80% h-85) mob:(w-100% h-74) bg-secondary round-round mt-5 col minh-0 overflow-hidden">
      <div s="shrink-0 row wrap gap-2 children-centery px-2 py-1.5 bg-#1a1a1e bt-#2a2a30 bt-1">
        <input
          type="text"
          key={readUserOverride() ?? "empty"}
          placeholder="URL embed oppure tua email @gmail.com"
          defaultValue={readUserOverride() ?? ""}
          s="text-2 flex-1 minw-0 maxw-40rem p-1.5 round-6px bg-#0d0d10 b-1px b-#2a2a30"
          autocomplete="off"
          input={(v) => draft(v)}
        />
        <div s="text-2 px-3 py-1.5 round-6px bg-primary text-background cursor-pointer shrink-0" click={apply}>
          Applica
        </div>
        <show when={() => hasSaved()}>
          <t s="text-2 opacity-70 cursor-pointer underline shrink-0" click={clearUser}>
            Reimposta
          </t>
        </show>
      </div>
      <iframe
        key={srcSig()}
        title="Google Calendar"
        src={srcSig()}
        s="w-100% h-100% flex-1 minh-0 border-0 round-round"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
