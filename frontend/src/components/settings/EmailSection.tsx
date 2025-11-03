"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import ActionButton from "@/components/common/ActionButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { HiEnvelope } from "react-icons/hi2";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

export default function EmailSection() {
  const { getCurrentUser, updateUserEmail } = useAuth();
  const currentUser = getCurrentUser();

  const fetchingRef = useRef(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (currentUser) setEmail(currentUser.email || "");
  }, [currentUser]);

  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = useCallback(async () => {
    if (!currentUser || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      await updateUserEmail(currentUser.id, { email });
      toast.success("Email updated successfully!");
    } catch {
      toast.error("Failed to update email. Please try again.");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [currentUser, email, updateUserEmail]);

  return (
    <Card className="border-none bg-[var(--card)]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-lg font-medium text-[var(--foreground)]">
              <HiEnvelope className="w-5 h-5 text-[var(--primary)]" />
              Email Address
            </CardTitle>
            <CardDescription className="text-sm text-[var(--muted-foreground)] mt-1">
              Update your email address. This will be used for login and notifications.
            </CardDescription>
          </div>
          <Badge
            variant="secondary"
            className="text-xs bg-[var(--primary)]/10 text-[var(--primary)] border-none"
          >
            Secure
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-sm font-medium text-[var(--foreground)]">
              Email Address <span className="text-red-500">*</span>
            </Label>
            <div className="max-w-md">
              <Input
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                className="h-8 border-none bg-[var(--background)]"
                placeholder="Enter your email address"
                required
              />
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                We'll send a verification email if the address is changed.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <ActionButton
              onClick={handleEmailSubmit}
              disabled={loading || !email.trim()}
              primary
              className="h-8 px-3 text-sm bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] border-none"
            >
              {loading ? (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Updating...
                </div>
              ) : (
                "Update Email"
              )}
            </ActionButton>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
