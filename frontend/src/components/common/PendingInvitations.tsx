import { useEffect, useState, useImperativeHandle, forwardRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Button } from "@/components/ui";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import { HiEnvelope, HiArrowPath } from "react-icons/hi2";
import { BsThreeDotsVertical } from "react-icons/bs";
import { useOrganization } from "@/contexts/organization-context";
import { invitationApi } from "@/utils/api/invitationsApi";
import { toast } from "sonner";
import { RxReset } from "react-icons/rx";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import Tooltip from "./ToolTip";

interface Invitation {
  id: string;
  inviteeEmail: string;
  inviter?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  role?: string;
  status: "PENDING" | "DECLINED" | string;
  createdAt?: string;
  expiresAt?: string;
}

interface Entity {
  id: string;
  name: string;
  slug?: string;
  description?: string;
}

type EntityType = "organization" | "workspace" | "project";

interface PendingInvitationsProps {
  entity: Entity | null;
  entityType: EntityType;
  members: any[];
}

export interface PendingInvitationsRef {
  refreshInvitations: () => Promise<void>;
}

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case "ACTIVE":
      return "organizations-status-badge-active";
    case "PENDING":
      return "organizations-status-badge-pending";
    case "DECLINED":
      return "organizations-status-badge-declined";
    case "EXPIRED":
      return "organizations-status-badge-suspended"; // ADD THIS
    case "INACTIVE":
      return "organizations-status-badge-inactive";
    case "SUSPENDED":
      return "organizations-status-badge-suspended";
    default:
      return "organizations-status-badge-inactive";
  }
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const PendingInvitations = forwardRef<PendingInvitationsRef, PendingInvitationsProps>(
  ({ entity, entityType, members }, ref) => {
    const { showPendingInvitations } = useOrganization();
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [loading, setLoading] = useState(false);
    const [resendingId, setResendingId] = useState<string | null>(null);

    const fetchInvites = async () => {
      if (!entity?.id) return;

      try {
        const data = await showPendingInvitations(entityType, entity.id);
        setInvitations(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching invitations:", err);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchInvites();
    }, [entity, entityType]);

    // Expose refresh method to parent component
    useImperativeHandle(ref, () => ({
      refreshInvitations: fetchInvites,
    }));

    const handleResendInvite = async (inviteId: string) => {
      try {
        setResendingId(inviteId);
        const result = await invitationApi.resendInvitation(inviteId);

        if (result.emailSent) {
          toast.success("Invitation resent successfully - email sent");
        } else {
          toast.warning(
            "Invitation updated but email failed to send. The invitee can still use the updated invitation link."
          );
          console.warn("Email delivery failed:", result.emailError);
        }

        await fetchInvites(); // Refresh the list
      } catch (error: any) {
        const errorMessage = error?.message || "Failed to resend invitation";
        toast.error(errorMessage);
      } finally {
        setResendingId(null);
      }
    };

    const handleDeleteInvite = async (inviteId: string) => {
      try {
        await invitationApi.deleteInvitation(inviteId);
        toast.success("Invitation deleted successfully");
        await fetchInvites();
      } catch (error: any) {
        toast.error(error?.message || "Failed to delete invitation");
      }
    };

    const pendingInvites = invitations.filter((i) => i.status === "PENDING");
    const expiredInvites = invitations.filter((i) => i.status === "EXPIRED"); // ADD THIS
    const declinedInvites = invitations.filter((i) => i.status === "DECLINED");
    const allInvites = [...pendingInvites, ...expiredInvites, ...declinedInvites];
    const totalInvites = allInvites.length;

    return (
      <Card className="bg-[var(--card)]  border-none shadow-sm  gap-0 space-y-0 h-[270px] flex flex-col">
        <CardHeader className="px-4 py-0 flex-shrink-0">
          <CardTitle className="text-md font-semibold text-[var(--foreground)] flex items-center gap-2">
            <HiEnvelope className="w-5 h-5 text-[var(--muted-foreground)]" />
            Invitations
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0 overflow-y-auto flex-1">
          {loading ? (
            <div className="p-6 text-sm text-center text-[var(--muted-foreground)]">
              Loading invitations...
            </div>
          ) : totalInvites === 0 ? (
            <div className="p-4 text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--muted)] flex items-center justify-center">
                <HiEnvelope className="w-6 h-6 text-[var(--muted-foreground)]" />
              </div>
              <h3 className="text-sm font-medium text-[var(--foreground)] mb-1">
                No pending or declined invitations
              </h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                Invitations to this {entityType} will appear here until they’re accepted or
                declined.
              </p>
            </div>
          ) : (
            <>
              <div className="">
                {allInvites.map((invite) => (
                  <div key={invite.id} className="px-4 py-3 transition-colors">
                    <div className="grid grid-cols-7 gap-3 items-center">
                      {/* Invitee Info */}
                      <div className="col-span-5">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            user={{
                              firstName: invite.inviteeEmail?.[0]?.toUpperCase() || "",
                              lastName: "",
                            }}
                            size="sm"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-[var(--foreground)] truncate">
                              {invite.inviteeEmail}
                            </div>

                            <div className="text-[14px] text-[var(--muted-foreground)] truncate">
                              Invited by{" "}
                              {invite.inviter?.firstName
                                ? `${invite.inviter.firstName} ${invite.inviter.lastName || ""}`
                                : "Unknown"}
                            </div>

                            {/* Date + Status */}
                            <div className="text-[12px] text-[var(--muted-foreground)] flex items-center gap-2">
                              {formatDate(invite.createdAt)}

                              <Badge
                                variant="outline"
                                className={`text-[11px] bg-transparent px-1.5 py-0.5 rounded-md border-none ${getStatusBadgeClass(
                                  invite.status
                                )}`}
                              >
                                {invite.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      {/* Actions */}
                      <div className="col-span-2 flex justify-end">
                        {invite.status !== "DECLINED" && (
                          <DropdownMenu>
                            <Tooltip content="All Actions">
                              <DropdownMenuTrigger asChild className="bg-[var(--card)]">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 cursor-pointer"
                                >
                                  <BsThreeDotsVertical className="w-5 h-5" />
                                </Button>
                              </DropdownMenuTrigger>
                            </Tooltip>

                            <DropdownMenuContent
                              align="end"
                              className="w-40 bg-[var(--card)] border-none shadow-md"
                            >
                              <DropdownMenuItem
                                onClick={() => handleResendInvite(invite.id)}
                                disabled={resendingId === invite.id}
                                className="flex text-xs items-center gap-2 cursor-pointer hover:bg-[var(--accent)]"
                              >
                                <HiArrowPath
                                  className={`w-4 h-4 ${
                                    resendingId === invite.id ? "animate-spin" : ""
                                  }`}
                                />
                                Resend Invitation
                              </DropdownMenuItem>

                              {/* DELETE for PENDING + EXPIRED */}
                              <DropdownMenuItem
                                onClick={() => handleDeleteInvite(invite.id)}
                                className="flex text-xs items-center gap-2 cursor-pointer text-red-600 hover:bg-[var(--accent)]"
                              >
                                <RxReset className="w-3 h-3" />
                                Delete Invitation
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }
);

PendingInvitations.displayName = "PendingInvitations";

export default PendingInvitations;
