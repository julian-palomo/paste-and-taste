// A pretend device for the measuring script: it holds a key pair and answers
// the two WebAuthn ceremonies the way a phone's passkey would, so the Worker
// verifies a real signature. Only what @simplewebauthn/server checks is built:
// an ES256 key, attestation "none", the "user present" and "user verified"
// flags, and a counter that stays at 0 as synced passkeys report it.

import { createHash, generateKeyPairSync, type KeyObject, randomBytes, sign } from "node:crypto";

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const sha256 = (data: Uint8Array | string) => createHash("sha256").update(data).digest();

// Just enough CBOR for a COSE key and an attestation object: small integers,
// byte strings, text strings and maps.
type Cbor = number | string | Uint8Array | Map<number | string, Cbor>;

function head(major: number, length: number): Buffer {
  if (length < 24) return Buffer.from([(major << 5) | length]);
  if (length < 256) return Buffer.from([(major << 5) | 24, length]);
  return Buffer.from([(major << 5) | 25, length >> 8, length & 0xff]);
}

function cbor(value: Cbor): Buffer {
  if (typeof value === "number") return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (typeof value === "string") {
    const text = Buffer.from(value, "utf8");
    return Buffer.concat([head(3, text.length), text]);
  }
  if (value instanceof Uint8Array) return Buffer.concat([head(2, value.length), value]);
  const entries = [...value].flatMap(([key, item]) => [cbor(key), cbor(item)]);
  return Buffer.concat([head(5, value.size), ...entries]);
}

const USER_PRESENT = 0x01;
const USER_VERIFIED = 0x04;
const HAS_CREDENTIAL = 0x40;

type Ceremony = { challenge: string; rpId: string; origin: string };

export class Passkey {
  readonly #privateKey: KeyObject;
  readonly #publicKey: KeyObject;
  readonly #id = randomBytes(32);

  constructor() {
    const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
    this.#privateKey = pair.privateKey;
    this.#publicKey = pair.publicKey;
  }

  #clientData(type: "webauthn.create" | "webauthn.get", { challenge, origin }: Ceremony) {
    return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  }

  #authenticatorData(rpId: string, flags: number, credential?: Buffer) {
    const counter = Buffer.alloc(4);
    return Buffer.concat([
      sha256(rpId),
      Buffer.from([flags]),
      counter,
      credential ?? Buffer.alloc(0),
    ]);
  }

  /** The answer to `generate-register-options`, for `verify-registration`. */
  register(ceremony: Ceremony) {
    const jwk = this.#publicKey.export({ format: "jwk" });
    const coseKey = cbor(
      new Map<number, Cbor>([
        [1, 2], // key type: EC2
        [3, -7], // algorithm: ES256
        [-1, 1], // curve: P-256
        [-2, Buffer.from(jwk.x ?? "", "base64url")],
        [-3, Buffer.from(jwk.y ?? "", "base64url")],
      ]),
    );
    const idLength = Buffer.from([this.#id.length >> 8, this.#id.length & 0xff]);
    const credential = Buffer.concat([Buffer.alloc(16), idLength, this.#id, coseKey]);
    const authData = this.#authenticatorData(
      ceremony.rpId,
      USER_PRESENT | USER_VERIFIED | HAS_CREDENTIAL,
      credential,
    );
    const attestationObject = cbor(
      new Map<string, Cbor>([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", authData],
      ]),
    );
    return {
      id: b64url(this.#id),
      rawId: b64url(this.#id),
      type: "public-key",
      authenticatorAttachment: "platform",
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64url(this.#clientData("webauthn.create", ceremony)),
        attestationObject: b64url(attestationObject),
        transports: ["internal"],
      },
    };
  }

  /**
   * The answer to `generate-authenticate-options`, for `verify-authentication`.
   * With `forged`, the signature comes from another key, which the Worker must refuse.
   */
  signIn(ceremony: Ceremony, { forged = false } = {}) {
    const clientData = this.#clientData("webauthn.get", ceremony);
    const authData = this.#authenticatorData(ceremony.rpId, USER_PRESENT | USER_VERIFIED);
    const key = forged
      ? generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey
      : this.#privateKey;
    const signature = sign("sha256", Buffer.concat([authData, sha256(clientData)]), key);
    return {
      id: b64url(this.#id),
      rawId: b64url(this.#id),
      type: "public-key",
      authenticatorAttachment: "platform",
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64url(clientData),
        authenticatorData: b64url(authData),
        signature: b64url(signature),
      },
    };
  }
}
