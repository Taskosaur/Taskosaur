export class EmailSyncUtils {
  static extractThreadId(message: any): string {
    if (message.references) {
      const refs = typeof message.references === 'string' 
        ? message.references.split(/\s+/) 
        : message.references;
      if (refs.length > 0) return refs[0];
    }
    if (message.inReplyTo) return message.inReplyTo;

    return message.messageId || `${Date.now()}-${Math.random()}`;
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
    const text = content.replace(/<[^>]*>/g, '').trim();
    return text.length > 200 ? text.substring(0, 197) + '...' : text;
  }

  static formatAddress(address: any): string {
    if (!address) return '';
    if (typeof address === 'string') return address;
    if (Array.isArray(address)) {
      return address.map((a) => EmailSyncUtils.formatAddress(a)).join(', ');
    }
    if (typeof address === 'object') {
      if (address.address) {
        return address.name
          ? `${address.name} <${address.address}>`
          : address.address;
      }
    }
    return '';
  }

  static formatAddressList(addresses: any): string[] {
    if (!addresses) return [];
    if (Array.isArray(addresses)) {
      return addresses.map(addr => {
        if (typeof addr === 'string') return addr;
        return addr.address || '';
      });
    }
    if (typeof addresses === 'object') return [addresses.address || ''];
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
        const avgLength = remainingLines.reduce((sum, l) => sum + l.length, 0) / remainingLines.length;

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

  static extractSignatureHtml(html: string): { body: string; signature: string } {
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
        signature: html.substring(outlookStart).trim()
      };
    }

    const dashMatch = html.match(/(<br\s*\/?>|<p>)\s*--\s*(<br\s*\/?>|<\/p>)/i);
    if (dashMatch && dashMatch.index) {
      return {
        body: html.substring(0, dashMatch.index).trim(),
        signature: html.substring(dashMatch.index).trim()
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

  static async generateTaskSlug(title: string, projectId: string, prisma: any): Promise<string> {
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

  static async getNextTaskNumber(projectId: string, prisma: any): Promise<number> {
    const lastTask = await prisma.task.findFirst({
      where: { projectId },
      orderBy: { taskNumber: 'desc' },
    });
    return (lastTask?.taskNumber || 0) + 1;
  }
}
