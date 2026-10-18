// Entrypoint named by wrangler.jsonc. OpenNext only exports `fetch`, so this
// wrapper exists to keep a single place to extend the Worker.
//
// A cron used to pre-warm the public cache by fetching every barber/date pair
// through WORKER_SELF_REFERENCE. It was papering over connections being shared
// between requests, and made that failure worse: a run took ~280s against a
// 180s schedule, so runs overlapped and piled up hung subrequests. Connections
// are now per request (see lib/mongodb.ts), so the warming is unnecessary.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore `.open-next/worker.js` only exists after a build
import { default as handler } from './.open-next/worker.js';

// Handing one of these to Next costs a full server render of the 404 page. On
// the free plan that render is what trips the 10ms CPU limit, and the reply is
// a 503 rather than a 404 - Safari on iOS asks for the touch icons on every
// visit, so real visitors were spending the CPU budget on them. Answering here
// costs no render, and the long max-age stops the client asking again.
//
// Paths the app actually serves (`/`, `/login`, `/dashboard`, `/barbers`,
// `/appointments`, `/settings`, `/my-appointments`, `/my-breaks`, `/api/*`)
// deliberately share no prefix with this list.
const JUNK_PREFIXES = [
  '/apple-touch-icon', // real 180x180 files exist, these are the odd variants
  '/browserconfig.xml',
  '/wp-',
  '/wordpress',
  '/xmlrpc.php',
  '/phpmyadmin',
  '/.env',
  '/.git',
  '/vendor/',
  '/cgi-bin/',
];

const NOT_FOUND_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=86400',
};

export default {
  fetch(request: Request, env: unknown, ctx: unknown) {
    const { pathname } = new URL(request.url);
    if (JUNK_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return new Response('Not found', {
        status: 404,
        headers: NOT_FOUND_HEADERS,
      });
    }

    return handler.fetch(request, env, ctx);
  },
};
