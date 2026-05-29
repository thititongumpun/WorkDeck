import type { EncryptedSecret } from "../domain/workspace";

const KDF_ITERATIONS = 250_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function encryptSecret(secret: string, masterPassword: string): Promise<EncryptedSecret> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(masterPassword, toArrayBuffer(salt), KDF_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, encoder.encode(secret));

  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
    kdfIterations: KDF_ITERATIONS,
  };
}

export async function decryptSecret(secret: EncryptedSecret, masterPassword: string) {
  const salt = base64ToBytes(secret.salt);
  const iv = base64ToBytes(secret.iv);
  const key = await deriveKey(masterPassword, toArrayBuffer(salt), secret.kdfIterations);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(base64ToBytes(secret.ciphertext)),
  );

  return decoder.decode(plaintext);
}

async function deriveKey(masterPassword: string, salt: ArrayBuffer, iterations: number) {
  const baseKey = await crypto.subtle.importKey("raw", encoder.encode(masterPassword), "PBKDF2", false, ["deriveKey"]);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
