import * as crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-for-development-only';
const secretKey = crypto.scryptSync(encryptionKey, 'salt', 32);

if (!process.env.ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
  console.warn(
    'ENCRYPTION_KEY not found in environment variables. Using default key. Set ENCRYPTION_KEY for production.',
  );
}

/**
 * Encrypts a string value using AES-256-GCM
 * @param text The text to encrypt
 * @returns The encrypted string in the format iv:authTag:encryptedText
 */
export function encrypt(text: string): string {
  if (!text) return text;

  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypts a string value encrypted with AES-256-GCM
 * @param encryptedText The encrypted text in the format iv:authTag:encryptedText
 * @returns The decrypted string
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      // If it's not in the expected format, return as is (could be legacy plain text)
      return encryptedText;
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    // Return the original text if decryption fails (fallback for non-encrypted data)
    return encryptedText;
  }
}
