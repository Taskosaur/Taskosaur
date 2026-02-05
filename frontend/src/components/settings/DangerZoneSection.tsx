import { useState, useRef, useCallback } from "react";
import { CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HiExclamationTriangle } from "react-icons/hi2";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/router";
import { toast } from "sonner";
import ConfirmationModal from "../modals/ConfirmationModal";
import { useTranslation } from "react-i18next";

export default function DangerZoneSection() {
  const { t } = useTranslation("settings");
  const { getCurrentUser, deleteUser } = useAuth();
  const currentUser = getCurrentUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fetchingRef = useRef(false);

  const handleDeleteAccount = useCallback(async () => {
    if (!currentUser || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      await deleteUser(currentUser.id);
      toast.success(t("danger_zone_section.delete_success"));
      router.push("/login");
    } catch {
      toast.error(t("danger_zone_section.delete_failed"));
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
      fetchingRef.current = false;
    }
  }, [currentUser, deleteUser, router, t]);

  return (
    <>
      <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4">
        <div className="p-4">
          <div className="mb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-red-700">
              <HiExclamationTriangle className="w-4 h-4" /> {t("danger_zone_section.title")}
            </CardTitle>
            <CardDescription className="text-xs text-red-500">
              {t("danger_zone_section.description")}
            </CardDescription>
          </div>
          <CardContent className="p-0">
            <ul className="list-disc pl-4 text-xs text-red-600 space-y-0.5">
              <li>{t("danger_zone_section.item_tasks")}</li>
              <li>{t("danger_zone_section.item_profile")}</li>
              <li>{t("danger_zone_section.item_signout")}</li>
            </ul>
          </CardContent>
          <CardFooter className="mt-4 p-0">
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
              className="rounded bg-red-500 hover:bg-red-600 text-white text-sm shadow-sm transition-all duration-200 border-none px-3 py-1.5"
            >
              {loading
                ? t("danger_zone_section.processing")
                : t("danger_zone_section.delete_button")}
            </Button>
          </CardFooter>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmationModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteAccount}
          title={t("danger_zone_section.confirm_title")}
          message={t("danger_zone_section.confirm_message")}
          confirmText={t("danger_zone_section.confirm_delete")}
          cancelText={t("common.cancel")}
          type="danger"
        />
      )}
    </>
  );
}
