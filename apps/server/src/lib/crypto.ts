import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

const ENC_PREFIX = 'enc:';

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

export function encrypt(value: string, passphrase: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Format: enc:salt:iv:tag:encrypted (all base64)
  return `${ENC_PREFIX}${salt.toString('base64')}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decrypt(encryptedValue: string, passphrase: string): string {
  if (!encryptedValue.startsWith(ENC_PREFIX)) {
    return encryptedValue; // Not encrypted, return as-is
  }

  const parts = encryptedValue.slice(ENC_PREFIX.length).split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted value format');
  }

  const [saltB64, ivB64, tagB64, encryptedB64] = parts;
  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const key = deriveKey(passphrase, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}

export function decryptConfig(config: Record<string, string>, passphrase: string): Record<string, string> {
  const decrypted: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(config)) {
    if (isEncrypted(value)) {
      try {
        decrypted[key] = decrypt(value, passphrase);
      } catch (err) {
        throw new Error(`Failed to decrypt ${key}: ${(err as Error).message}`);
      }
    } else {
      decrypted[key] = value;
    }
  }

  return decrypted;
}
