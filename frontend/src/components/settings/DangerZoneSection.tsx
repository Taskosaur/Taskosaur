import { useState, useRef, useCallback } from "react";
import { CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HiExclamationTriangle } from "react-icons/hi2";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/router";
import { toast } from "sonner";
import ConfirmationModal from "../modals/ConfirmationModal";

export default function DangerZoneSection() {
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
      toast.success("Account deleted successfully!");
      router.push("/login");
    } catch {
      toast.error("Failed to delete account. Please try again.");
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
      fetchingRef.current = false;
    }
  }, [currentUser, deleteUser, router]);

  return (
    <>
      <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4">
        <div className="p-4">
          <div className="mb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-red-700">
              <HiExclamationTriangle className="w-4 h-4" /> Delete Account
            </CardTitle>
            <CardDescription className="text-xs text-red-500">
              Permanently delete the account and all associated data.
            </CardDescription>
          </div>
          <CardContent className="p-0">
            <ul className="list-disc pl-4 text-xs text-red-600 space-y-0.5">
              <li>All tasks and projects will be permanently deleted</li>
              <li>Profile and settings will be removed</li>
              <li>Immediate sign out</li>
            </ul>
          </CardContent>
          <CardFooter className="mt-4 p-0">
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
              className="rounded bg-red-500 hover:bg-red-600 text-white text-sm shadow-sm transition-all duration-200 border-none px-3 py-1.5"
            >
              {loading ? "Processing..." : "Delete Account"}
            </Button>
          </CardFooter>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmationModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteAccount}
          title="Confirm Deletion"
          message="This action is permanent and cannot be undone. All data will be lost."
          confirmText="Delete Forever"
          cancelText="Cancel"
          type="danger"
        />
      )}
    </>
  );
}
