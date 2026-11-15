import { callApi, fromCache, guard, respond, toCache } from '@/lib/apiverve';

// Session times only change day to day, and the page works out open/closed from them itself,
// so one answer serves every visitor for an hour.
const TTL_MS = 60 * 60_000;

// The exchanges on the board. Stock Market Open Times knows about 40; add any you like.
const EXCHANGES = ['NYSE', 'NASDAQ', 'TSX', 'LSE', 'EURONEXT', 'HKEX', 'SSE', 'TSE', 'ASX'];

export type Market = {
  exchange: string;
  fullName: string;
  isOpen: boolean;
  openingTime: string; // local exchange time, "YYYY-MM-DD HH:mm:ss"
  closingTime: string;
  status?: string | null; // e.g. "weekend" or "holiday"
  holidayName?: string | null;
};

/**
 * GET /api/markets: today's session for every exchange on the board.
 * Each exchange is cached on its own. The free plan allows 5 calls a minute, so a cold board may come
 * back with only some exchanges; the page asks again a minute later for the rest.
 */
export async function GET(request: Request) {
  const cached = EXCHANGES.map((exchange) => fromCache<Market>(`market:${exchange}`, TTL_MS));
  if (cached.every(Boolean)) return Response.json(cached);

  const blocked = guard(request);
  if (blocked) return blocked;

  return respond(async () => {
    const results = await Promise.allSettled(
      EXCHANGES.map(async (exchange, i) => {
        if (cached[i]) return cached[i];
        const market = await callApi<Market>('stockmarketopentimes', { query: { exchange } });
        toCache(`market:${exchange}`, market);
        return market;
      })
    );
    const markets = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    // Nothing at all came back: pass the first error on (e.g. the rate limit).
    if (!markets.length) throw (results[0] as PromiseRejectedResult).reason;
    return markets;
  });
}
