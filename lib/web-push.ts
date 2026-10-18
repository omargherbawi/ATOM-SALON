// Web Push sender built on Web Crypto only. The `web-push` npm package relies
// on Node's `https` and ECDH APIs, which do not run reliably on Workers, so
// this implements the two specs it needs directly:
//   - RFC 8291: payload encryption (aes128gcm)
//   - RFC 8292: VAPID authentication (ES256 JWT)
// Delivery goes through the browser vendors' push services (FCM, Mozilla,
// Apple), which are free.

export type PushSubscriptionKeys = {
  p256dh: string;
  auth: string;
};

export type PushTarget = {
  endpoint: string;
  keys: PushSubscriptionKeys;
};

export type VapidKeys = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export type PushResult = {
  ok: boolean;
  status: number;
  // The push service no longer knows this subscription; delete it.
  gone: boolean;
};

const RECORD_SIZE = 4096;
const encoder = new TextEncoder();

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function hkdf(
  salt: Uint8Array<ArrayBuffer>,
  ikm: Uint8Array<ArrayBuffer>,
  info: Uint8Array<ArrayBuffer>,
  length: number
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

// An uncompressed P-256 point is 0x04 || x (32 bytes) || y (32 bytes).
function publicKeyToJwk(publicKey: Uint8Array) {
  return {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(publicKey.slice(1, 33)),
    y: base64UrlEncode(publicKey.slice(33, 65)),
  };
}

async function importEcdhPrivateKey(
  privateKey: Uint8Array,
  publicKey: Uint8Array
) {
  return crypto.subtle.importKey(
    'jwk',
    { ...publicKeyToJwk(publicKey), d: base64UrlEncode(privateKey), ext: true },
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits']
  );
}

type ServerKeys = {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
};

async function generateServerKeys(): Promise<ServerKeys> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const publicKey = new Uint8Array(
    await crypto.subtle.exportKey('raw', pair.publicKey)
  );
  return { privateKey: base64UrlDecode(jwk.d || ''), publicKey };
}

/**
 * Encrypts a payload for one subscription. `salt` and `serverKeys` are only
 * passed in by tests (to replay the RFC 8291 example); real sends use fresh
 * random values every time.
 */
export async function encryptPayload(
  payload: string,
  keys: PushSubscriptionKeys,
  options: { salt?: Uint8Array; serverKeys?: ServerKeys } = {}
): Promise<Uint8Array<ArrayBuffer>> {
  const userPublicKey = base64UrlDecode(keys.p256dh);
  const authSecret = base64UrlDecode(keys.auth);
  const salt = new Uint8Array(
    options.salt ?? crypto.getRandomValues(new Uint8Array(16))
  );
  const server = options.serverKeys ?? (await generateServerKeys());
  const serverPublicKey = new Uint8Array(server.publicKey);

  const serverPrivateKey = await importEcdhPrivateKey(
    server.privateKey,
    serverPublicKey
  );
  const userKey = await crypto.subtle.importKey(
    'raw',
    userPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: userKey },
      serverPrivateKey,
      256
    )
  );

  const ikm = await hkdf(
    authSecret,
    sharedSecret,
    concat(
      encoder.encode('WebPush: info\0'),
      userPublicKey,
      serverPublicKey
    ),
    32
  );
  const contentKey = await hkdf(
    salt,
    ikm,
    encoder.encode('Content-Encoding: aes128gcm\0'),
    16
  );
  const nonce = await hkdf(
    salt,
    ikm,
    encoder.encode('Content-Encoding: nonce\0'),
    12
  );

  // A single record: the plaintext followed by the 0x02 "last record" marker.
  const record = concat(encoder.encode(payload), new Uint8Array([2]));
  if (record.length + 16 > RECORD_SIZE) {
    throw new Error('Push payload is too large');
  }

  const aesKey = await crypto.subtle.importKey(
    'raw',
    contentKey,
    'AES-GCM',
    false,
    ['encrypt']
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, record)
  );

  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = serverPublicKey.length;

  return concat(header, serverPublicKey, ciphertext);
}

export async function createVapidJwt(
  audience: string,
  vapid: VapidKeys,
  expiresInSeconds = 12 * 60 * 60
): Promise<string> {
  const publicKey = base64UrlDecode(vapid.publicKey);
  const signingKey = await crypto.subtle.importKey(
    'jwk',
    { ...publicKeyToJwk(publicKey), d: vapid.privateKey, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const header = base64UrlEncode(
    encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  );
  const claims = base64UrlEncode(
    encoder.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
        sub: vapid.subject,
      })
    )
  );
  const unsigned = `${header}.${claims}`;
  // Web Crypto already returns the raw r || s form that ES256 expects.
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      signingKey,
      encoder.encode(unsigned)
    )
  );

  return `${unsigned}.${base64UrlEncode(signature)}`;
}

export async function sendWebPush(
  target: PushTarget,
  payload: string,
  vapid: VapidKeys,
  options: { ttlSeconds?: number; urgency?: 'normal' | 'high' } = {}
): Promise<PushResult> {
  const body = await encryptPayload(payload, target.keys);
  const jwt = await createVapidJwt(new URL(target.endpoint).origin, vapid);

  const response = await fetch(target.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(options.ttlSeconds ?? 24 * 60 * 60),
      Urgency: options.urgency ?? 'high',
    },
    body,
  });

  return {
    ok: response.ok,
    status: response.status,
    gone: response.status === 404 || response.status === 410,
  };
}
