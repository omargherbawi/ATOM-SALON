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

export default {
  fetch: handler.fetch,
};
