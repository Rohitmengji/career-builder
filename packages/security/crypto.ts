/*
 * @career-builder/security — Cryptographic Utilities
 *
 * Provides:
 *   - Secure random token generation (session IDs, CSRF tokens, API keys)
 *   - HMAC signing & verification (webhooks, signed URLs)
 *   - Constant-time string comparison (timing attack prevention)
 *   - Password hashing (bcrypt-compatible via scrypt — no native deps)
 *
 * All functions use Node.js built-in `crypto` — no external dependencies.
 */

import crypto from "crypto";

/* ================================================================== */
/*  Token generation                                                   */
/* ================================================================== */

/**
 * Generate a cryptographically secure random token.
 * Default: 32 bytes → 64 hex characters.
 */
export function generateToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("hex");
}

/**
 * Generate a URL-safe random token (base64url encoding).
 * Shorter than hex for the same entropy.
 */
export function generateUrlSafeToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("base64url");
}

/**
 * Generate a short ID for non-sensitive purposes (e.g., filenames).
 * Format: 12 hex chars (48 bits of entropy).
 */
export function generateShortId(): string {
  return crypto.randomBytes(6).toString("hex");
}

/**
 * Generate a CSRF token.
 * Uses 24 bytes (192 bits) which is more than sufficient.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/* ================================================================== */
/*  HMAC signing                                                       */
/* ================================================================== */

/**
 * Create an HMAC-SHA256 signature for a payload.
 * Used for webhook signing, signed URLs, integrity checks.
 */
export function hmacSign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify an HMAC-SHA256 signature in constant time.
 * Prevents timing attacks on signature comparison.
 */
export function hmacVerify(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = hmacSign(payload, secret);
  return timingSafeEqual(expected, signature);
}

/* ================================================================== */
/*  Constant-time comparison                                           */
/* ================================================================== */

/**
 * Compare two strings in constant time.
 * Prevents timing side-channel attacks on token/password comparison.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) {
    // Still do a comparison to avoid length-based timing leaks
    const dummy = Buffer.from(a);
    crypto.timingSafeEqual(dummy, dummy);
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/* ================================================================== */
/*  Password hashing (scrypt — no native deps)                        */
/* ================================================================== */

const SCRYPT_PARAMS = {
  N: 16384, // CPU/memory cost
  r: 8,     // Block size
  p: 1,     // Parallelism
  keyLen: 64,
};

/**
 * Hash a password using scrypt.
 * Returns a string in the format: $scrypt$N$r$p$salt$hash
 *
 * scrypt is the OWASP-recommended KDF available natively in Node.js.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const { N, r, p, keyLen } = SCRYPT_PARAMS;

  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, keyLen, { N, r, p }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });

  return `$scrypt$${N}$${r}$${p}$${salt}$${hash.toString("hex")}`;
}

/**
 * Verify a password against a scrypt hash.
 * Returns true if the password matches.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  // Format: $scrypt$N$r$p$salt$hash
  if (parts.length !== 7 || parts[1] !== "scrypt") {
    return false;
  }

  const N = parseInt(parts[2]!, 10);
  const r = parseInt(parts[3]!, 10);
  const p = parseInt(parts[4]!, 10);
  const salt = parts[5]!;
  const expectedHash = parts[6]!;

  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_PARAMS.keyLen, { N, r, p }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });

  return timingSafeEqual(hash.toString("hex"), expectedHash);
}

/* ================================================================== */
/*  Hashing                                                            */
/* ================================================================== */

/**
 * Create a SHA-256 hash of a string. Useful for fingerprinting, not passwords.
 */
export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Create a SHA-256 hash of a Buffer. Useful for file integrity checks.
 */
export function sha256Buffer(input: Buffer | ArrayBuffer): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/* ================================================================== */
/*  Encryption (AES-256-GCM — for sensitive at-rest data)              */
/* ================================================================== */

const AES_ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a string using AES-256-GCM.
 * Returns base64-encoded ciphertext in format: iv:authTag:ciphertext
 *
 * @param plaintext The string to encrypt
 * @param key       32-byte hex key (64 hex chars) or Buffer
 */
export function encrypt(plaintext: string, key: string | Buffer): string {
  const keyBuf = typeof key === "string" ? Buffer.from(key, "hex") : key;
  if (keyBuf.length !== 32) {
    throw new Error("Encryption key must be exactly 32 bytes (64 hex chars)");
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(AES_ALGO, keyBuf, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`;
}

/**
 * Decrypt an AES-256-GCM ciphertext.
 * Input format: iv.authTag.ciphertext (base64-encoded parts)
 */
export function decrypt(ciphertext: string, key: string | Buffer): string {
  const keyBuf = typeof key === "string" ? Buffer.from(key, "hex") : key;
  if (keyBuf.length !== 32) {
    throw new Error("Encryption key must be exactly 32 bytes (64 hex chars)");
  }

  const parts = ciphertext.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format");
  }

  const iv = Buffer.from(parts[0]!, "base64");
  const authTag = Buffer.from(parts[1]!, "base64");
  const encrypted = Buffer.from(parts[2]!, "base64");

  const decipher = crypto.createDecipheriv(AES_ALGO, keyBuf, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted) + decipher.final("utf8");
}
