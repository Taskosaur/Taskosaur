"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HiExclamationTriangle } from "react-icons/hi2";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/router";
import { toast } from "sonner";

export default function DeleteAccountSection() {
  const { getCurrentUser, deleteUser } = useAuth();
  const currentUser = getCurrentUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!currentUser) return;
    if (!confirm("Are you sure you want to delete your account? This cannot be undone.")) return;
    setLoading(true);
    try {
      await deleteUser(currentUser.id);
      toast.success("Account deleted successfully!");
      router.push("/login");
    } catch {
      toast.error("Error deleting account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="rounded-md bg-red-50 shadow-sm border border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg font-semibold text-red-700">
          <HiExclamationTriangle className="w-5 h-5" /> Delete Account
        </CardTitle>
        <CardDescription className="text-red-500">
          Permanently delete your account and all associated data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={handleDelete} disabled={loading}>
          {loading ? "Deleting..." : "Delete Account"}
        </Button>
      </CardContent>
    </Card>
  );
}
