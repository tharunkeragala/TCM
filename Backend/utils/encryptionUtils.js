const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;       // 96-bit IV, recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag
const KEY_LENGTH = 32;      // 256-bit key

let cachedKey = null;

/**
 * Loads and validates DOCUMENT_ENCRYPTION_KEY (64 hex chars = 32 bytes).
 * Generate one with: openssl rand -hex 32
 */
function getEncryptionKey() {
  if (cachedKey) return cachedKey;

  const keyHex = process.env.DOCUMENT_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("DOCUMENT_ENCRYPTION_KEY environment variable is not set");
  }

  const key = Buffer.from(keyHex, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `DOCUMENT_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters)`
    );
  }

  cachedKey = key;
  return key;
}

/**
 * Encrypts a Buffer in memory.
 * @param {Buffer} buffer - plaintext file contents
 * @returns {{ encrypted: Buffer, iv: Buffer, authTag: Buffer }}
 */
function encryptBuffer(buffer) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { encrypted, iv, authTag };
}

/**
 * Decrypts a Buffer in memory.
 * @param {Buffer} encrypted
 * @param {Buffer} iv
 * @param {Buffer} authTag
 * @returns {Buffer} plaintext file contents
 */
function decryptBuffer(encrypted, iv, authTag) {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

module.exports = {
  encryptBuffer,
  decryptBuffer,
  ALGORITHM,
  IV_LENGTH,
  AUTH_TAG_LENGTH,
};