import { useState, useEffect } from "react";
import { toast } from "sonner";
import { HiSparkles, HiKey, HiLink, HiEyeSlash } from "react-icons/hi2";
import { settingsApi, Setting } from "@/utils/api/settingsApi";
import api from "@/lib/api";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ActionButton from "../common/ActionButton";
import { HiCog, HiEye } from "react-icons/hi";

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AISettingsModal({ isOpen, onClose }: AISettingsModalProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Load settings when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const settings: Setting[] = await settingsApi.getAll("ai");

      settings.forEach((setting) => {
        switch (setting.key) {
          case "ai_enabled":
            const enabled = setting.value === "true";
            setIsEnabled(enabled);
            localStorage.setItem("aiEnabled", enabled.toString());
            window.dispatchEvent(
              new CustomEvent("aiSettingsChanged", {
                detail: { aiEnabled: enabled },
              })
            );
            break;
          case "ai_api_key":
            setApiKey(setting.value || "");
            break;
          case "ai_model":
            setModel(setting.value || "deepseek/deepseek-chat-v3-0324:free");
            break;
          case "ai_api_url":
            setApiUrl(setting.value || "https://openrouter.ai/api/v1");
            break;
        }
      });
    } catch (error) {
      console.error("Failed to load settings:", error);
      setMessage({ type: "error", text: "Failed to load AI settings" });
    } finally {
      setIsLoading(false);
    }
  };

  const saveSetting = async (key: string, value: string, description?: string) => {
    await settingsApi.setSetting({
      key,
      value,
      description,
      category: "ai",
      isEncrypted: key === "ai_api_key",
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      await Promise.all([
        saveSetting("ai_enabled", isEnabled.toString(), "Enable/disable AI chat functionality"),
        saveSetting("ai_api_key", apiKey, "AI provider API key"),
        saveSetting("ai_model", model, "AI model to use"),
        saveSetting("ai_api_url", apiUrl, "API endpoint URL"),
      ]);

      localStorage.setItem("aiEnabled", isEnabled.toString());
      window.dispatchEvent(
        new CustomEvent("aiSettingsChanged", {
          detail: { aiEnabled: isEnabled },
        })
      );

      setMessage({ type: "success", text: "AI settings saved successfully!" });
      toast.success("AI settings saved successfully!");
    } catch (error) {
      console.error("Failed to save settings:", error);
      setMessage({ type: "error", text: "Failed to save AI settings" });
      toast.error("Failed to save AI settings");
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    if (!isEnabled) {
      setMessage({ type: "error", text: "Please enable AI chat first" });
      return;
    }

    if (!apiKey) {
      setMessage({ type: "error", text: "Please enter an API key first" });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await api.post("/ai-chat/chat", {
        message: "Hello, this is a test message",
        history: [],
      });

      if (response.data.success) {
        setMessage({ type: "success", text: "Connection test successful!" });
        toast.success(
          response.data.message
            ? `Success: ${response.data.message}`
            : "Connection test successful!"
        );
      } else {
        const errorMsg = response.data.error || "Connection test failed";
        setMessage({
          type: "error",
          text: errorMsg,
        });
        toast.error(errorMsg);
      }
    } catch (error: any) {
      console.error("Connection test failed:", error);
      const errorMessage = error.response?.data?.error || error.message || "Connection test failed";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setMessage(null);
    onClose();
  };

  const isFormValid = isEnabled
    ? apiKey.trim().length > 0 && model.trim().length > 0 && apiUrl.trim().length > 0
    : true;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="projects-modal-container min-w-[40vw] border-none ">
        <DialogHeader className="projects-modal-header">
          <div className="projects-modal-header-content">
            <div className="projects-modal-icon bg-[var(--primary)]">
              <HiSparkles className="projects-modal-icon-content" />
            </div>
            <div className="projects-modal-info">
              <DialogTitle className="projects-modal-title">AI Assistant Settings</DialogTitle>
              <p className="projects-modal-description">
                Configure your AI chat functionality and API settings
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2">
          {/* Configuration Fields - Always visible */}
          {/* API Key */}
          <div className="space-y-2">
            <Label
              htmlFor="api-key"
              className="projects-form-label text-sm"
              style={{ fontSize: "14px" }}
            >
              <HiKey
                className="projects-form-label-icon size-3"
                style={{ color: "hsl(var(--primary))" }}
              />
              API Key <span className="projects-form-label-required">*</span>
            </Label>

            <div className="relative">
              <Input
                id="api-key"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
                disabled={isLoading || isSaving}
                className="projects-form-input border-none pr-8"
                style={{ borderColor: "var(--border)" }}
                onFocus={(e) => {
                  e.target.style.borderColor = "hsl(var(--primary))";
                  e.target.style.boxShadow = `0 0 0 3px hsl(var(--primary) / 0.2)`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--border)";
                  e.target.style.boxShadow = "none";
                }}
              />

              <button
                type="button"
                onClick={() => setShowApiKey((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500 hover:text-[hsl(var(--primary))] transition-colors"
                tabIndex={-1}
              >
                {showApiKey ? <HiEyeSlash className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Model */}
          <div className="space-y-1">
            <Label
              htmlFor="model"
              className="projects-form-label text-sm"
              style={{ fontSize: "14px" }}
            >
              <HiCog
                className="projects-form-label-icon"
                style={{ color: "hsl(var(--primary))" }}
              />
              Model <span className="projects-form-label-required">*</span>
            </Label>
            <Input
              id="model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g., deepseek/deepseek-chat-v3-0324:free"
              disabled={isLoading || isSaving}
              className="projects-form-input border-none"
              style={{ borderColor: "var(--border)" }}
              onFocus={(e) => {
                e.target.style.borderColor = "hsl(var(--primary))";
                e.target.style.boxShadow = `0 0 0 3px hsl(var(--primary) / 0.2)`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--border)";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          {/* API URL */}
          <div className="space-y-1">
            <Label
              htmlFor="api-url"
              className="projects-form-label text-sm"
              style={{ fontSize: "14px" }}
            >
              <span className="projects-form-label-icon flex items-center justify-center stroke-[var(--primary)]">
                <HiLink
                  style={{
                    color: "hsl(var(--primary))",
                    width: "1.25em",
                    height: "1.25em",
                  }}
                />
              </span>
              API URL <span className="projects-form-label-required">*</span>
            </Label>
            <Input
              id="api-url"
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://api.provider.com/v1"
              disabled={isLoading || isSaving}
              className="projects-form-input border-none"
              style={{ borderColor: "var(--border)" }}
              onFocus={(e) => {
                e.target.style.borderColor = "hsl(var(--primary))";
                e.target.style.boxShadow = `0 0 0 3px hsl(var(--primary) / 0.2)`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--border)";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>
          <div className="projects-form-field">
            <div className="flex  items-center justify-between p-4 bg-[var(--mini-sidebar)] rounded-lg ">
              <div>
                <Label
                  className="projects-form-label border-none text-sm"
                  style={{ fontSize: "14px" }}
                >
                  <HiSparkles
                    className="projects-form-label-icon"
                    style={{ color: "hsl(var(--primary))" }}
                  />
                  Enable AI Chat
                </Label>
                <p className="projects-url-preview-label text-[13px] mt-1 ml-6">
                  Fill all the fields to enable chat.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => {
                    const newValue = e.target.checked;
                    setIsEnabled(newValue);
                  }}
                  disabled={
                    isLoading || isSaving || !apiKey.trim() || !model.trim() || !apiUrl.trim()
                  }
                  className="sr-only peer"
                />
                <div
                  className="w-11 h-6 rounded-full peer-focus:outline-none peer relative
                    bg-[var(--status-inactive-bg)] peer-checked:bg-[var(--primary)]
                    peer peer-checked:after:translate-x-5 peer-checked:after:border-white
                    after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--background)] after:rounded-full after:h-5 after:w-5 after:transition-all"
                ></div>
              </label>
            </div>
          </div>

          {/* Setup Guide & Providers - Always visible */}

          <div className="mt-4 p-3 bg-[var(--border)] rounded-lg">
            <h3 className="projects-url-preview-label mb-2 text-[14px]">Popular AI Providers:</h3>
            <ul
              className="text-xs space-y-1 text-[var(--accent-foreground)]"
              style={{ fontSize: "13px" }}
            >
              <li>
                • <strong>OpenRouter:</strong> https://openrouter.ai/api/v1 (100+ models, free
                options available)
              </li>
              <li>
                • <strong>OpenAI:</strong> https://api.openai.com/v1 (GPT models)
              </li>
              <li>
                • <strong>Anthropic:</strong> https://api.anthropic.com/v1 (Claude models)
              </li>
              <li>
                • <strong>Google:</strong> https://generativelanguage.googleapis.com/v1beta (Gemini
                models)
              </li>
            </ul>
            <p className="text-xs" style={{ fontSize: "13px" }}>
              • API keys are encrypted and stored securely • Test connection after changes • The URL
              determines which provider is used
            </p>
          </div>

          {/* Action Buttons */}
          <div className="projects-form-actions flex gap-2 justify-end mt-6">
            <ActionButton
              type="button"
              secondary
              onClick={handleClose}
              disabled={isLoading || isSaving}
            >
              Cancel
            </ActionButton>

            <ActionButton
              type="button"
              onClick={testConnection}
              disabled={!isEnabled || isLoading || isSaving || !isFormValid}
              variant="outline"
              secondary
            >
              {isLoading ? "Testing..." : "Test Connection"}
            </ActionButton>

            <ActionButton
              type="button"
              primary
              onClick={handleSave}
              disabled={isSaving || !isFormValid}
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Saving...
                </div>
              ) : (
                "Save Settings"
              )}
            </ActionButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
