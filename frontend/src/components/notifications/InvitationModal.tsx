import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { invitationApi } from "@/utils/api/invitationsApi";
import { Invitation } from "@/types";
import ActionButton from "../common/ActionButton";

interface InvitationModalProps {
  userId: string;
  isOpen: boolean;
  onAccept: () => void;
}

export function InvitationModal({ userId, isOpen, onAccept }: InvitationModalProps) {
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([]);
  const [processingInvite, setProcessingInvite] = useState<{
    token: string;
    action: "accept" | "decline";
  } | null>(null);
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
      setProcessingInvite({ token, action });

      const [result] = await Promise.all([
        action === "accept"
          ? invitationApi.acceptInvitation(token)
          : invitationApi.declineInvitation(token),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);

      if (action === "accept") {
        window.location.href = "/dashboard";
      } else {
        setPendingInvites((prev) => prev.filter((invite) => invite.token !== token));
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
      <DialogContent className="max-w-md border-none" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-center">Pending Invitations</DialogTitle>
        </DialogHeader>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-center py-4">Loading invitations...</div>
          ) : pendingInvites.length === 0 ? (
            <div className="text-center py-4">No pending invitations found.</div>
          ) : (
            <div className="space-y-4">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className=" rounded-md p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-800 font-medium">{getEntityInitial(invite)}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{getEntityName(invite)}</h4>
                      <p className="text-sm text-muted-foreground">Role: {invite.role}</p>
                      <div className="flex gap-2 mt-3">
                        <ActionButton
                          className="bg-red-500 w-[98.3px] h-[45px]"
                          secondary
                          onClick={() => handleInviteAction(invite.token, "decline")}
                          disabled={processingInvite?.token === invite.token}
                        >
                          {processingInvite?.token === invite.token &&
                          processingInvite?.action === "decline" ? (
                            <div className="flex items-center justify-center gap-2">
                              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                            </div>
                          ) : (
                            "Decline"
                          )}
                        </ActionButton>
                        <ActionButton
                          className="w-[98.3px] h-[45px]"
                          primary
                          onClick={() => handleInviteAction(invite.token, "accept")}
                          disabled={processingInvite?.token === invite.token}
                        >
                          {processingInvite?.token === invite.token &&
                          processingInvite?.action === "accept" ? (
                            <div className="flex items-center justify-center gap-2">
                              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                            </div>
                          ) : (
                            "Accept"
                          )}
                        </ActionButton>
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
