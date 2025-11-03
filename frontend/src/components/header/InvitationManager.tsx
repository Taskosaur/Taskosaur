import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Tooltip from "../common/ToolTip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { TbMailPlus } from "react-icons/tb";
import { invitationApi } from "@/utils/api/invitationsApi";
import ActionButton from "../common/ActionButton";
import { toast } from "sonner";
interface Invitation {
  id: string;
  token: string;
  role: string;
  email: string;
  expiresAt: string;
  organizationId?: string;
  workspaceId?: string;
  projectId?: string;
  organization?: { name: string };
  workspace?: { name: string };
  project?: { name: string };
}

interface InvitationManagerProps {
  userId?: string;
  className?: string;
}

export default function InvitationManager({ userId, className = "" }: InvitationManagerProps) {
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([]);
  const [inviteModal, setInviteModal] = useState<null | {
    token: string;
    data: Invitation;
  }>(null);
  const [processingInvite, setProcessingInvite] = useState(false);
  const [loading, setLoading] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  // Fetch pending invitations
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

    fetchInvitations();
  }, [userId]);

  // Handle invitation token from URL params or localStorage
  useEffect(() => {
    const tokenFromParam = searchParams.get("token");
    const tokenFromLS =
      typeof window !== "undefined" ? localStorage.getItem("pendingInvitation") : null;
    const token = tokenFromParam || tokenFromLS;

    if (!token) return;

    const verifyInvitation = async () => {
      try {
        const res = await invitationApi.verifyInvitation(token);
        if (res.isValid) {
          setInviteModal({ token, data: res.invitation });
        } else {
          localStorage.removeItem("pendingInvitation");
        }
      } catch {
        localStorage.removeItem("pendingInvitation");
      }
    };

    verifyInvitation();
  }, [searchParams]);

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
      setProcessingInvite(true);
      if (action === "accept") {
        await invitationApi.acceptInvitation(token);
      } else {
        await invitationApi.declineInvitation(token);
      }

      setPendingInvites((prev) => prev.filter((i) => i.token !== token));
      setInviteModal(null);
      localStorage.removeItem("pendingInvitation");

      // Optionally trigger a page refresh or navigation
      if (action === "accept") {
        router.refresh();
      }
    } catch (error) {
      toast.error(error?.message || "Failed to accept the invitation");
      console.error(`Failed to ${action} invitation:`, error);
    } finally {
      setProcessingInvite(false);
    }
  };

  if (!userId) return null;

  return (
    <>
      <DropdownMenu>
        <Tooltip content="Invitations" position="bottom" color="primary">
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={`header-button-base ${className}`}>
              <TbMailPlus className="header-button-icon" />
              {pendingInvites.length > 0 && (
                <Badge
                  variant="secondary"
                  className="header-notification-badge header-notification-badge-green"
                >
                  {pendingInvites.length > 99 ? "99+" : pendingInvites.length}
                </Badge>
              )}
              <span className="hidden max-[530px]:inline-block text-sm font-medium">
                Invitations
              </span>
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent className="header-dropdown-menu-content" align="end" sideOffset={4}>
          <div className="header-dropdown-menu-header">
            <div className="header-dropdown-menu-title">
              <span className="header-dropdown-menu-title-text">Invitations</span>
              <Badge variant="secondary" className="header-dropdown-menu-badge">
                {pendingInvites.length}
              </Badge>
            </div>
          </div>

          <div className="header-dropdown-menu-body">
            {loading ? (
              <div className="header-loading-container">
                <div className="header-loading-list">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="header-loading-item">
                      <div className="header-loading-item-layout">
                        <div className="header-loading-avatar"></div>
                        <div className="header-loading-content">
                          <div className="header-loading-text-primary"></div>
                          <div className="header-loading-text-secondary"></div>
                          <div className="header-loading-buttons">
                            <div className="header-loading-button"></div>
                            <div className="header-loading-button"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : pendingInvites.length === 0 ? (
              <div className="header-empty-state">
                <TbMailPlus className="header-empty-icon" />
                <p className="header-empty-text">No pending invitations</p>
              </div>
            ) : (
              <div className="header-invitations-item-container">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="header-invitations-item">
                    <div className="header-invitations-item-layout">
                      <div className="header-invitations-item-avatar">
                        <span className="header-invitations-item-avatar-text">
                          {getEntityInitial(invite)}
                        </span>
                      </div>
                      <div className="header-invitations-item-content">
                        <div className="header-invitations-item-title">{getEntityName(invite)}</div>
                        <div className="header-invitations-item-meta">
                          <span className="header-invitations-item-meta-emphasis">
                            {getEntityType(invite)}
                          </span>{" "}
                          • Role:{" "}
                          <span className="header-invitations-item-meta-emphasis">
                            {invite.role}
                          </span>{" "}
                          • Expires: {formatInviteDate(invite.expiresAt)}
                        </div>
                        <div className="header-invitations-item-actions">
                          <ActionButton
                            secondary
                            className="w-26"
                            onClick={() => handleInviteAction(invite.token, "decline")}
                            disabled={processingInvite}
                          >
                            Decline
                          </ActionButton>
                          <ActionButton
                            primary
                            className="w-26"
                            onClick={() => handleInviteAction(invite.token, "accept")}
                            disabled={processingInvite}
                          >
                            Accept
                          </ActionButton>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Invitation Modal */}
      {inviteModal && (
        <Dialog open onOpenChange={() => setInviteModal(null)}>
          <DialogContent className="header-invitation-modal-content-wrapper">
            <DialogHeader>
              <DialogTitle className="header-invitation-modal-title">
                Invitation to {getEntityName(inviteModal.data)}
              </DialogTitle>
            </DialogHeader>

            <div className="header-invitation-modal-content">
              <div className="header-invitation-modal-center">
                <div className="header-invitation-modal-avatar">
                  <span className="header-invitation-modal-avatar-text">
                    {getEntityInitial(inviteModal.data)}
                  </span>
                </div>
                <h3 className="header-invitation-modal-entity-name">
                  {getEntityName(inviteModal.data)}
                </h3>
                <p className="header-invitation-modal-entity-meta">
                  {getEntityType(inviteModal.data)} • Role: {inviteModal.data.role}
                </p>
              </div>

              <div className="header-invitation-modal-details">
                <div className="header-invitation-modal-details-list">
                  <div className="header-invitation-modal-details-item">
                    <span className="header-invitation-modal-details-label">Email:</span>
                    <span className="header-invitation-modal-details-value">
                      {inviteModal.data.email}
                    </span>
                  </div>
                  <div className="header-invitation-modal-details-item">
                    <span className="header-invitation-modal-details-label">Expires:</span>
                    <span className="header-invitation-modal-details-value">
                      {formatInviteDate(inviteModal.data.expiresAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="header-invitation-modal-actions">
              <Button
                variant="outline"
                disabled={processingInvite}
                onClick={() => handleInviteAction(inviteModal.token, "decline")}
                className="header-invitation-modal-button-decline"
              >
                Decline
              </Button>
              <Button
                disabled={processingInvite}
                onClick={() => handleInviteAction(inviteModal.token, "accept")}
                className="header-invitation-modal-button-accept"
              >
                {processingInvite ? "Processing..." : "Accept"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
