import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly secretKey: Buffer;

  constructor() {
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-for-development-only';
    // scryptSync returns a Buffer, not a string
    this.secretKey = crypto.scryptSync(encryptionKey, 'salt', 32);

    if (!process.env.ENCRYPTION_KEY) {
      console.warn(
        'ENCRYPTION_KEY not found in environment variables. Using default key. Set ENCRYPTION_KEY for production.',
      );
    }
  }

  encrypt(text: string): string {
    if (!text) return text;

    try {
      // Use 12-byte IV for GCM mode (recommended)
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error(error);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  decrypt(encryptedText: string): string {
    if (!encryptedText) return encryptedText;

    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format');
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.secretKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error(error);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  encryptJson(obj: any): string | null {
    if (!obj) return null;
    return this.encrypt(JSON.stringify(obj));
  }

  decryptJson<T = any>(encryptedText: string): T | null {
    if (!encryptedText) return null;
    const decrypted = this.decrypt(encryptedText);
    return JSON.parse(decrypted) as T;
  }

  generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  hash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }
}
