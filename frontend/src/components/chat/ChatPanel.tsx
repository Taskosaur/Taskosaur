import { useState, useEffect, useRef, useCallback } from "react";
import { formatDateTimeForDisplay } from "@/utils/date";
import { isValidSlug } from "@/utils/slugUtils";
import { HiXMark, HiPaperAirplane, HiSparkles, HiArrowPath, HiStop, HiMicrophone, HiPlus, HiTrash, HiPencil, HiBars3, HiChatBubbleLeft } from "react-icons/hi2";
import { useChatContext } from "@/contexts/chat-context";
import { mcpServer, extractContextFromPath, Conversation } from "@/lib/mcp-server";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { BrowserAgent } from "@/lib/browser-automation/browser-agent";
import { VoiceController } from "@/lib/voice";

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

function sanitizeErrorMessage(msg: string): string {
  const l = msg.toLowerCase();
  if (l.includes("rate limit") || l.includes("429") || l.includes("too many requests"))
    return "Rate limit reached. Please wait a moment and try again.";
  if (l.includes("context_length") || l.includes("context length") || l.includes("maximum context") || l.includes("too long"))
    return "Conversation too long. Please clear the chat and try again.";
  if (l.includes("element") && l.includes("not found"))
    return "I had trouble interacting with the page. Please try again.";
  if (l.includes("network") || l.includes("failed to fetch") || l.includes("econnrefused"))
    return "Network error. Please check your connection.";
  return msg.replace(/^Error:\s*/i, "").replace(/^LLM API error:\s*/i, "");
}

