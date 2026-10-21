import { getPublicGames } from '@/lib/games';
import { getSettings } from '@/lib/settings';
import GameBoard from '@/components/public/GameBoard';
import CourtLines from '@/components/public/CourtLines';
import type { PublicGame } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Renders *text* as italics; blank lines become paragraphs. Text only — no HTML is injected. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((para, i) => (
        <p key={i} className="mt-4 first:mt-0">
          {para.split(/(\*[^*]+\*)/g).map((part, j) =>
            part.startsWith('*') && part.endsWith('*') ? <em key={j}>{part.slice(1, -1)}</em> : part,
          )}
        </p>
      ))}
    </>
  );
}

export default async function HomePage() {
  const settings = await getSettings();
  let games: PublicGame[] = [];
  let loadError = false;
  try {
    games = await getPublicGames(settings.publicWindowDays);
  } catch (err) {
    // Shows up in Netlify → Logs → Functions, which makes problems easy to diagnose.
    console.error('Could not load the public schedule:', err instanceof Error ? err.message : err);
    loadError = true;
  }
  const [first, ...rest] = settings.headline.split(/(?<=[.!?])\s+/);

  return (
    <main>
      <section className="arena">
        <CourtLines />
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/roxberry-logo.png" alt="Roxberry Juice Co." width={128} height={128} className="h-24 w-24 rounded-2xl sm:h-32 sm:w-32" />
              <p className="font-cond text-sm font-semibold tracking-[0.14em] text-silver-200 sm:text-base">{settings.seasonLabel}</p>
            </div>
            <a
              href="/admin"
              className="shrink-0 rounded-md border border-silver-500/60 px-3 py-1.5 text-xs font-semibold text-silver-200 transition-colors hover:border-white hover:text-white"
            >
              Sign in
            </a>
          </div>
          <h1 className="headline mt-8 text-white sm:mt-12">
            <span className="rise">{first}</span>
            {rest.length > 0 && <span className="rise rise-2">{rest.join(' ')}</span>}
          </h1>
          <div className="rise rise-3 mt-10 max-w-[38rem] text-lg leading-relaxed text-silver-200 sm:text-xl">
            <RichText text={settings.intro} />
          </div>
          <p className="mt-8 max-w-[38rem] border-l-2 border-silver-500 pl-4 text-sm leading-relaxed text-silver-400">
            {settings.disclaimer}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8" aria-label="Games">
        {loadError ? (
          <p className="panel text-silver-200">The schedule could not be loaded right now. Please refresh the page in a moment.</p>
        ) : (
          <GameBoard
            initialGames={games}
            defaultTab={settings.display.defaultTab}
            windowDays={settings.publicWindowDays}
            showVenue={settings.display.showVenue}
            showTotal={settings.display.showTotalInventory}
          />
        )}
      </section>

      <footer className="border-t border-navy-800">
        <div className="mx-auto max-w-6xl px-5 py-10 text-sm text-silver-400 sm:px-8">
          <h2 className="font-semibold text-silver-200">Privacy</h2>
          <p className="mt-2 max-w-[44rem] leading-relaxed">{settings.privacyNotice}</p>
          <p className="mt-6 text-xs text-silver-500">
            Not affiliated with or endorsed by the Utah Jazz, Utah Mammoth, NBA, or NHL. Team names are used for identification only.
          </p>
        </div>
      </footer>
    </main>
  );
}
