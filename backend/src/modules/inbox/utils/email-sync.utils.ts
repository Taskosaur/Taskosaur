export class EmailSyncUtils {
  /**
   * Extracts the thread ID from an email message using RFC 5322 threading headers.
   * Thread ID should be the message ID of the FIRST/ORIGINAL email in the thread.
   *
   * Logic:
   * 1. If message has references header, use the FIRST reference (oldest message in thread)
   * 2. If no references but has inReplyTo, this is a direct reply - use inReplyTo as thread ID
   * 3. If neither references nor inReplyTo exist, this IS the original - use messageId
   *
   * Note: The references header contains message IDs in chronological order [oldest...newest]
   *
   * @param message - Email message object with messageId, references, and inReplyTo fields
   * @returns Thread ID (should be consistent for all messages in the same conversation)
   */
  static extractThreadId(message: {
    messageId?: string;
    inReplyTo?: string;
    references?: string[] | string | Set<string>;
  }): string {
    // Normalize references to always be an array of valid message IDs
    let references: string[] = [];

    if (message.references) {
      if (Array.isArray(message.references)) {
        // Already an array - filter out invalid entries
        references = message.references
          .filter(
            (ref): ref is string => ref !== null && ref !== undefined && typeof ref === 'string',
          )
          .map((ref: string) => ref.trim())
          .filter((ref: string) => ref.length > 0);
      } else if (typeof message.references === 'string' && message.references.trim()) {
        // String format - split by whitespace (RFC 5322 allows space-separated list)
        references = message.references
          .trim()
          .split(/\s+/)
          .map((ref: string) => ref.trim())
          .filter((ref: string) => ref.length > 0);
      } else if (message.references instanceof Set) {
        // Some parsers return Set - convert to array
        references = Array.from(message.references)
          .filter(
            (ref): ref is string => ref !== null && ref !== undefined && typeof ref === 'string',
          )
          .map((ref: string) => ref.trim())
          .filter((ref: string) => ref.length > 0);
      }
    }

    // Priority 1: Use references[0] (the original/root email in the thread)
    if (references.length > 0) {
      return references[0];
    }

    // Priority 2: Use inReplyTo (for direct replies without full references chain)
    // This happens when an email client only sets In-Reply-To but not References
    if (message.inReplyTo && typeof message.inReplyTo === 'string') {
      const inReplyTo = message.inReplyTo.trim();
      if (inReplyTo.length > 0) {
        return inReplyTo;
      }
    }

    // Priority 3: This IS the original email (start of a new thread)
    // Use its own messageId as the thread identifier
    if (message.messageId && typeof message.messageId === 'string') {
      const messageId = message.messageId.trim();
      if (messageId.length > 0) {
        return messageId;
      }
    }

    // Fallback: Generate a unique thread ID (should rarely happen)
    // This is only for malformed emails without proper Message-ID headers
    const fallbackId = `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    // Note: Logger not available in static utility class - this warning is rare and acceptable
    return fallbackId;
  }

  static extractEmail(addr: string | { name?: string; address?: string }): string {
    if (!addr) return '';
    if (typeof addr === 'string') {
      const match = addr.match(/<(.+)>/) || addr.match(/([^\s]+@[^\s]+)/);
      return match ? match[1] : addr;
    }
    return addr.address || '';
  }

  static extractName(addr: string | { name?: string; address?: string }): string {
    if (!addr) return '';
    if (typeof addr === 'string') {
      const match = addr.match(/^(.+?)\s*<.+>$/);
      return match ? match[1].replace(/['"]/g, '').trim() : '';
    }
    return addr.name || '';
  }

  static createSnippet(content: string): string {
    if (!content) return '';
    // Remove HTML tags more safely by replacing them multiple times to handle nested/malformed tags
    let text = content;
    let previousText = '';
    // Keep removing tags until no more changes occur (handles malformed/nested HTML)
    while (text !== previousText) {
      previousText = text;
      text = text.replace(/<[^>]*>/g, '');
    }
    text = text.trim();
    return text.length > 200 ? text.substring(0, 197) + '...' : text;
  }

  static formatAddress(address: any): any {
    if (!address) return '';
    if (typeof address === 'string') return address;
    if (Array.isArray(address)) {
      const formatted: string[] = address.map((a) => EmailSyncUtils.formatAddress(a) as string);
      return formatted.join(', ');
    }
    if (typeof address === 'object') {
      if (address.address) {
        return address.name ? `${address.name} <${address.address}>` : address.address;
      }
    }
    return '';
  }

  static formatAddressList(addresses: any): string[] {
    if (!addresses) return [];
    if (Array.isArray(addresses)) {
      return addresses.map((addr): string => {
        if (typeof addr === 'string') return addr;
        return (addr.address as string) || '';
      });
    }
    if (typeof addresses === 'object') return [(addresses.address as string) || ''];
    if (typeof addresses === 'string') return [addresses];
    return [];
  }

  static extractSignature(text: string): { body: string; signature: string } {
    if (!text) return { body: text, signature: '' };

    const lines = text.split('\n');
    let signatureStartLine = -1;

    const signatureMarkers = [
      /^--\s*$/,
      /^(Best|Regards|Sincerely|Thanks|Cheers)/i,
      /Sent from my (iPhone|iPad|Android)/i,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      for (const marker of signatureMarkers) {
        if (marker.test(line)) {
          signatureStartLine = i;
          break;
        }
      }

      if (signatureStartLine !== -1) break;

      if (/@/.test(line) || /\+?\d{1,4}[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}/.test(line)) {
        const remainingLines = lines.slice(i);
        const avgLength =
          remainingLines.reduce((sum, l) => sum + l.length, 0) / remainingLines.length;

        if (avgLength < 60 && i > lines.length * 0.6) {
          signatureStartLine = i;
          break;
        }
      }
    }

    if (signatureStartLine !== -1) {
      const body = lines.slice(0, signatureStartLine).join('\n').trim();
      const signature = lines.slice(signatureStartLine).join('\n').trim();
      return { body, signature };
    }

    return { body: text, signature: '' };
  }

  static extractSignatureHtml(html: string): {
    body: string;
    signature: string;
  } {
    if (!html) return { body: html, signature: '' };

    const signatureStart = html.search(/<div[^>]*class="[^"]*gmail_signature[^"]*"/i);

    if (signatureStart !== -1) {
      const body = html.substring(0, signatureStart).trim();
      const signature = html.substring(signatureStart).trim();
      return { body, signature };
    }

    const outlookStart = html.search(/<div[^>]*id="[^"]*Signature[^"]*"/i);
    if (outlookStart !== -1) {
      return {
        body: html.substring(0, outlookStart).trim(),
        signature: html.substring(outlookStart).trim(),
      };
    }

    const dashMatch = html.match(/(<br\s*\/?>|<p>)\s*--\s*(<br\s*\/?>|<\/p>)/i);
    if (dashMatch && dashMatch.index) {
      return {
        body: html.substring(0, dashMatch.index).trim(),
        signature: html.substring(dashMatch.index).trim(),
      };
    }

    return { body: html, signature: '' };
  }

  static extractVisibleReplyText(text: string): string {
    const separatorPatterns = [
      /On\s+.+?\s+at\s+.+?wrote:/im,
      /On\s+.+?,\s+.+?wrote:/im,
      /-{3,}\s*Original\s*Message\s*-{3,}/im,
      /^From:\s*.+/im,
      /-{3,}\s*Forwarded\s*Message\s*-{3,}/im,
      />\s*Begin\s+forwarded\s+message/im,
      /Begin\s+forwarded\s+message:/im,
      /Sent\s+from\s+my\s+(iPhone|iPad|Android|Mobile)/im,
      /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}.+?:/im,
      /.+?wrote:\s*$/im,
      /^(From|Sent|To|Date|Subject):\s*.+/im,
    ];

    let earliestIndex = text.length;

    for (const pattern of separatorPatterns) {
      const match = text.match(pattern);
      if (match?.index !== undefined && match.index < earliestIndex) {
        earliestIndex = match.index;
      }
    }

    const lines = text.split('\n');
    let firstQuotedLine = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('>')) {
        firstQuotedLine = i;
        break;
      }
    }

    if (firstQuotedLine !== -1) {
      const beforeQuote = lines.slice(0, firstQuotedLine).join('\n');
      earliestIndex = Math.min(earliestIndex, beforeQuote.length);
    }

    return text.substring(0, earliestIndex).trim();
  }

  static extractVisibleReplyHtml(html: string): string {
    let clean = html;

    clean = clean.replace(/<div\s+class="gmail_quote[^"]*">[\s\S]*?<\/div>/gi, '');
    clean = clean.replace(/<div\s+class="gmail_attr[^"]*">[\s\S]*?<\/div>/gi, '');
    clean = clean.replace(/<div\s+class="gmail_quote_container[^"]*">[\s\S]*$/gi, '');
    clean = clean.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '');
    clean = clean.replace(/<div\s+class="OutlookMessageHeader[^"]*">[\s\S]*?<\/div>/gi, '');
    clean = clean.replace(/<div\s+class="yahoo_quoted[^"]*">[\s\S]*?<\/div>/gi, '');
    clean = clean.replace(/<div\s+type="cite">[\s\S]*?<\/div>/gi, '');
    clean = clean.replace(/<hr[^>]*>/gi, '');
    clean = clean.replace(/<div\s+class="[^"]*signature[^"]*">[\s\S]*?<\/div>/gi, '');
    clean = clean.replace(/(<br\s*\/?>|\s)+$/gi, '');

    return clean.trim();
  }

  static extractVisibleReply(content: string, isHtml: boolean = false): string {
    if (!content) return '';
    return isHtml
      ? EmailSyncUtils.extractVisibleReplyHtml(content)
      : EmailSyncUtils.extractVisibleReplyText(content);
  }

  static async generateTaskSlug(
    title: string,
    projectId: string,
    prisma: { task: { findFirst: (args: any) => Promise<any> } },
  ): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    let slug = baseSlug;
    let counter = 1;

    while (await prisma.task.findFirst({ where: { projectId, slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  static async getNextTaskNumber(
    projectId: string,
    prisma: { task: { findFirst: (args: any) => Promise<{ taskNumber: number } | null> } },
  ): Promise<number> {
    const lastTask = await prisma.task.findFirst({
      where: { projectId },
      orderBy: { taskNumber: 'desc' },
      select: { taskNumber: true },
    });
    return (lastTask?.taskNumber || 0) + 1;
  }
}
