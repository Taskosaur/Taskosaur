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
import { useTranslation } from "react-i18next";

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AISettingsModal({ isOpen, onClose }: AISettingsModalProps) {
  const { t } = useTranslation("settings");
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
      setMessage({ type: "error", text: t("ai_section.load_failed") });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      // Use bulk save to make a single API call instead of 4 separate calls
      await settingsApi.bulkSetSettings([
        {
          key: "ai_enabled",
          value: isEnabled.toString(),
          description: "Enable/disable AI chat functionality",
          category: "ai",
          isEncrypted: false,
        },
        {
          key: "ai_api_key",
          value: apiKey,
          description: "AI provider API key",
          category: "ai",
          isEncrypted: true,
        },
        {
          key: "ai_model",
          value: model,
          description: "AI model to use",
          category: "ai",
          isEncrypted: false,
        },
        {
          key: "ai_api_url",
          value: apiUrl,
          description: "API endpoint URL",
          category: "ai",
          isEncrypted: false,
        },
      ]);

      localStorage.setItem("aiEnabled", isEnabled.toString());
      window.dispatchEvent(
        new CustomEvent("aiSettingsChanged", {
          detail: { aiEnabled: isEnabled },
        })
      );

      setMessage({ type: "success", text: t("ai_section.save_success") });
      toast.success(t("ai_section.save_success"));
    } catch (error) {
      console.error("Failed to save settings:", error);
      setMessage({ type: "error", text: t("ai_section.save_failed") });
      toast.error(t("ai_section.save_failed"));
    } finally {
      setIsSaving(false);
    }
  };

  // Check if URL is localhost or private network (Ollama)
  const isLocalOrPrivateUrl = (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      // Check for localhost
      if (["localhost", "127.0.0.1", "::1"].includes(hostname)) return true;
      // Check for private IPv4 ranges
      const privateIPv4Pattern =
        /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/;
      return privateIPv4Pattern.test(hostname);
    } catch {
      return false;
    }
  };

  const testConnection = async () => {
    // API key is optional for localhost/private network (Ollama)
    const isLocalNetwork = isLocalOrPrivateUrl(apiUrl);
    if (!apiKey && !isLocalNetwork) {
      setMessage({ type: "error", text: t("ai_section.enter_api_key") });
      return;
    }

    if (!model) {
      setMessage({ type: "error", text: t("ai_section.enter_model") });
      return;
    }

    if (!apiUrl) {
      setMessage({ type: "error", text: t("ai_section.enter_url") });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      // Use the new test-connection endpoint that doesn't require AI to be enabled
      const response = await api.post("/ai-chat/test-connection", {
        apiKey,
        model,
        apiUrl,
      });

      if (response.data.success) {
        setMessage({
          type: "success",
          text: response.data.message || t("ai_section.test_success"),
        });
        toast.success(response.data.message || t("ai_section.test_success"));
      } else {
        const errorMsg = response.data.error || t("ai_section.test_failed");
        setMessage({
          type: "error",
          text: errorMsg,
        });
        toast.error(errorMsg);
      }
    } catch (error: any) {
      console.error("Connection test failed:", error);
      const errorMessage =
        error.response?.data?.error || error.message || t("ai_section.test_failed");
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

  // Form is valid if model and URL are set, and either API key is set or it's a local/private URL
  const isFormValid = isEnabled
    ? (apiKey.trim().length > 0 || isLocalOrPrivateUrl(apiUrl)) &&
      model.trim().length > 0 &&
      apiUrl.trim().length > 0
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
              <DialogTitle className="projects-modal-title">
                {t("ai_section.title")}
              </DialogTitle>
              <p className="projects-modal-description">{t("ai_section.description")}</p>
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
              {t("ai_section.api_key")}{" "}
              {!isLocalOrPrivateUrl(apiUrl) && (
                <span className="projects-form-label-required">*</span>
              )}
              {isLocalOrPrivateUrl(apiUrl) && (
                <span className="text-xs text-muted-foreground">
                  {t("ai_section.optional_ollama")}
                </span>
              )}
            </Label>

            <div className="relative">
              <Input
                id="api-key"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t("ai_section.api_key_placeholder")}
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
              {t("ai_section.model")}{" "}
              <span className="projects-form-label-required">*</span>
            </Label>
            <Input
              id="model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={t("ai_section.model_placeholder")}
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
              {t("ai_section.api_url")}{" "}
              <span className="projects-form-label-required">*</span>
            </Label>
            <Input
              id="api-url"
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder={t("ai_section.api_url_placeholder")}
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
                  {t("ai_section.enable_chat")}
                </Label>
                <p className="projects-url-preview-label text-[13px] mt-1 ml-6">
                  {t("ai_section.enable_chat_desc")}
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
                    isLoading ||
                    isSaving ||
                    (!apiKey.trim() && !isLocalOrPrivateUrl(apiUrl)) ||
                    !model.trim() ||
                    !apiUrl.trim()
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
            <h3 className="projects-url-preview-label mb-2 text-[14px]">
              {t("ai_section.popular_providers")}
            </h3>
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
              <li>
                • <strong>Ollama (Self-hosted):</strong> http://localhost:11434 (Local models like
                llama3, mistral, codellama)
              </li>
            </ul>
            <p className="text-xs" style={{ fontSize: "13px" }}>
              {t("ai_section.footer_info")}
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
              {t("common.cancel")}
            </ActionButton>

            <ActionButton
              type="button"
              onClick={testConnection}
              disabled={
                isLoading ||
                isSaving ||
                (!apiKey.trim() && !isLocalOrPrivateUrl(apiUrl)) ||
                !model.trim() ||
                !apiUrl.trim()
              }
              variant="outline"
              secondary
            >
              {isLoading ? t("ai_section.testing") : t("ai_section.test_connection")}
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
                  {t("ai_section.saving")}
                </div>
              ) : (
                t("ai_section.save_settings")
              )}
            </ActionButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
