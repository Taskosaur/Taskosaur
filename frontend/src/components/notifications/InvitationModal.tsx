import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { invitationApi } from "@/utils/api/invitationsApi";
import { Invitation } from "@/types";

interface InvitationModalProps {
  userId: string;
  isOpen: boolean;
  onAccept: () => void;
}

export function InvitationModal({ userId, isOpen, onAccept }: InvitationModalProps) {
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([]);
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvitations = async () => {
      if (!userId) return;

      try {
        setLoading(true);
        const invitations = await invitationApi.getUserInvitations({
          status: "PENDING",
        });
        setPendingInvites(invitations);
      } catch (error) {
        console.error("Failed to fetch invitations:", error);
        setPendingInvites([]);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchInvitations();
    }
  }, [userId, isOpen]);

  const formatInviteDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getEntityName = (invite: Invitation) => {
    if (invite.organization) return invite.organization.name;
    if (invite.workspace) return invite.workspace.name;
    if (invite.project) return invite.project.name;
    return "Unknown";
  };

  const getEntityType = (invite: Invitation) => {
    if (invite.organizationId) return "Organization";
    if (invite.workspaceId) return "Workspace";
    if (invite.projectId) return "Project";
    return "Entity";
  };

  const getEntityInitial = (invite: Invitation) => {
    return getEntityType(invite).charAt(0);
  };

  const handleInviteAction = async (token: string, action: "accept" | "decline") => {
    try {
      setProcessingInvite(token);
      if (action === "accept") {
        await invitationApi.acceptInvitation(token);
        window.location.href = "/dashboard";
      } else {
        await invitationApi.declineInvitation(token);
        setPendingInvites(prev => prev.filter(invite => invite.token !== token));
      }
    } catch (error) {
      console.error(`Failed to ${action} invitation:`, error);
    } finally {
      setProcessingInvite(null);
    }
  };

  useEffect(() => {
    if (isOpen && pendingInvites.length === 0 && !loading) {
      onAccept();
    }
  }, [pendingInvites, loading, isOpen, onAccept]);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md border-[var(--border)]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-center">
            Pending Invitations
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-center py-4">Loading invitations...</div>
          ) : pendingInvites.length === 0 ? (
            <div className="text-center py-4">
              No pending invitations found.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="border-[var(--border)] rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-800 font-medium">
                        {getEntityInitial(invite)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">
                        {getEntityName(invite)}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Role: {invite.role}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button
                        className="bg-red-500"
                          size="sm"
                          onClick={() => handleInviteAction(invite.token, "decline")}
                          disabled={processingInvite === invite.token}
                        >
                          {processingInvite === invite.token ? "Processing..." : "Decline"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[var(--border)]"
                          onClick={() => handleInviteAction(invite.token, "accept")}
                          disabled={processingInvite === invite.token}
                        >
                          {processingInvite === invite.token ? "Processing..." : "Accept"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}