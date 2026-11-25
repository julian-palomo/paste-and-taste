import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";

// A software passkey device for the tests. It holds an ES256 key pair and
// answers the two WebAuthn ceremonies as a phone would, with attestation
// "none", the user-present and user-verified flags, and a counter at 0, so
// the API verifies a real signature. That is all @simplewebauthn/server checks.

export type Ceremony = { challenge: string; rpId: string; origin: string };

const USER_PRESENT = 0x01;
const USER_VERIFIED = 0x04;
const HAS_CREDENTIAL = 0x40;

const base64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const sha256 = (data: Uint8Array | string) => createHash("sha256").update(data).digest();

// Only the CBOR a COSE key and an attestation object need: small integers,
// byte strings, text strings and maps.
type Cbor = number | string | Uint8Array | Map<number | string, Cbor>;

function cborHead(major: number, length: number): Buffer {
  if (length < 24) return Buffer.from([(major << 5) | length]);
  if (length < 256) return Buffer.from([(major << 5) | 24, length]);
  return Buffer.from([(major << 5) | 25, length >> 8, length & 0xff]);
}

function cbor(value: Cbor): Buffer {
  if (typeof value === "number") return value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value);
  if (typeof value === "string") {
    const text = Buffer.from(value, "utf8");
    return Buffer.concat([cborHead(3, text.length), text]);
  }
  if (value instanceof Uint8Array) return Buffer.concat([cborHead(2, value.length), value]);
  const items = [...value].flatMap(([key, item]) => [cbor(key), cbor(item)]);
  return Buffer.concat([cborHead(5, value.size), ...items]);
}

function clientData(type: "webauthn.create" | "webauthn.get", { challenge, origin }: Ceremony) {
  return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
}

function authenticatorData(rpId: string, flags: number, credential = Buffer.alloc(0)) {
  return Buffer.concat([sha256(rpId), Buffer.from([flags]), Buffer.alloc(4), credential]);
}

export function createPasskeyDevice() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const id = randomBytes(32);

  return {
    // The answer to the registration options.
    register(ceremony: Ceremony) {
      const jwk = publicKey.export({ format: "jwk" });
      const coseKey = cbor(
        new Map<number, Cbor>([
          [1, 2], // key type: EC2
          [3, -7], // algorithm: ES256
          [-1, 1], // curve: P-256
          [-2, Buffer.from(jwk.x ?? "", "base64url")],
          [-3, Buffer.from(jwk.y ?? "", "base64url")],
        ]),
      );
      const idLength = Buffer.from([id.length >> 8, id.length & 0xff]);
      const credential = Buffer.concat([Buffer.alloc(16), idLength, id, coseKey]);
      const attestation = cbor(
        new Map<string, Cbor>([
          ["fmt", "none"],
          ["attStmt", new Map()],
          [
            "authData",
            authenticatorData(
              ceremony.rpId,
              USER_PRESENT | USER_VERIFIED | HAS_CREDENTIAL,
              credential,
            ),
          ],
        ]),
      );
      return {
        id: base64url(id),
        rawId: base64url(id),
        type: "public-key",
        authenticatorAttachment: "platform",
        clientExtensionResults: {},
        response: {
          clientDataJSON: base64url(clientData("webauthn.create", ceremony)),
          attestationObject: base64url(attestation),
          transports: ["internal"],
        },
      };
    },

    // The answer to the sign-in options. With `otherKey`, the signature comes
    // from a key the API never saw, which it must refuse.
    signIn(ceremony: Ceremony, { otherKey = false } = {}) {
      const data = clientData("webauthn.get", ceremony);
      const authData = authenticatorData(ceremony.rpId, USER_PRESENT | USER_VERIFIED);
      const key = otherKey
        ? generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey
        : privateKey;
      const signature = sign("sha256", Buffer.concat([authData, sha256(data)]), key);
      return {
        id: base64url(id),
        rawId: base64url(id),
        type: "public-key",
        authenticatorAttachment: "platform",
        clientExtensionResults: {},
        response: {
          clientDataJSON: base64url(data),
          authenticatorData: base64url(authData),
          signature: base64url(signature),
        },
      };
    },
  };
}
