'use client';

import { useEffect, useState } from 'react';
import type { Market } from '@/app/api/markets/route';

const UTM = 'utm_source=github&utm_medium=template&utm_campaign=market-hours-nextjs-tutorial';

// Where each exchange is. Paid plans return the timezone with each answer; keeping the map here
// means the board also works on a free key.
const ZONES: Record<string, { tz: string; city: string; flag: string }> = {
  NYSE: { tz: 'America/New_York', city: 'New York', flag: 'US' },
  NASDAQ: { tz: 'America/New_York', city: 'New York', flag: 'US' },
  TSX: { tz: 'America/Toronto', city: 'Toronto', flag: 'CA' },
  LSE: { tz: 'Europe/London', city: 'London', flag: 'GB' },
  EURONEXT: { tz: 'Europe/Paris', city: 'Paris', flag: 'EU' },
  HKEX: { tz: 'Asia/Hong_Kong', city: 'Hong Kong', flag: 'HK' },
  SSE: { tz: 'Asia/Shanghai', city: 'Shanghai', flag: 'CN' },
  TSE: { tz: 'Asia/Tokyo', city: 'Tokyo', flag: 'JP' },
  ASX: { tz: 'Australia/Sydney', city: 'Sydney', flag: 'AU' }
};
const BOARD_SIZE = Object.keys(ZONES).length; // the route asks for exactly these exchanges

/** How far a time zone is ahead of UTC at a given instant, in ms. */
function offsetMs(tz: string, at: number) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(at)
      .map((x) => [x.type, x.value])
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - at;
}

/** "2026-11-14 09:30:00" in an exchange's own zone, as a real instant. */
function toInstant(local: string, tz: string) {
  const [d, t] = local.split(' ');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi, s] = t.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, da, h, mi, s || 0);
  return guess - offsetMs(tz, guess);
}

const clock = (ms: number, tz?: string) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: tz });
const span = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

export default function MarketsApp() {
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let retry: ReturnType<typeof setTimeout>;
    const load = () =>
      fetch('/api/markets')
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw Object.assign(new Error(body.error), { code: body.code, status: r.status });
          setError(null);
          setMarkets(body);
          // The free plan allows 5 calls a minute, so a few exchanges may still be missing: fetch them in a minute.
          if (body.length < BOARD_SIZE) retry = setTimeout(load, 65_000);
        })
        .catch((e) => {
          setError({ message: e.message, code: e.code });
          if (e.status === 429) retry = setTimeout(load, 65_000);
        });
    load();
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(id);
      clearTimeout(retry);
    };
  }, []);

  if (error?.code === 'missing_key') return <MissingKey />;

  // The day strip runs from local midnight to midnight, in the viewer's own time zone.
  const dayStart = new Date(now).setHours(0, 0, 0, 0);
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - dayStart) / 864e5) * 100));

  const rows = (markets || []).map((m) => {
    const z = ZONES[m.exchange] || { tz: 'UTC', city: '', flag: '··' };
    const open = toInstant(m.openingTime, z.tz);
    const close = toInstant(m.closingTime, z.tz);
    const closedToday = m.status === 'weekend' || m.status === 'holiday';
    const isOpen = !closedToday && now >= open && now < close;
    return { m, z, open, close, closedToday, isOpen };
  });
  const openCount = rows.filter((r) => r.isOpen).length;
  const waiting = markets ? BOARD_SIZE - markets.length : 0;

  return (
    <main className="app">
      <header>
        <p className="eyebrow">World stock exchanges</p>
        <h1>
          {markets ? (openCount ? `${openCount} of ${rows.length} markets are open` : 'All markets are closed') : 'Checking the markets…'}
        </h1>
        <p className="sub">Times in your zone · it’s {clock(now)} now</p>
      </header>

      {error && <p className="error">{error.message}</p>}
      {waiting > 0 && (
        <p className="waiting">
          {waiting} more {waiting === 1 ? 'exchange loads' : 'exchanges load'} in a minute: the free plan allows 5 API calls a minute.{' '}
          <a href={`https://apiverve.com/pricing?${UTM}`}>See pricing</a>
        </p>
      )}

      <section className="board">
        {rows.map(({ m, z, open, close, closedToday, isOpen }) => {
          const note = closedToday
            ? m.holidayName || (m.status === 'weekend' ? 'Closed for the weekend' : 'Closed today')
            : isOpen
              ? `Closes in ${span(close - now)}`
              : now < open
                ? `Opens in ${span(open - now)}`
                : 'Closed for the day';
          return (
            <article key={m.exchange} className={`row ${isOpen ? 'open' : ''}`}>
              <div className="who">
                <span className="flag" aria-hidden>{z.flag}</span>
                <div>
                  <h2>{m.exchange}</h2>
                  <p>{m.fullName} · {z.city}</p>
                </div>
              </div>
              <div className="when">
                <span className={`dot ${isOpen ? 'on' : ''}`} />
                <div>
                  <b>{isOpen ? 'Open' : 'Closed'}</b>
                  <p>{note}</p>
                </div>
              </div>
              <div className="strip" aria-label={`Session ${clock(open)} to ${clock(close)} your time`}>
                <i className={`session ${closedToday ? 'off' : ''}`} style={{ left: `${pct(open)}%`, width: `${Math.max(1, pct(close) - pct(open))}%` }} />
                <i className="now" style={{ left: `${pct(now)}%` }} />
              </div>
              <p className="hours">
                {clock(open)}–{clock(close)} <span>{clock(open, z.tz)}–{clock(close, z.tz)} in {z.city}</span>
              </p>
            </article>
          );
        })}
      </section>

      <footer>
        Session times from <a href={`https://apiverve.com/marketplace/stockmarketopentimes?${UTM}`}>APIVerve Stock Market Open Times</a>
      </footer>
    </main>
  );
}

function MissingKey() {
  return (
    <main className="app">
      <section className="board missing">
        <h2>Add your API key</h2>
        <p>
          This app needs an APIVerve API key. Get one free at{' '}
          <a href={`https://dashboard.apiverve.com/signup?api=stockmarketopentimes&${UTM}`}>dashboard.apiverve.com</a>, then set{' '}
          <code>APIVERVE_API_KEY</code> in <code>.env</code> or in your Vercel project’s environment variables, and reload.
        </p>
      </section>
    </main>
  );
}
