import { defineCloudflareConfig } from '@opennextjs/cloudflare';
// Every route in this app is either fully prerendered at build time or a
// `force-dynamic` API route: nothing uses ISR, so the incremental cache never
// needs to be written to. Without an override the cache always misses and the
// Worker re-renders `/`, `/login` and the 404 page on every single request,
// which is what pushed cold requests past the free plan's 10ms CPU budget.
// Reading the prerendered HTML back out of the asset bundle costs ~no CPU.
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
