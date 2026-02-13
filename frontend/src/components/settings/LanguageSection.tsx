"use client";
import { useTranslation } from "react-i18next";
import { HiGlobeAlt } from "react-icons/hi2";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function LanguageSection() {
  const { t, i18n } = useTranslation("settings");

  const changeLanguage = (value: string) => {
    i18n.changeLanguage(value);
  };

  const languages = [
    { code: "en", name: "English" },
    { code: "es", name: "Español" },
  ];

  return (
    <div className="bg-[var(--card)] rounded-[var(--card-radius)] border border-[var(--border)] p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-md bg-[var(--primary)]/10 flex items-center justify-center">
          <HiGlobeAlt className="w-5 h-5 text-[var(--primary)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {t("language_section.title")}
          </h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("language_section.description")}
          </p>
        </div>
      </div>

      <div className="max-w-md space-y-4">
        <div className="space-y-2">
          <Label htmlFor="language-select">{t("language_section.display_language")}</Label>
          <Select value={i18n.language} onValueChange={changeLanguage}>
            <SelectTrigger id="language-select" className="w-full">
              <SelectValue placeholder={t("language_section.select_placeholder")} />
            </SelectTrigger>
            <SelectContent className="bg-[var(--popover)] border-[var(--border)]">
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
