import { useState } from "react";
import ActionButton from "../common/ActionButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { invitationApi } from "@/utils/api/invitationsApi";
import { HiMail } from "react-icons/hi";
import { Input, Label, Select } from "../ui";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

export const ProjectInviteMemberModal = ({
  isOpen,
  onClose,
  onInvite,
  availableRoles,
}: {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: string) => void;
  availableRoles: Array<{ id: string; name: string; description: string }>;
}) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [inviting, setInviting] = useState(false);

  // Add email validation display
  const isEmailValid = email ? invitationApi.validateEmail(email) : true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !isEmailValid || !role) return;

    setInviting(true);
    try {
      await onInvite(email.trim(), role);
      setEmail("");
      setRole("");
      onClose();
    } catch (error) {
      console.error("Failed to send invitation:", error);
    } finally {
      setInviting(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setRole("");
    onClose();
  };

  return (
    <div automation-id="invite-modal">
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-[var(--card)] border-none rounded-[var(--card-radius)] shadow-lg max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--foreground)] flex items-center gap-2">
              <HiMail className="w-5 h-5 text-[var(--primary)]" />
              Invite Member to Project
            </DialogTitle>
            <DialogDescription className="text-[var(--muted-foreground)]">
              Send an invitation to join this project.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label
                htmlFor="invite-email"
                className="text-sm font-medium text-[var(--foreground)]"
              >
                Email Address
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                className="mt-1 border-none bg-background text-[var(--foreground)]"
                required
              />
              {email && !isEmailValid && (
                <p className="text-xs text-[var(--destructive)] mt-1">
                  Please enter a valid email address
                </p>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium text-[var(--foreground)]">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger
                  className="projects-workspace-button border-none mt-1"
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <SelectValue placeholder="Select a role">
                    {role && <span className="text-[var(--foreground)]">{role}</span>}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="border-none bg-[var(--card)]">
                  {availableRoles.map((r) => (
                    <SelectItem key={r.id} value={r.name} className="hover:bg-[var(--hover-bg)]">
                      <div className="flex flex-col items-start py-1">
                        <span className="font-medium text-[var(--foreground)]">{r.name}</span>
                        <span className="text-xs text-[var(--muted-foreground)] mt-0.5">
                          {r.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!role && (
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Please select a role for the member
                </p>
              )}
            </div>{" "}
            <DialogFooter className="flex justify-end gap-3">
              <ActionButton
                secondary
                type="button"
                onClick={handleClose}
                disabled={inviting}
                className="w-20"
              >
                Cancel
              </ActionButton>
              <ActionButton
                primary
                type="submit"
                disabled={inviting || !email.trim() || !isEmailValid || !role}
                className="w-28"
              >
                {inviting ? "Inviting..." : "Send Invite"}
              </ActionButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