export default function ChatPanel() {
  const { isChatOpen, toggleChat } = useChatContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
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

  // Voice input state
  const voiceControllerRef = useRef<VoiceController | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Agent status display
  const thinkingWords = useRef([
    "Thinking", "Pondering", "Analyzing", "Processing",
    "Examining", "Figuring out", "Working on it", "Looking into it",
    "On it", "Brewing ideas", "Cooking up a plan", "Strategizing", "Contemplating", "Deliberating",
  ]);
  const lastStartIndex = useRef(0);
  const [agentStatus, setAgentStatus] = useState("");
  const thinkingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const thinkingDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAgentStatus = useCallback((status: string) => {
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
    }
    if (thinkingDelayRef.current) {
      clearTimeout(thinkingDelayRef.current);
      thinkingDelayRef.current = null;
    }
    if (status === "thinking") {
      setAgentStatus("");
      thinkingDelayRef.current = setTimeout(() => {
        const words = thinkingWords.current;
        let index = lastStartIndex.current;
        lastStartIndex.current = (lastStartIndex.current + 1) % words.length;
        setAgentStatus(words[index]);
        thinkingIntervalRef.current = setInterval(() => {
          index = (index + 1) % words.length;
          setAgentStatus(words[index]);
        }, 60000);
      }, 10000);
    } else {
      setAgentStatus(status);
    }
  }, []);

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

  // Initialize browser agent and clear stale history on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!browserAgentRef.current) {
        browserAgentRef.current = new BrowserAgent({
          maxIterations: 30,
          waitAfterAction: 500,
        });
      } else {
        browserAgentRef.current.reset();
      }

      // Initialize voice controller
      voiceControllerRef.current = new VoiceController({
        callbacks: {
          onStateChange: (state) => {
            setIsListening(state.isListening);
            setInterimTranscript(state.interimTranscript);
            setVoiceError(state.error);
          },
          onTranscriptReady: (fullTranscript) => {
            // Auto-send the transcribed message directly
            if (fullTranscript.trim()) {
              handleVoiceMessage(fullTranscript.trim());
            }
          },
          onError: (error) => {
            console.warn("Voice recognition error:", error);
            setIsListening(false);
          },
        },
        // 400ms delay after stopping to let API finalize word corrections
        finalizationDelay: 400,
        // Auto-stop after 2.5 seconds of silence
        silenceTimeout: 2500,
      });
    }

    // Cleanup on unmount
    return () => {
      voiceControllerRef.current?.destroy();
    };
  }, []);

  // Abort voice input on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isListening) {
        e.preventDefault();
        voiceControllerRef.current?.abort();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isListening]);

  // Abort voice input when clicking outside the chat panel
  useEffect(() => {
    if (!isListening) return;

    const handleClickOutside = (e: MouseEvent) => {
      const chatPanel = document.getElementById("chat-panel");
      if (chatPanel && !chatPanel.contains(e.target as Node)) {
        voiceControllerRef.current?.abort();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isListening]);

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

  const refreshConversations = useCallback(async () => {
    if (typeof window !== "undefined") {
      try {
        await mcpServer.loadAll();
      } catch (e) {
        console.warn("Failed to load conversations from backend", e);
      }
      setConversations(mcpServer.getConversations());
    }
  }, []);

  // Load messages from current conversation
  const loadMessagesFromHistory = useCallback(() => {
    try {
      const conv = mcpServer.getCurrentConversation();
      if (conv) {
        const convertedMessages: Message[] = conv.messages.map((msg, index) => ({
          role: msg.role === "system" ? "assistant" : msg.role,
          content: msg.content,
          timestamp: new Date(Date.now() - (conv.messages.length - index) * 1000),
          isStreaming: false,
        }));

        setMessages(convertedMessages);
        return true;
      }
    } catch (error) {
      console.warn("Failed to load messages from conversation history:", error);
    }
    return false;
  }, []);

  // Handlers for conversation threads
  const handleNewChat = async () => {
    const newId = await mcpServer.startNewConversation();
    setCurrentConversationId(newId);
    setIsHistoryOpen(false);
  };

  const handleSelectConversation = async (id: string) => {
    await mcpServer.switchConversation(id);
    setCurrentConversationId(id);
    setIsHistoryOpen(false);
  };

  const handleDeleteConversation = async (id: string) => {
    const nextId = await mcpServer.deleteConversation(id);
    setCurrentConversationId(nextId);
    await refreshConversations();
  };

  const handleRename = async (id: string) => {
    if (editTitle.trim()) {
      await mcpServer.renameConversation(id, editTitle.trim());
      await refreshConversations();
    }
    setEditingId(null);
    setEditTitle("");
  };

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
      }).then(async () => {
        // Load initial conversation
        const currentConv = mcpServer.getCurrentConversation();
        setCurrentConversationId(currentConv?.id || "");
        await refreshConversations();
      });
    }
  }, [pathname, getCurrentUser, refreshConversations]);

  // Update context when path changes (unless manually cleared)
  useEffect(() => {
    if (user && !isContextManuallyCleared) {
      const pathContext = extractContextFromPath(pathname);
      mcpServer.updateContext(pathContext);
    }
  }, [pathname, user, isContextManuallyCleared]);

  // Load conversation messages when active conversation changes
  useEffect(() => {
    if (currentConversationId) {
      loadMessagesFromHistory();
    }
  }, [currentConversationId, loadMessagesFromHistory]);

  // Sync messages state back to active conversation in DB
  useEffect(() => {
    let active = true;
    const syncHistory = async () => {
      const chatHistory: ChatMessage[] = messages
        .filter((m) => !m.isStreaming && m.role !== "system" && m.content && m.content.trim() !== "")
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const currentConv = mcpServer.getCurrentConversation();
      if (currentConv && currentConv.id) {
        // Clean currentConv.messages to contain only role and content for comparison
        const currentMessagesCleaned = (currentConv.messages || [])
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        const currentHistoryJson = JSON.stringify(currentMessagesCleaned);
        const newHistoryJson = JSON.stringify(chatHistory);

        if (currentHistoryJson !== newHistoryJson) {
          await mcpServer.saveHistory(chatHistory);
          if (!active) return;
          await refreshConversations();
        }
      }
    };

    syncHistory();
    return () => {
      active = false;
    };
  }, [messages, refreshConversations]);

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
      if (isValidSlug(workspaceSlug)) {
        router.push(`/${workspaceSlug}`);
      }

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
      if (isValidSlug(workspaceSlug) && isValidSlug(projectSlug)) {
        router.push(`/${workspaceSlug}/${projectSlug}`);
      }

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
      const result = await browserAgentRef.current.executeTask(message, undefined, handleAgentStatus, mcpServer.sessionId);

      let cleanMessage = result.message || "";
      if (cleanMessage.startsWith("DONE:")) {
        cleanMessage = cleanMessage.substring(5).trim() || "Done!";
      } else if (cleanMessage.startsWith("ASK:")) {
        cleanMessage = cleanMessage.substring(4).trim();
      } else if (cleanMessage.startsWith("Error: LLM API error: ")) {
        cleanMessage = cleanMessage.replace("Error: LLM API error: ", "").trim();
      } else if (cleanMessage.startsWith("Error: ")) {
        cleanMessage = cleanMessage.substring(7).trim();
      } else if (cleanMessage.startsWith("Action failed: ")) {
        cleanMessage = cleanMessage.substring(15).trim();
      }
      cleanMessage = sanitizeErrorMessage(cleanMessage);

      if (!cleanMessage || cleanMessage.trim() === "") {
        cleanMessage = "Task completed.";
      }

      const resultMessage: Message = {
        role: "assistant",
        content: cleanMessage,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, resultMessage]);
    } catch (error: any) {
      const rawMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Failed to process request";
      const errorMessage: Message = {
        role: "assistant",
        content: sanitizeErrorMessage(rawMessage),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
        thinkingIntervalRef.current = null;
      }
      if (thinkingDelayRef.current) {
        clearTimeout(thinkingDelayRef.current);
        thinkingDelayRef.current = null;
      }
      setAgentStatus("");
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

  // Voice input handlers
  const handleToggleVoice = () => {
    if (!voiceControllerRef.current) return;

    if (isListening) {
      // Stop listening — onTranscriptReady will auto-send if there's text
      voiceControllerRef.current.stopListening();
    } else {
      // Clear any previous errors and start listening
      setVoiceError(null);
      setInterimTranscript("");
      voiceControllerRef.current.startListening();
    }
  };

  /** Handle a voice message — adds it to chat and sends through the automation pipeline. */
  const handleVoiceMessage = async (message: string) => {
    if (!message.trim() || isLoading || isBrowserAgentRunning) return;

    const userMessage: Message = {
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    await handleBrowserAutomation(message);
  };

  const handleStopAgent = () => {
    browserAgentRef.current?.stop();
  };

  const clearChat = async () => {
    setMessages([]);
    await mcpServer.clearHistory();
    browserAgentRef.current?.reset();
    await refreshConversations();
  };

  const clearContext = async () => {
    try {
      // Clear the context both locally and on backend
      await mcpServer.clearContext();

      // Set flag to prevent automatic context extraction from URL
      setIsContextManuallyCleared(true);

      // Also clear the history to ensure clean context
      await mcpServer.clearHistory();

      // Clear the local messages but keep the context clear message
      setMessages([
        {
          role: "system",
          content:
            "🔄 Context cleared. You are now in global mode - specify workspace and project for your next actions.",
          timestamp: new Date(),
        },
      ]);
      await refreshConversations();
    } catch (error) {
      console.error("Failed to clear context:", error);
      setError("Failed to clear context. Please try again.");
    }
  };



  return (
    <>
      {/* Chat Panel - positioned below header */}
      <div
        id="chat-panel"
        className={`fixed top-0 right-0 bottom-0 bg-[var(--background)] border-l border-[var(--border)] z-40 transform transition-transform duration-300 ease-in-out flex flex-col overflow-hidden ${
          isChatOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: `${panelWidth}px` }}
      >
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 bottom-0 w-0.5 cursor-col-resize bg-transparent hover:bg-gray-300/40"
        />

        {/* Sidebar Overlay */}
        {isHistoryOpen && (
          <div 
            className="absolute inset-0 bg-black/45 z-30 transition-opacity duration-200"
            onClick={() => setIsHistoryOpen(false)}
          />
        )}

        {/* Sidebar Content */}
        <div className={`absolute top-0 bottom-0 left-0 w-[280px] bg-[var(--background)] border-r border-[var(--border)] z-40 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isHistoryOpen ? "translate-x-0" : "-translate-x-full"
        }`}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
            <h3 className="font-semibold text-primary">Chat History</h3>
            <button onClick={() => setIsHistoryOpen(false)} className="p-1 rounded-md hover:bg-[var(--accent)] transition-colors duration-200">
              <HiXMark className="w-5 h-5 text-[var(--muted-foreground)]" />
            </button>
          </div>
          
          {/* New Chat Button */}
          <div className="p-3 border-b border-[var(--border)] flex-shrink-0">
            <button 
              onClick={handleNewChat}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 text-sm font-medium shadow-sm hover:shadow"
            >
              <HiPlus className="w-4 h-4" />
              New Chat
            </button>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 chatgpt-scrollbar">
            {conversations.map(conv => (
              <div 
                key={conv.id}
                className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                  conv.id === currentConversationId 
                    ? "bg-[var(--accent)] text-primary font-medium" 
                    : "hover:bg-[var(--accent)]/65 text-[var(--muted-foreground)]"
                }`}
                onClick={() => handleSelectConversation(conv.id)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <HiChatBubbleLeft className="w-4 h-4 flex-shrink-0 text-blue-500" />
                  {editingId === conv.id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => handleRename(conv.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(conv.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-[var(--accent)] border border-blue-500 rounded px-1.5 py-0.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500 text-primary"
                      autoFocus
                    />
                  ) : (
                    <span className="text-sm truncate">{conv.title}</span>
                  )}
                </div>
                
                {editingId !== conv.id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(conv.id);
                        setEditTitle(conv.title);
                      }}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-[var(--muted-foreground)] hover:text-primary transition-colors"
                      title="Rename"
                    >
                      <HiPencil className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conv.id);
                      }}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/40 text-red-500 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <HiTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chat Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--background)]">
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setIsHistoryOpen(true);
                await refreshConversations();
              }}
              className="p-1 rounded-md hover:bg-[var(--accent)] transition-all duration-200"
              title="View Chat History"
            >
              <HiBars3 className="w-5 h-5 text-[var(--muted-foreground)]" />
            </button>
            <HiSparkles className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-primary">AI Assistant</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Context Clear Button */}
            <button
              onClick={clearContext}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)]  rounded-md transition-all duration-200"
              title="Clear Current Chat Context"
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
                          {formatDateTimeForDisplay(message.timestamp, {
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
                  <div className="flex items-center gap-2">
                    {agentStatus && <span className="text-sm text-gray-500 dark:text-gray-400 italic thinking-fade" key={agentStatus}>{agentStatus}...</span>}
                    <div className="flex items-center gap-0.5 h-4">
                      <span className="w-1 bg-gray-400 rounded-sm animate-pulse" style={{ animationDuration: "1.2s", animationDelay: "0s", height: "40%" }} />
                      <span className="w-1 bg-gray-400 rounded-sm animate-pulse" style={{ animationDuration: "1.2s", animationDelay: "0.2s", height: "60%" }} />
                      <span className="w-1 bg-gray-400 rounded-sm animate-pulse" style={{ animationDuration: "1.2s", animationDelay: "0.4s", height: "80%" }} />
                      <span className="w-1 bg-gray-400 rounded-sm animate-pulse" style={{ animationDuration: "1.2s", animationDelay: "0.6s", height: "60%" }} />
                    </div>
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
            {/* Interim transcript display (shown while listening) */}
            {isListening && interimTranscript && (
              <div className="mb-2 px-1">
                <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                  {interimTranscript}
                </span>
              </div>
            )}

            {/* Voice error display */}
            {voiceError && (
              <div className="mb-2 px-1">
                <span className="text-xs text-red-500 dark:text-red-400">
                  {voiceError}
                </span>
              </div>
            )}

            {/* Cancel hint while listening */}
            {isListening && (
              <div className="mb-1 px-1">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono">Esc</kbd> to cancel
                </span>
              </div>
            )}

            <div className="flex gap-3 items-end">
              {/* Microphone button */}
              <button
                onClick={handleToggleVoice}
                disabled={isLoading || isBrowserAgentRunning}
                className={`p-3 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isListening
                    ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                    : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                }`}
                title={isListening ? "Stop listening" : "Start voice input"}
              >
                <HiMicrophone className="w-4 h-4" />
              </button>

              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                placeholder={
                  !user
                    ? "Please log in to use AI assistant..."
                    : isListening
                    ? "Listening..."
                    : "Message AI Assistant..."
                }
                disabled={isLoading || isBrowserAgentRunning || !user || isListening}
                rows={1}
                className="flex-1 px-4 py-3 bg-[var(--muted)] border-[var(--border)] focus:ring-1 focus:ring-[var(--border)] focus:border-transparent transition-all duration-200 rounded-xl shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                style={{
                  minHeight: "48px",
                  maxHeight: "120px",
                  lineHeight: "1.5",
                  height: "48px",
                }}
              />
              {isBrowserAgentRunning ? (
                <button
                  onClick={handleStopAgent}
                  className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md flex-shrink-0"
                >
                  <HiStop className="w-4 h-4" />
                </button>
              ) : isListening ? (
                <button
                  onClick={() => voiceControllerRef.current?.stopListening()}
                  className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md flex-shrink-0 animate-pulse"
                  title="Stop listening and send"
                >
                  <HiStop className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading || !user}
                  className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md disabled:shadow-none flex-shrink-0"
                >
                  <HiPaperAirplane className="w-4 h-4" />
                </button>
              )}
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

        .thinking-fade {
          animation: fade-swap 4s ease-in-out infinite;
        }
        @keyframes fade-swap {
          0%, 90%, 100% { opacity: 1; }
          95% { opacity: 0; }
        }
      `}</style>
    </>
  );
}
