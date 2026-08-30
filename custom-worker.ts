// OpenNext only exports fetch. This wrapper adds a cron that keeps the public
// cache warm, so visitors never pay for a cold MongoDB connect (which can hang
// for 15-20s from a fresh Worker isolate).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore `.open-next/worker.js` only exists after a build
import { default as handler } from './.open-next/worker.js';

const WARM_DAYS = 14;
const MAX_WARM_CALLS = 45;

type WarmEnv = { WORKER_SELF_REFERENCE?: { fetch: typeof fetch } };

function localDate(offsetDays: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export default {
  fetch: handler.fetch,

  async scheduled(
    _controller: unknown,
    env: WarmEnv,
    ctx: { waitUntil: (promise: Promise<unknown>) => void }
  ) {
    const origin = 'https://atom-salon.omar-gherbawi.workers.dev';

    const call = (path: string) => {
      const request = new Request(`${origin}${path}`);
      if (env.WORKER_SELF_REFERENCE) {
        return env.WORKER_SELF_REFERENCE.fetch(request);
      }
      return handler.fetch(request, env, ctx);
    };

    const warm = (async () => {
      const bootstrap = await call('/api/public/bootstrap');
      const data = (await bootstrap.json()) as {
        barbers?: { _id: string }[];
      };

      const barbers = data.barbers ?? [];
      const dates = Array.from({ length: WARM_DAYS }, (_, i) => localDate(i));

      let calls = 0;
      for (const date of dates) {
        for (const barber of barbers) {
          if (calls >= MAX_WARM_CALLS) return;
          calls += 1;
          await call(
            `/api/public/availability?barberId=${barber._id}&date=${date}`
          ).catch(() => undefined);
        }
      }
    })();

    ctx.waitUntil(warm.catch(() => undefined));
  },
};
