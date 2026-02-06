export interface DetectedElement {
  index: number;
  element: Element;
  tagName: string;
  attributes: Record<string, string>;
  text: string;
}

export interface DOMDetectionResult {
  elements: DetectedElement[];
  pseudoHtml: string;
  totalCount: number;
}

export class DOMDetector {
  private elementIndex = 0;
  private clickableElements: Map<number, Element> = new Map();
  private computedStyleCache = new WeakMap<Element, CSSStyleDeclaration>();

  public detectElements(): DOMDetectionResult {
    this.elementIndex = 0;
    this.clickableElements.clear();
    this.computedStyleCache = new WeakMap();

    const detectedElements: DetectedElement[] = [];
    this.traverseDOM(document.body, detectedElements);
    const pseudoHtml = this.generatePseudoHtml(detectedElements);

    return { elements: detectedElements, pseudoHtml, totalCount: detectedElements.length };
  }

  public getElement(index: number): Element | undefined {
    return this.clickableElements.get(index);
  }

  public findIndexByElement(target: Element): number | null {
    for (const [idx, el] of this.clickableElements.entries()) {
      if (el === target || target.contains(el) || el.contains(target)) {
        return idx;
      }
    }
    return null;
  }

  private traverseDOM(node: Node, detectedElements: DetectedElement[]): void {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    if (!this.isElementAccepted(element)) return;

    const isInteractive = this.isInteractiveElement(element);
    const isVisible = this.isElementVisible(element);
    const isTop = this.isTopElement(element);

    if (isInteractive && isVisible && isTop) {
      const detected = this.createDetectedElement(element);
      detectedElements.push(detected);
      this.clickableElements.set(detected.index, element);
    }

    for (const child of Array.from(element.children)) {
      this.traverseDOM(child, detectedElements);
    }

    if (element.shadowRoot) {
      for (const child of Array.from(element.shadowRoot.children)) {
        this.traverseDOM(child, detectedElements);
      }
    }

    if (element.tagName.toLowerCase() === "iframe") {
      try {
        const iframe = element as HTMLIFrameElement;
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc?.body) {
          for (const child of Array.from(iframeDoc.body.children)) {
            this.traverseDOM(child, detectedElements);
          }
        }
      } catch (e) {}
    }
  }

  private createDetectedElement(element: Element): DetectedElement {
    const index = this.elementIndex++;
    const tagName = element.tagName.toLowerCase();
    const attributes: Record<string, string> = {};
    const importantAttrs = ["id", "title", "type", "name", "role", "class", "src", "href", "aria-label", "placeholder", "value", "alt", "data-automation-id"];

    for (const attr of importantAttrs) {
      const value = element.getAttribute(attr);
      if (value) {
        if (attr === "class" && value.length > 50) {
          attributes[attr] = value.split(" ").slice(0, 3).join(" ");
        } else if ((attr === "src" || attr === "href") && value.length > 200) {
          continue;
        } else if ((attr === "src" || attr === "href") && value.startsWith("/")) {
          attributes[attr] = window.location.origin + value;
        } else {
          attributes[attr] = value;
        }
      }
    }

    if (element.hasAttribute('disabled') || (element as any).disabled === true || element.getAttribute('aria-disabled') === 'true') {
      attributes['disabled'] = 'true';
    }

    const text = this.getElementText(element);
    return { index, element, tagName, attributes, text };
  }

  private getElementText(element: Element): string {
    const textParts: string[] = [];

    const collectText = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) textParts.push(text);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (!this.isInteractiveElement(el) || el === element) {
          for (const child of Array.from(node.childNodes)) collectText(child);
        }
      }
    };

    collectText(element);
    let text = textParts.join(" ").replace(/\s+/g, " ").trim();

    if (!text) {
      const ariaLabel = element.getAttribute("aria-label");
      if (ariaLabel) text = ariaLabel;
      else {
        const ariaLabelledBy = element.getAttribute("aria-labelledby");
        if (ariaLabelledBy) {
          const labelElement = document.getElementById(ariaLabelledBy);
          if (labelElement) text = labelElement.textContent?.trim() || "";
        }
      }
      if (!text && element.getAttribute("title")) text = element.getAttribute("title") || "";
      if (!text) {
        const parent = element.parentElement;
        if (parent) {
          text = parent.getAttribute("aria-label") || parent.getAttribute("title") || parent.getAttribute("data-tooltip") || parent.getAttribute("data-tip") || "";
        }
      }
      if (!text) {
        text = element.getAttribute("data-tooltip") || element.getAttribute("data-tip") || element.getAttribute("data-title") || element.getAttribute("data-content") || "";
      }
      if (!text) text = this.getIconDescription(element);
      if (!text) {
        const img = element.querySelector("img");
        if (img) text = img.getAttribute("alt") ? `image: ${img.getAttribute("alt")}` : "image button";
      }
      if (!text && element.querySelector("svg")) {
        const svg = element.querySelector("svg");
        const svgTitle = svg?.querySelector("title")?.textContent?.trim();
        if (svgTitle) text = svgTitle;
        else {
          const svgAriaLabel = svg?.getAttribute("aria-label");
          if (svgAriaLabel) text = svgAriaLabel;
          else {
            const svgClass = svg?.getAttribute("class") || "";
            const dataIcon = svg?.getAttribute("data-icon") || svg?.getAttribute("data-lucide");
            if (dataIcon) text = dataIcon.replace(/-/g, " ");
            else if (svgClass.includes("lucide")) {
              const iconMatch = svgClass.match(/lucide-([a-z-]+)/);
              text = iconMatch ? iconMatch[1].replace(/-/g, " ") : "icon button";
            } else text = "icon button";
          }
        }
      }
      if (!text) {
        const role = element.getAttribute("role") || element.tagName.toLowerCase();
        text = `${role} button`;
      }
    }

    return text.slice(0, 100);
  }

  private getIconDescription(element: Element): string {
    const classNames = element.className?.toString() || "";

    const faMatch = classNames.match(/fa-([a-z-]+)/);
    if (faMatch) return faMatch[1].replace(/-/g, " ");

    if (classNames.includes("material-icons")) {
      const iconText = element.textContent?.trim();
      if (iconText && iconText.length < 30) return iconText;
    }

    const iconPatterns = [/icon-([a-z-]+)/i, /bi-([a-z-]+)/i, /mdi-([a-z-]+)/i];
    for (const pattern of iconPatterns) {
      const match = classNames.match(pattern);
      if (match) return match[1].replace(/-/g, " ");
    }

    return element.getAttribute("data-icon") || "";
  }

  private isElementAccepted(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    const skipTags = ["script", "style", "noscript", "meta", "link", "head"];
    if (skipTags.includes(tagName)) return false;

    const style = this.getCachedComputedStyle(element);
    if (style?.display === "none") return false;

    return true;
  }

  private isInteractiveElement(element: Element): boolean {
    const interactiveTags = new Set(["a", "button", "input", "select", "textarea", "details", "summary", "audio", "video", "embed", "object", "label"]);
    const interactiveRoles = new Set(["button", "link", "checkbox", "radio", "menuitem", "tab", "option", "switch", "textbox", "searchbox", "combobox", "slider", "scrollbar", "menu", "menubar", "listbox", "tree"]);

    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute("role");
    const ariaRole = element.getAttribute("aria-role");
    const tabIndex = element.getAttribute("tabindex");

    if (interactiveTags.has(tagName)) return true;
    if (role && interactiveRoles.has(role)) return true;
    if (ariaRole && interactiveRoles.has(ariaRole)) return true;
    if (tabIndex !== null && tabIndex !== "-1") return true;
    if (element.getAttribute("contenteditable") === "true") return true;

    const htmlElement = element as HTMLElement;
    if (htmlElement.onclick !== null) return true;
    if (element.getAttribute("onclick") !== null) return true;
    if (element.hasAttribute("ng-click") || element.hasAttribute("@click") || element.hasAttribute("v-on:click")) return true;

    if (element.hasAttribute("aria-expanded") || element.hasAttribute("aria-pressed") || element.hasAttribute("aria-selected") || element.hasAttribute("aria-checked")) return true;

    if (element.getAttribute("draggable") === "true") return true;

    const style = this.getCachedComputedStyle(element);
    if (style?.cursor === "pointer") {
      const parent = element.parentElement;
      if (parent) {
        const parentStyle = this.getCachedComputedStyle(parent);
        if (parentStyle?.cursor === "pointer") return false;
      }
      return true;
    }

    return false;
  }

  private isElementVisible(element: Element): boolean {
    const htmlElement = element as HTMLElement;

    // Check dimensions
    if (htmlElement.offsetWidth === 0 && htmlElement.offsetHeight === 0) {
      return false;
    }

    // Check computed style
    const style = this.getCachedComputedStyle(element);
    if (!style) return false;

    if (style.visibility === "hidden") return false;
    if (style.display === "none") return false;
    if (style.opacity === "0") return false;

    return true;
  }

  private isTopElement(element: Element): boolean {
    try {
      const rect = element.getBoundingClientRect();

      // Check if element is outside viewport
      if (
        rect.bottom < 0 ||
        rect.top > window.innerHeight ||
        rect.right < 0 ||
        rect.left > window.innerWidth
      ) {
        return false;
      }

      // Get center point
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const topElement = document.elementFromPoint(x, y);
      if (!topElement) return false;

      let current: Element | null = topElement;
      let depth = 0;
      while (current && depth < 15) {
        if (current === element) return true;
        current = current.parentElement;
        depth++;
      }
      return false;
    } catch (e) {
      return true;
    }
  }

  private getCachedComputedStyle(element: Element): CSSStyleDeclaration | null {
    if (this.computedStyleCache.has(element)) {
      return this.computedStyleCache.get(element)!;
    }

    try {
      const style = window.getComputedStyle(element);
      if (style) {
        this.computedStyleCache.set(element, style);
      }
      return style;
    } catch (e) {
      return null;
    }
  }

  private generatePseudoHtml(elements: DetectedElement[]): string {
    const lines: string[] = [];
    const priorityAttrs = ["id", "aria-label", "title", "type", "placeholder", "role", "data-automation-id"];

    for (const el of elements) {
      let attrsStr = "";
      const otherAttrs: string[] = [];

      for (const [key, value] of Object.entries(el.attributes)) {
        if (priorityAttrs.includes(key)) {
          attrsStr += ` ${key}="${value}"`;
        } else {
          otherAttrs.push(`${key}="${value}"`);
        }
      }

      if (otherAttrs.length > 0 && attrsStr.length < 100) {
        attrsStr += " " + otherAttrs.slice(0, 2).join(" ");
      }

      lines.push(`[${el.index}]:<${el.tagName}${attrsStr}>${el.text}</${el.tagName}>`);
    }

    return lines.join("\n");
  }
}

let globalDetector: DOMDetector | null = null;

export function getGlobalDetector(): DOMDetector {
  if (!globalDetector) {
    globalDetector = new DOMDetector();
  }
  return globalDetector;
}

export function testDetector() {
  const detector = getGlobalDetector();
  const result = detector.detectElements();

  // Test element retrieval
  if (result.totalCount > 0) {
    const firstElement = detector.getElement(0);
  }

  return result;
}

if (typeof window !== "undefined") {
  (window as any).testDetector = testDetector;
  (window as any).DOMDetector = DOMDetector;
}
