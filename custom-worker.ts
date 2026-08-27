// OpenNext only exports fetch. This wrapper adds a cron that keeps the
// public barbers/settings cache warm so visitors do not pay a MongoDB TLS
// handshake on every page load.
// @ts-expect-error generated at build time
import { default as handler } from './.open-next/worker.js';

const WARM_PATHS = ['/api/public/barbers', '/api/settings'];

export default {
  fetch: handler.fetch,

  async scheduled(
    _controller: unknown,
    env: { WORKER_SELF_REFERENCE?: { fetch: typeof fetch } },
    ctx: { waitUntil: (promise: Promise<unknown>) => void }
  ) {
    const origin = 'https://atom-salon.internal';
    const run = Promise.all(
      WARM_PATHS.map((path) => {
        const request = new Request(`${origin}${path}`);
        if (env.WORKER_SELF_REFERENCE) {
          return env.WORKER_SELF_REFERENCE.fetch(request);
        }
        return handler.fetch(request, env, ctx);
      })
    );
    ctx.waitUntil(run);
  },
};
