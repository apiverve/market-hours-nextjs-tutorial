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

/** GET /api/markets: today's session for every exchange on the board, in one cached answer. */
export async function GET(request: Request) {
  const hit = fromCache('markets', TTL_MS);
  if (hit) return Response.json(hit);

  const blocked = guard(request);
  if (blocked) return blocked;

  return respond(async () => {
    const data = await Promise.all(EXCHANGES.map((exchange) => callApi<Market>('stockmarketopentimes', { query: { exchange } })));
    toCache('markets', data);
    return data;
  });
}
