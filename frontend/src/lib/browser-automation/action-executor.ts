import { getGlobalDetector } from "./dom-detector";

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
}

export class ActionExecutor {
  public async clickElement(
    index: number,
    options?: {
      button?: "left" | "right" | "middle";
      numClicks?: number;
      detector?: any;
    }
  ): Promise<ActionResult> {
    const { button = "left", numClicks = 1, detector: customDetector } = options || {};
    const detector = customDetector || getGlobalDetector();
    const element = detector.getElement(index);

    if (!element) {
      return { success: false, message: `Element with index ${index} not found` };
    }

    try {
      const htmlElement = element as HTMLElement;
      htmlElement.scrollIntoView({ behavior: "smooth", block: "center" });
      await this.wait(300);

      const rect = htmlElement.getBoundingClientRect();
      const clientX = rect.left + rect.width / 2;
      const clientY = rect.top + rect.height / 2;

      const linkElement =
        htmlElement.tagName === "A"
          ? (htmlElement as HTMLAnchorElement)
          : (htmlElement.closest("a") as HTMLAnchorElement | null);

      const isInternalLink = linkElement && this.isInternalLink(linkElement);

      // Internal links: use Next.js router for client-side navigation
      if (isInternalLink && linkElement) {
        const href = linkElement.getAttribute("href") || "/";
        const freshRect = htmlElement.getBoundingClientRect();
        const x = freshRect.left + freshRect.width / 2;
        const y = freshRect.top + freshRect.height / 2;

        htmlElement.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            pointerId: 1,
            pointerType: "mouse",
            clientX: x,
            clientY: y,
            buttons: 1,
          })
        );
        htmlElement.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            pointerId: 1,
            pointerType: "mouse",
            clientX: x,
            clientY: y,
            buttons: 0,
          })
        );

        const nextRouter = (window as any).__NEXT_ROUTER__;
        if (nextRouter?.push) {
          nextRouter.push(href);
        } else {
          window.location.href = href;
        }

        return {
          success: true,
          message: `Navigated to ${href} (client-side)`,
        };
      }

      // Non-link elements: normal click sequence
      for (let n = 0; n < numClicks; n++) {
        const freshRect = htmlElement.getBoundingClientRect();
        const x = freshRect.left + freshRect.width / 2;
        const y = freshRect.top + freshRect.height / 2;

        htmlElement.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            pointerId: 1,
            pointerType: "mouse",
            clientX: x,
            clientY: y,
            buttons: 1,
          })
        );
        htmlElement.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            pointerId: 1,
            pointerType: "mouse",
            clientX: x,
            clientY: y,
            buttons: 0,
          })
        );
        htmlElement.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            clientX: x,
            clientY: y,
            detail: 1,
          })
        );

        // Small wait between multiple clicks
        if (n < numClicks - 1) {
          await this.wait(50);
        }
      }

      return {
        success: true,
        message: `Clicked element [${index}] ${numClicks} time(s) with ${button} button`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error clicking element [${index}]: ${(error as Error).message}`,
      };
    }
  }

  public async inputText(
    index: number,
    text: string,
    options?: { pressEnter?: boolean; detector?: any }
  ): Promise<ActionResult> {
    const { pressEnter = false, detector: customDetector } = options || {};
    const detector = customDetector || getGlobalDetector();
    const element = detector.getElement(index);

    if (!element) {
      return {
        success: false,
        message: `Element with index ${index} not found`,
      };
    }

    try {
      let inputElement: any = null;
      const tagName = element.tagName.toUpperCase();

      if (tagName === "IFRAME") {
        const iframe = element as HTMLIFrameElement;
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          inputElement =
            iframeDoc.querySelector("textarea") ||
            iframeDoc.querySelector('[contenteditable="true"]') ||
            iframeDoc.querySelector("input");
        }
      } else if (tagName === "INPUT" || tagName === "TEXTAREA") {
        inputElement = element;
      } else {
        inputElement =
          element.querySelector("input") ||
          element.querySelector("textarea") ||
          element.querySelector('[contenteditable="true"]') ||
          element;
      }

      if (!inputElement) {
        return {
          success: false,
          message: `No input element found for index ${index}`,
        };
      }

      // Focus the input
      if (inputElement.focus) {
        inputElement.focus();
      }

      // Use native setter to trigger React's onChange
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;

      if (inputElement.value !== undefined) {
        if (inputElement instanceof HTMLInputElement && nativeInputValueSetter) {
          nativeInputValueSetter.call(inputElement, text);
        } else if (inputElement instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
          nativeTextAreaValueSetter.call(inputElement, text);
        } else {
          inputElement.value = text;
        }
      } else {
        inputElement.textContent = text;
      }

      inputElement.dispatchEvent(new Event("input", { bubbles: true }));
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));

      if (pressEnter) {
        ["keydown", "keypress", "keyup"].forEach((eventType) => {
          const event = new KeyboardEvent(eventType, {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            bubbles: true,
            cancelable: true,
          } as KeyboardEventInit);
          inputElement.dispatchEvent(event);
        });
      }

      return {
        success: true,
        message: `Typed "${text}" into element [${index}]${pressEnter ? " and pressed Enter" : ""}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error typing into element [${index}]: ${(error as Error).message}`,
      };
    }
  }

  public async scroll(direction: "up" | "down", amount: number = 1): Promise<ActionResult> {
    try {
      const scrollAmount = direction === "up" ? -amount : amount;
      const documentElement = document.documentElement || document.body;

      if (documentElement.scrollHeight > window.innerHeight * 1.2) {
        const y = Math.max(
          20,
          Math.min((window.innerHeight || documentElement.clientHeight) / 10, 200)
        );
        window.scrollBy(0, y * scrollAmount);
        return {
          success: true,
          message: `Scrolled ${direction} by ${Math.abs(y * scrollAmount)}px`,
        };
      }

      const scrollableElements = this.findScrollableElements();
      if (scrollableElements.length === 0) {
        return {
          success: false,
          message: "No scrollable content found on page",
        };
      }

      const sorted = scrollableElements
        .map((el) => ({
          element: el,
          visibleArea: this.getVisibleArea(el),
          zIndex: parseInt(window.getComputedStyle(el).zIndex || "0", 10),
        }))
        .sort((a, b) => {
          if (b.zIndex !== a.zIndex) return b.zIndex - a.zIndex;
          return b.visibleArea - a.visibleArea;
        });

      const targetElement = sorted[0].element;
      const htmlElement = targetElement as HTMLElement;

      const y = Math.max(
        20,
        Math.min((window.innerHeight || documentElement.clientHeight) / 10, 200)
      );
      targetElement.scrollBy(0, y * scrollAmount);

      return {
        success: true,
        message: `Scrolled ${direction} in scrollable container by ${Math.abs(y * scrollAmount)}px`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error scrolling: ${(error as Error).message}`,
      };
    }
  }

  public async selectOption(
    index: number,
    optionText: string,
    options?: { detector?: any }
  ): Promise<ActionResult> {
    const { detector: customDetector } = options || {};
    const detector = customDetector || getGlobalDetector();
    const element = detector.getElement(index);

    if (!element) {
      return {
        success: false,
        message: `Element with index ${index} not found`,
      };
    }

    const selectElement = element as HTMLSelectElement;
    if (selectElement.tagName.toUpperCase() !== "SELECT") {
      return {
        success: false,
        message: `Element [${index}] is not a select element`,
      };
    }

    try {
      const trimmedText = optionText.trim();
      let option = Array.from(selectElement.options).find((opt) => opt.text.trim() === trimmedText);
      if (!option) {
        option = Array.from(selectElement.options).find((opt) => opt.value.trim() === trimmedText);
      }

      if (!option) {
        const availableOptions = Array.from(selectElement.options).map((o) => o.text.trim());
        return {
          success: false,
          message: `Option "${optionText}" not found`,
          data: { availableOptions },
        };
      }

      selectElement.value = option.value;
      selectElement.dispatchEvent(new Event("change", { bubbles: true }));

      return {
        success: true,
        message: `Selected "${option.text.trim()}" in element [${index}]`,
        data: {
          selectedValue: option.value,
          selectedText: option.text.trim(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error selecting option: ${(error as Error).message}`,
      };
    }
  }

  public async getSelectOptions(index: number): Promise<ActionResult> {
    const detector = getGlobalDetector();
    const element = detector.getElement(index);

    if (!element) {
      return {
        success: false,
        message: `Element with index ${index} not found`,
      };
    }

    const selectElement = element as HTMLSelectElement;
    if (selectElement.tagName.toUpperCase() !== "SELECT") {
      return {
        success: false,
        message: `Element [${index}] is not a select element`,
      };
    }

    try {
      const options = Array.from(selectElement.options).map((opt) => ({
        index: opt.index,
        text: opt.text.trim(),
        value: opt.value,
      }));

      return {
        success: true,
        message: `Found ${options.length} options`,
        data: {
          options,
          name: selectElement.name,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting options: ${(error as Error).message}`,
      };
    }
  }

  public async hoverElement(index: number): Promise<ActionResult> {
    const detector = getGlobalDetector();
    const element = detector.getElement(index);

    if (!element) {
      return {
        success: false,
        message: `Element with index ${index} not found`,
      };
    }

    try {
      const event = new MouseEvent("mouseenter", {
        bubbles: true,
        cancelable: true,
        view: window,
      });

      element.dispatchEvent(event);

      return {
        success: true,
        message: `Hovered over element [${index}]`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error hovering: ${(error as Error).message}`,
      };
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isInternalLink(linkElement: HTMLAnchorElement | null): boolean {
    if (!linkElement) return false;
    const href = linkElement.getAttribute("href");
    if (!href) return false;
    if (
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:") ||
      href === "#" ||
      href.startsWith("#")
    ) {
      return false;
    }
    if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
      try {
        const url = new URL(href, window.location.origin);
        return url.origin === window.location.origin;
      } catch {
        return false;
      }
    }
    return true;
  }

  private findScrollableElements(): Element[] {
    const allElements = this.findAllNodes();
    let scrollable = allElements.filter((el) => {
      const style = window.getComputedStyle(el);
      const overflowY = style.getPropertyValue("overflow-y");
      return (overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight;
    });

    if (scrollable.length === 0) {
      scrollable = allElements.filter((el) => {
        const style = window.getComputedStyle(el);
        const overflowY = style.getPropertyValue("overflow-y");
        return overflowY === "auto" || overflowY === "scroll" || el.scrollHeight > el.clientHeight;
      });
    }
    return scrollable;
  }

  private findAllNodes(rootElement: Document | Element = document): Element[] {
    const nodes: Element[] = [];
    for (const node of Array.from(rootElement.querySelectorAll("*"))) {
      if (node.tagName === "IFRAME") {
        try {
          const iframe = node as HTMLIFrameElement;
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) nodes.push(...this.findAllNodes(iframeDoc));
        } catch (e) {}
      } else {
        nodes.push(node);
      }
    }
    return nodes;
  }

  private getVisibleArea(element: Element): number {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const visibleLeft = Math.max(0, Math.min(rect.left, viewportWidth));
    const visibleRight = Math.max(0, Math.min(rect.right, viewportWidth));
    const visibleTop = Math.max(0, Math.min(rect.top, viewportHeight));
    const visibleBottom = Math.max(0, Math.min(rect.bottom, viewportHeight));

    const visibleWidth = visibleRight - visibleLeft;
    const visibleHeight = visibleBottom - visibleTop;

    return visibleWidth * visibleHeight;
  }
}

let globalExecutor: ActionExecutor | null = null;

export function getGlobalExecutor(): ActionExecutor {
  if (!globalExecutor) globalExecutor = new ActionExecutor();
  return globalExecutor;
}

export async function testClickElement(index: number) {
  const executor = getGlobalExecutor();
  const result = await executor.clickElement(index);
  return result;
}

if (typeof window !== "undefined") {
  (window as any).ActionExecutor = ActionExecutor;
  (window as any).getGlobalExecutor = getGlobalExecutor;
  (window as any).testClickElement = testClickElement;
}
