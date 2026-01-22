import { useState, useEffect, useRef, useCallback } from "react";
import { HiXMark, HiPaperAirplane, HiSparkles, HiArrowPath } from "react-icons/hi2";
import { useChatContext } from "@/contexts/chat-context";
import { mcpServer, extractContextFromPath } from "@/lib/mcp-server";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { BrowserAgent } from "@/lib/browser-automation/browser-agent";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export default function ChatPanel() {
  const { isChatOpen, toggleChat } = useChatContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isContextManuallyCleared, setIsContextManuallyCleared] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string | null>(null);
  const { getCurrentUser } = useAuth();
  const [panelWidth, setPanelWidth] = useState(400);
  const resizing = useRef(false);

  // Browser automation state
  const [isBrowserAgentRunning, setIsBrowserAgentRunning] = useState(false);
  const browserAgentRef = useRef<BrowserAgent | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizing.current) return;
    const newWidth = Math.min(Math.max(window.innerWidth - e.clientX, 400), 650);
    setPanelWidth(newWidth);
  };

  const handleMouseUp = () => {
    resizing.current = false;
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Initialize browser agent
  useEffect(() => {
    if (typeof window !== 'undefined' && !browserAgentRef.current) {
      browserAgentRef.current = new BrowserAgent({
        maxIterations: 30,
        waitAfterAction: 500,
      });
    }
  }, []);
  // Auto-resize textarea function
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = "auto";

      // Calculate new height based on content
      const newHeight = Math.min(textarea.scrollHeight, 120); // Max height of 120px
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  // Handle input change with auto-resize
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
      // Adjust height after state update
      setTimeout(adjustTextareaHeight, 0);
    },
    [adjustTextareaHeight]
  );

  // Load messages from session storage (improved logic)
  const loadMessagesFromHistory = useCallback(() => {
    try {
      // Only load if we don't have any messages yet
      if (messages.length > 0) {
        return false;
      }

      const storedHistory = sessionStorage.getItem("mcp_conversation_history");
      if (storedHistory) {
        const chatHistory: ChatMessage[] = JSON.parse(storedHistory);

        // Only load if we have substantial history (more than just a greeting)
        if (chatHistory.length > 2) {
          const convertedMessages: Message[] = chatHistory.map((msg, index) => ({
            role: msg.role === "system" ? "assistant" : msg.role,
            content: msg.content,
            timestamp: new Date(Date.now() - (chatHistory.length - index) * 1000),
            isStreaming: false,
          }));

          setMessages(convertedMessages);
          return true;
        }
      }
    } catch (error) {
      console.warn("Failed to load messages from session storage:", error);
    }
    return false;
  }, [messages.length]);

  // Initialize services on mount
  useEffect(() => {
    // Get current user
    const currentUser = getCurrentUser();
    const token = localStorage.getItem("access_token");
    const currentOrgId = localStorage.getItem("currentOrganizationId");

    setUser(currentUser);
    setCurrentOrganizationId(currentOrgId);

    if (token && currentUser) {
      // Initialize MCP server with context
      const pathContext = extractContextFromPath(pathname);

      mcpServer.initialize({
        currentUser: {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.email,
        },
        ...pathContext,
      });

      // Load existing conversation history
      loadMessagesFromHistory();
    }
  }, [pathname, getCurrentUser, loadMessagesFromHistory]);

  // Update context when path changes (unless manually cleared)
  useEffect(() => {
    if (user && !isContextManuallyCleared) {
      const pathContext = extractContextFromPath(pathname);
      mcpServer.updateContext(pathContext);
    }
  }, [pathname, user, isContextManuallyCleared]);

  if (
    currentOrganizationId !== null &&
    currentOrganizationId !== localStorage.getItem("currentOrganizationId") &&
    messages.length > 2
  ) {
    const newOrgId = localStorage.getItem("currentOrganizationId");
    setCurrentOrganizationId(newOrgId);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          "⚠️ Organization changed. My previous responses may no longer apply to the correct workspace or projects.",
        timestamp: new Date(),
      },
    ]);
  }
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Listen for workspace/project creation events
  useEffect(() => {
    const handleWorkspaceCreated = (event: CustomEvent) => {
      const { workspaceSlug, workspaceName } = event.detail;

      // Navigate to the new workspace
      router.push(`/${workspaceSlug}`);

      // Add a system message indicating navigation
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: `✅ Navigated to workspace: ${workspaceName}`,
          timestamp: new Date(),
        },
      ]);
    };

    const handleProjectCreated = (event: CustomEvent) => {
      const { workspaceSlug, projectSlug, projectName } = event.detail;

      // Navigate to the new project
      router.push(`/${workspaceSlug}/${projectSlug}`);

      // Add a system message indicating navigation
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: `✅ Navigated to project: ${projectName}`,
          timestamp: new Date(),
        },
      ]);
    };
    // Add event listeners
    if (typeof window !== "undefined") {
      window.addEventListener("aiWorkspaceCreated", handleWorkspaceCreated as EventListener);
      window.addEventListener("aiProjectCreated", handleProjectCreated as EventListener);

      return () => {
        window.removeEventListener("aiWorkspaceCreated", handleWorkspaceCreated as EventListener);
        window.removeEventListener("aiProjectCreated", handleProjectCreated as EventListener);
      };
    }
  }, [router]);

  // Handle browser automation
  const handleBrowserAutomation = async (message: string) => {
    if (!browserAgentRef.current) return;

    setIsBrowserAgentRunning(true);

    try {
      const result = await browserAgentRef.current.executeTask(message);

      let cleanMessage = result.message || "";
      if (cleanMessage.startsWith("DONE:")) {
        cleanMessage = cleanMessage.substring(5).trim() || "Done!";
      } else if (cleanMessage.startsWith("ASK:")) {
        cleanMessage = cleanMessage.substring(4).trim();
      }

      const resultMessage: Message = {
        role: "assistant",
        content: cleanMessage,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, resultMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        role: "assistant",
        content: `Browser automation error: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsBrowserAgentRunning(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || isBrowserAgentRunning) return;

    const userMessage: Message = {
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    await handleBrowserAutomation(userMessage.content);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    mcpServer.clearHistory();
    browserAgentRef.current?.reset();
  };

  const clearContext = async () => {
    try {
      // Clear the context both locally and on backend
      await mcpServer.clearContext();

      // Set flag to prevent automatic context extraction from URL
      setIsContextManuallyCleared(true);

      // Also clear the history to ensure clean context
      mcpServer.clearHistory();

      // Clear the local messages but keep the context clear message
      setMessages([
        {
          role: "system",
          content:
            "🔄 Context cleared. You are now in global mode - specify workspace and project for your next actions.",
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error("Failed to clear context:", error);
      setError("Failed to clear context. Please try again.");
    }
  };

  // Improved sync logic that only runs on mount/chat open, not during active messaging
  useEffect(() => {
    const syncWithMcpHistory = () => {
      try {
        // Skip sync if context was manually cleared or if user is actively messaging
        if (isContextManuallyCleared || isLoading) {
          return;
        }

        const mcpHistory = mcpServer.getHistory();

        // Only sync if we have significant history and no current streaming
        if (mcpHistory.length > 2 && !messages.some((m) => m.isStreaming)) {
          const currentHistoryLength = messages.filter(
            (m) => m.role !== "system" || !m.content.includes("Context cleared")
          ).length;

          // Only sync if there's a meaningful difference (more than 1 message gap)
          if (Math.abs(mcpHistory.length - currentHistoryLength) > 1) {
            const syncedMessages: Message[] = mcpHistory.map((msg: ChatMessage, index: number) => ({
              role: msg.role === "system" ? "assistant" : msg.role,
              content: msg.content,
              timestamp:
                messages[index]?.timestamp ||
                new Date(Date.now() - (mcpHistory.length - index) * 1000),
              isStreaming: false,
            }));

            // Preserve system messages from manual context clearing
            const systemMessages = messages.filter(
              (m) => m.role === "system" && m.content.includes("Context cleared")
            );
            setMessages([...systemMessages, ...syncedMessages]);
          }
        }
      } catch (error) {
        console.warn("Failed to sync with MCP history:", error);
      }
    };

    // Only sync on initial load when chat opens, not continuously
    if (isChatOpen && user && !isContextManuallyCleared && !isLoading) {
      const timeout = setTimeout(syncWithMcpHistory, 500); // Longer delay to avoid conflicts
      return () => clearTimeout(timeout);
    }
  }, [isChatOpen, user]); // Removed messages.length to prevent continuous triggering

  return (
    <>
      {/* Chat Panel - positioned below header */}
      <div
        className={`fixed top-0 right-0 bottom-0 bg-[var(--background)] border-l border-[var(--border)] z-40 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isChatOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: `${panelWidth}px` }}
      >
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 bottom-0 w-0.5 cursor-col-resize bg-transparent hover:bg-gray-300/40"
        />
        {/* Chat Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--background)]">
          <div className="flex items-center gap-2">
            <HiSparkles className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-primary">AI Assistant</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Context Clear Button */}
            <button
              onClick={clearContext}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)]  rounded-md transition-all duration-200"
              title="Clear workspace/project context"
            >
              <HiArrowPath className="w-3 h-3" />
              Context
            </button>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] rounded-md transition-all duration-200"
              >
                Clear
              </button>
            )}
            <button
              onClick={toggleChat}
              className="p-1.5 rounded-md hover:bg-[var(--accent)] transition-all duration-200"
            >
              <HiXMark className="w-5 h-5 text-[var(--muted-foreground)]" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4 space-y-6 chatgpt-scrollbar"
          style={{
            scrollbarWidth: "none" /* Firefox */,
            msOverflowStyle: "none" /* Internet Explorer 10+ */,
          }}
        >
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-[var(--muted)] max-w-sm">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-400 flex items-center justify-center">
                    <HiSparkles className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-primary mb-2">
                    Hi! I'm your Taskosaur AI Assistant
                  </h3>
                  <p className="text-sm mb-4 text-gray-600 dark:text-gray-400">
                    I can help you manage tasks, projects, and workspaces
                  </p>
                  <div className="text-left bg-[var(--accent)] rounded-lg p-4">
                    <p className="text-sm font-medium mb-2 text-[var(--muted-foreground)]">
                      Try these commands:
                    </p>
                    <ul className="text-sm space-y-1.5 text-gray-600 dark:text-gray-400">
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                        "Create a task called [name]"
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                        "Show high priority tasks"
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                        "Mark [task] as done"
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                        "Create a workspace called [name]"
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                        "List my projects"
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                        "Navigate to [workspace] workspace"
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <div key={index} className="group">
                    {message.role === "user" ? (
                      // User Message - Right aligned like
                      <div className="flex justify-end mb-4">
                        <div className="flex items-start gap-3 max-w-[80%]">
                          <div className="bg-[#1E2939] text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
                            <div className="text-sm whitespace-pre-wrap break-words">
                              {message.content}
                            </div>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#1E2939] text-sm font-medium flex-shrink-0">
                            {user?.firstName?.[0]?.toUpperCase() +
                              user?.lastName?.[0]?.toUpperCase() || "U"}
                          </div>
                        </div>
                      </div>
                    ) : message.role === "system" ? (
                      // System Message - Centered
                      <div className="flex justify-center mb-4">
                        <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2 text-sm max-w-[90%]">
                          {message.content}
                        </div>
                      </div>
                    ) : (
                      // Assistant Message - Left aligned like
                      <div className="flex justify-start mb-4">
                        <div className="flex items-start gap-3 max-w-[85%]">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-400 flex items-center justify-center flex-shrink-0">
                            <HiSparkles className="w-4 h-4 text-white" />
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm">
                            <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
                              {message.content}
                              {message.isStreaming && (
                                <span className="inline-block w-2 h-4 ml-1 bg-blue-600 animate-pulse rounded" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Timestamp - appears on hover */}
                    {message.timestamp && (
                      <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 -mt-2 mb-2">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {message.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                {isBrowserAgentRunning && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-400 flex items-center justify-center flex-shrink-0">
                    <HiSparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex items-center gap-0.5 h-4">
                    <span 
                      className="w-1 bg-gray-400 rounded-sm animate-pulse" 
                      style={{ 
                        animationDuration: "1.2s",
                        animationDelay: "0s",
                        height: "40%"
                      }} 
                    />
                    <span 
                      className="w-1 bg-gray-400 rounded-sm animate-pulse" 
                      style={{ 
                        animationDuration: "1.2s",
                        animationDelay: "0.2s",
                        height: "60%"
                      }} 
                    />
                    <span 
                      className="w-1 bg-gray-400 rounded-sm animate-pulse" 
                      style={{ 
                        animationDuration: "1.2s",
                        animationDelay: "0.4s",
                        height: "80%"
                      }} 
                    />
                    <span 
                      className="w-1 bg-gray-400 rounded-sm animate-pulse" 
                      style={{ 
                        animationDuration: "1.2s",
                        animationDelay: "0.6s",
                        height: "60%"
                      }} 
                    />
                  </div>
                </div>
              )}
                <div ref={messagesEndRef} />
              </>
            )}

          {error && (
            <div className="mx-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-red-600 dark:text-red-400 text-sm">!</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input Area - Fixed at bottom with auto-expanding textarea */}
        <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--background)] p-4">
            <div className="flex gap-3 items-end">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                placeholder={
                  !user
                    ? "Please log in to use AI assistant..."
                    :
                      "Message AI Assistant..."
                }
                disabled={isLoading || isBrowserAgentRunning || !user}
                rows={1}
                className="flex-1 px-4 py-3 bg-[var(--muted)] border-[var(--border)] focus:ring-1 focus:ring-[var(--border)] focus:border-transparent transition-all duration-200 rounded-xl shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                style={{
                  minHeight: "48px",
                  maxHeight: "120px",
                  lineHeight: "1.5",
                  height: "48px",
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading || isBrowserAgentRunning || !user}
                className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md disabled:shadow-none flex-shrink-0"
              >
                {isLoading || isBrowserAgentRunning ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <HiPaperAirplane className="w-4 h-4" />
                )}
              </button>
            </div>
        </div>
      </div>

      {/* Global styles for content squeeze and hidden scrollbars */}
      <style jsx global>{`
        body.chat-open .flex-1.overflow-y-scroll {
          margin-right: 400px !important;
          transition: margin-right 300ms ease-in-out;
        }

        .flex-1.overflow-y-scroll {
          transition: margin-right 300ms ease-in-out;
        }

        /* Hide scrollbars completely */
        .chatgpt-scrollbar::-webkit-scrollbar {
          display: none;
        }

        /* Smooth scrolling */
        .chatgpt-scrollbar {
          scroll-behavior: smooth;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* Internet Explorer 10+ */
        }
      `}</style>
    </>
  );
}
