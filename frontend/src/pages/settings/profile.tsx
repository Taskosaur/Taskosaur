"use client";
import { useAuth } from "@/contexts/auth-context";
import { HiCog6Tooth, HiSparkles } from "react-icons/hi2";
import ProfileSection from "@/components/settings/ProfileSection";
import LanguageSection from "@/components/settings/LanguageSection";
import ResetPasswordSection from "@/components/settings/ResetPasswordSection";
import DangerZoneSection from "@/components/settings/DangerZoneSection";
import AISettingsModal from "@/components/settings/AISettings";
import { useState } from "react";
import ActionButton from "@/components/common/ActionButton";
import { PageHeader } from "@/components/common/PageHeader";
import { SEO } from "@/components/common/SEO";
import { useTranslation } from "react-i18next";

export default function ProfilePage() {
  const { t } = useTranslation("settings");
  const { getCurrentUser } = useAuth();
  const currentUser = getCurrentUser();
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  if (!currentUser) {
    return (
      <div className="dashboard-container">
        <div className="space-y-6">
          <div className="bg-[var(--card)] rounded-[var(--card-radius)] border border-[var(--border)] p-8 text-center">
            <div className="w-10 h-10 rounded-md bg-[var(--primary)]/10 flex items-center justify-center mx-auto mb-4">
              <HiCog6Tooth className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              {t("profile_page.auth_required_title")}
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
              {t("profile_page.auth_required_desc")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO title={t("profile_page.title")} />
      <div className="dashboard-container">
      <div>
        {/* Header */}
        <PageHeader
          icon={<HiCog6Tooth className="w-5 h-5 text-[var(--primary)]" />}
          title={t("profile_page.title")}
          description={t("profile_page.description")}
          actions={
            <ActionButton
              secondary
              leftIcon={<HiSparkles />}
              onClick={() => setIsAIModalOpen(true)}
            >
              {t("profile_page.ai_settings")}
            </ActionButton>
          }
        />

        {/* Settings Sections */}
        <div className="space-y-4">
          <ProfileSection />
          <LanguageSection />
          <ResetPasswordSection />
          <DangerZoneSection />
        </div>

        {/* AI Settings Modal */}
        <AISettingsModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} />
      </div>
    </div>
    </>
  );
}
