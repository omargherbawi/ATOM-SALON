// Prints a fresh VAPID key pair for web push. Run once, then store the values
// in .env.local (local dev) and as Worker secrets (production).
import { base64UrlEncode } from '../lib/web-push';

async function main() {
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair;

  const publicKey = new Uint8Array(
    await crypto.subtle.exportKey('raw', pair.publicKey)
  );
  const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey);

  console.log(`VAPID_PUBLIC_KEY=${base64UrlEncode(publicKey)}`);
  console.log(`VAPID_PRIVATE_KEY=${d}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
