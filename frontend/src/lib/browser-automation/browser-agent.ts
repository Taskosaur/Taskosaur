import { DOMDetector } from "./dom-detector";
import { ActionExecutor } from "./action-executor";
import api from "@/lib/api";

export interface BrowserAgentConfig {
  maxIterations?: number;
  waitAfterAction?: number; // ms to wait after each action
}

export interface AgentStep {
  iteration: number;
  action: string;
  result: string;
  elementsCount?: number;
}

export interface AgentResult {
  success: boolean;
  message: string;
  steps: AgentStep[];
}

export class BrowserAgent {
  private detector: DOMDetector;
  private executor: ActionExecutor;
  private config: Required<BrowserAgentConfig>;
  private steps: AgentStep[] = [];
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor(config?: BrowserAgentConfig) {
    this.detector = new DOMDetector();
    this.executor = new ActionExecutor();
    this.config = {
      maxIterations: config?.maxIterations || 20,
      waitAfterAction: config?.waitAfterAction || 500,
    };
  }

  public async executeTask(
    task: string,
    onProgress?: (step: AgentStep) => void
  ): Promise<AgentResult> {
    this.steps = [];

    for (let i = 0; i < this.config.maxIterations; i++) {
      try {
        const detectionResult = this.detector.detectElements();

        const llmResponse = await this.callLLM(
          task,
          detectionResult.pseudoHtml,
          i === 0 // isFirstIteration
        );

        const parsedAction = this.parseAction(llmResponse);

        if (!parsedAction) {
          const step: AgentStep = {
            iteration: i + 1,
            action: "done",
            result: llmResponse,
            elementsCount: detectionResult.totalCount,
          };
          this.steps.push(step);
          if (onProgress) onProgress(step);

          return {
            success: true,
            message: llmResponse,
            steps: this.steps,
          };
        }

        //  Execute the action
        const actionResult = await this.executeAction(parsedAction, this.detector);

        // Record step
        const step: AgentStep = {
          iteration: i + 1,
          action: `${parsedAction.type}(${parsedAction.params.join(", ")})`,
          result: actionResult.message,
          elementsCount: detectionResult.totalCount,
        };
        this.steps.push(step);
        if (onProgress) onProgress(step);

        if (!actionResult.success) {
          // Action failed - add this to conversation history so LLM knows
          this.conversationHistory.push({
            role: "user",
            content: `Action failed: ${parsedAction.type}(${parsedAction.params.join(", ")}) - ${actionResult.message}`,
          });
          return {
            success: false,
            message: `Action failed: ${actionResult.message}`,
            steps: this.steps,
          };
        }

        // Add action result to conversation history so LLM knows what was done
        this.conversationHistory.push({
          role: "user",
          content: `Action completed: ${parsedAction.type}(${parsedAction.params.join(", ")}) - ${actionResult.message}`,
        });

        // Wait for page to settle after action
        await this.wait(this.config.waitAfterAction);
      } catch (error) {
        console.error("Error in ReAct loop:", error);
        return {
          success: false,
          message: `Error: ${(error as Error).message}`,
          steps: this.steps,
        };
      }
    }

    // Max iterations reached
    return {
      success: false,
      message: `Max iterations (${this.config.maxIterations}) reached without completing task`,
      steps: this.steps,
    };
  }

  //Call LLM via backend with conversation history
  private async callLLM(
    task: string,
    elementsHtml: string,
    isFirstIteration: boolean
  ): Promise<string> {
    try {
      // Build user message
      let userMessage: string;
      const currentUrl = window.location.href;

      if (isFirstIteration) {
        userMessage = `Task: ${task}\n\nCurrent URL: ${currentUrl}\n\nAvailable elements:\n${elementsHtml}`;
      } else {
        userMessage = `Current URL: ${currentUrl}\n\nAvailable elements:\n${elementsHtml}`;
      }

      // Add to conversation history
      this.conversationHistory.push({
        role: "user",
        content: userMessage,
      });

      const response = await api.post("/ai-chat/chat", {
        message: userMessage,
        history: this.conversationHistory.slice(0, -1),
      });

      const llmResponse = response.data.message || "";

      // Add LLM response to history
      this.conversationHistory.push({
        role: "assistant",
        content: llmResponse,
      });

      return llmResponse;
    } catch (error: any) {
      throw new Error(`LLM API error: ${error.response?.data?.message || error.message}`);
    }
  }

  //Parse LLM response to extract action

  private parseAction(response: string): { type: string; params: any[] } | null {
    const trimmed = response.trim();

    // Check for DONE
    if (trimmed.startsWith("DONE:") || trimmed.toLowerCase().includes("task complete")) {
      return null;
    }

    // Check for ACTION: format
    const actionMatch = trimmed.match(/ACTION:\s*(\w+)\(([^)]*)\)/i);
    if (!actionMatch) {
      return null;
    }

    const actionType = actionMatch[1].toLowerCase();
    const paramsStr = actionMatch[2].trim();

    // Parse parameters
    const params: any[] = [];

    if (paramsStr) {
      const paramMatches = paramsStr.match(/(?:[^,"]+|"[^"]*")+/g) || [];
      for (const param of paramMatches) {
        const trimmedParam = param.trim();
        if (trimmedParam.startsWith('"') && trimmedParam.endsWith('"')) {
          params.push(trimmedParam.slice(1, -1));
        } else {
          const num = parseInt(trimmedParam, 10);
          params.push(isNaN(num) ? trimmedParam : num);
        }
      }
    }

    return { type: actionType, params };
  }


  private async executeAction(
    action: { type: string; params: any[] },
    detector: DOMDetector
  ): Promise<{ success: boolean; message: string }> {
    const { type, params } = action;

    switch (type) {
      case "click":
        if (params.length < 1) {
          return { success: false, message: "click requires an index parameter" };
        }
        return await this.executor.clickElement(params[0], { detector });

      case "type":
        if (params.length < 2) {
          return { success: false, message: "type requires index and text parameters" };
        }
        return await this.executor.inputText(params[0], params[1], { detector });

      case "scroll":
        if (params.length < 1) {
          return { success: false, message: "scroll requires a direction parameter" };
        }
        const direction = params[0].toLowerCase();
        if (direction !== "up" && direction !== "down") {
          return { success: false, message: 'scroll direction must be "up" or "down"' };
        }
        return await this.executor.scroll(direction as "up" | "down");

      case "select":
        if (params.length < 2) {
          return { success: false, message: "select requires index and option parameters" };
        }
        return await this.executor.selectOption(params[0], params[1], { detector });

      default:
        return { success: false, message: `Unknown action type: ${type}` };
    }
  }


  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }


  public getSteps(): AgentStep[] {
    return this.steps;
  }


  public reset(): void {
    this.steps = [];
    this.conversationHistory = [];
  }
}

// Global instance for testing
let globalAgent: BrowserAgent | null = null;

export function getGlobalAgent(): BrowserAgent {
  if (!globalAgent) {
    globalAgent = new BrowserAgent();
  }
  return globalAgent;
}

if (typeof window !== "undefined") {
  (window as any).BrowserAgent = BrowserAgent;
  (window as any).getGlobalAgent = getGlobalAgent;
}
