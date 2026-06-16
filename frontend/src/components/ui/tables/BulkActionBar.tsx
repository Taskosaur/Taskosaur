import { Trash2, X, CheckCircle, ChevronDown, Check, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmationModal from "@/components/modals/ConfirmationModal";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import UserAvatar from "@/components/ui/avatars/UserAvatar";

interface BulkActionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onClear: () => void;
  onAllDeleteSelect: () => void;
  totalTask?: number;
  currentTaskCount?: number;
  allDelete?: boolean;
  excludedCount?: number;
  availableStatuses?: any[];
  onStatusUpdate?: (statusId: string) => void;
  onAssign?: (assigneeIds: string[]) => void;
  onClearAssignment?: () => void;
  availableMembers?: any[];
  userRole?: string | null;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onDelete,
  onClear,
  onAllDeleteSelect,
  totalTask,
  currentTaskCount,
  allDelete,
  excludedCount = 0,
  availableStatuses = [],
  onStatusUpdate,
  onAssign,
  onClearAssignment,
  availableMembers = [],
  userRole,
}) => {
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showClearAssignmentConfirmation, setShowClearAssignmentConfirmation] = useState(false);
  const [showAssignConfirmation, setShowAssignConfirmation] = useState(false);
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const canDelete = userRole && ["SUPER_ADMIN", "OWNER", "MANAGER"].includes(userRole);
  const canUpdateStatus = userRole && ["SUPER_ADMIN", "OWNER", "MANAGER", "MEMBER", "DEVELOPER"].includes(userRole);
  const canAssign = userRole && ["SUPER_ADMIN", "OWNER", "MANAGER", "MEMBER", "DEVELOPER"].includes(userRole);

  if (selectedCount === 0 && !allDelete) return null;
  const finalSelectedCount = allDelete ? (totalTask ?? 0) - excludedCount : selectedCount;
  if (finalSelectedCount === 0) return null;

  const handleDeleteClick = () => {
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = () => {
    onDelete();
    setShowDeleteConfirmation(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirmation(false);
  };

  const handleStatusSelect = (statusId: string) => {
    setSelectedStatusId(statusId);
  };

  const handleConfirmStatus = () => {
    if (onStatusUpdate && selectedStatusId) {
      onStatusUpdate(selectedStatusId);
    }
    setSelectedStatusId(null);
  };

  const handleCancelStatus = () => {
    setSelectedStatusId(null);
  };

  const handleMemberSelect = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleConfirmAssign = () => {
    if (onAssign && selectedMemberIds.length > 0) {
      onAssign(selectedMemberIds);
      setSelectedMemberIds([]);
      setShowAssignConfirmation(false);
    }
  };

  const handleCancelAssign = () => {
    setSelectedMemberIds([]);
    setShowAssignConfirmation(false);
  };

  const selectedStatus = availableStatuses.find((s) => s.id === selectedStatusId);
  const selectedMembers = availableMembers.filter(
    (m) => selectedMemberIds.includes(m.user?.id || m.userId)
  );
  const selectedMemberNames = selectedMembers.map((m) => {
    const name = `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim();
    return name || m.user?.email || "Unnamed";
  });

  const allSelected = currentTaskCount && selectedCount >= currentTaskCount;
  return (
    <>
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-8 fade-in duration-300">
        <div className="bg-[var(--card)]/90 backdrop-blur-md border border-[var(--border)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] px-1.5 py-1.5 flex items-center gap-2">
          {/* Selection Info */}
          <div className="flex items-center px-3 py-1.5 gap-2 border-r border-[var(--border)]">
            <div className="flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold h-5 w-5 rounded-md shadow-sm">
              {finalSelectedCount}
            </div>
            <span className="text-xs font-medium text-[var(--foreground)] pr-1">
              {finalSelectedCount === 1 ? "Task" : "Tasks"} selected
            </span>

            {(allSelected || allDelete) && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAllDeleteSelect();
                }}
                className="text-[11px] text-primary hover:text-primary/80 font-bold bg-primary/5 hover:bg-primary/10 px-2 py-1 rounded-md transition-all uppercase tracking-tight"
              >
                {!allDelete ? `Select all ${totalTask}` : "Clear Selection"}
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {onStatusUpdate && canUpdateStatus && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 gap-2 hover:bg-primary/[0.08] text-[var(--foreground)] font-medium transition-all group"
                  >
                    <CheckCircle className="size-4 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-xs">Update Status</span>
                    <ChevronDown className="size-3.5 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="center" 
                  sideOffset={12}
                  className="w-[220px] p-1.5 bg-[var(--card)]/95 backdrop-blur-sm border-[var(--border)] rounded-xl shadow-2xl animate-in zoom-in-95 duration-200"
                >
                  <div className="px-2 py-2 mb-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-70 border-b border-[var(--border)]/50">
                    Change Status to
                  </div>
                  <div className="max-h-[280px] overflow-y-auto pr-1 space-y-0.5 custom-scrollbar">
                    {availableStatuses.map((status) => (
                      <DropdownMenuItem
                        key={status.id}
                        onClick={() => handleStatusSelect(status.id)}
                        className={cn(
                          "flex items-center justify-between gap-3 px-2.5 py-2.5 rounded-lg border border-transparent cursor-pointer transition-all",
                          "hover:bg-primary/5 hover:border-primary/20",
                          "group"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-2.5 h-2.5 rounded-full ring-4 ring-offset-0 ring-primary/0 group-hover:ring-primary/10 transition-all"
                            style={{ 
                              backgroundColor: status.color || "#cbd5e1",
                              boxShadow: `0 0 8px ${status.color || "#cbd5e1"}40`
                            }}
                          />
                          <span className="text-sm font-medium">{status.name}</span>
                        </div>
                        <Check className="size-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </DropdownMenuItem>
                    ))}
                  </div>
                  {availableStatuses.length === 0 && (
                    <div className="px-2 py-3 text-center text-xs text-muted-foreground italic bg-muted/30 rounded-lg">
                      No statuses available
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {onAssign && canAssign && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-3 gap-2 hover:bg-primary/[0.08] text-[var(--foreground)] font-medium transition-all group"
                    >
                      <UserPlus className="size-4 text-primary group-hover:scale-110 transition-transform" />
                      <span className="text-xs">Assign</span>
                      <ChevronDown className="size-3.5 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="center"
                    sideOffset={12}
                    className="w-[260px] p-1.5 bg-[var(--card)]/95 backdrop-blur-sm border-[var(--border)] rounded-xl shadow-2xl animate-in zoom-in-95 duration-200"
                  >
                    <div className="px-2 py-2 mb-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-70 border-b border-[var(--border)]/50">
                      Assign to
                    </div>
                    <div className="max-h-[240px] overflow-y-auto pr-1 space-y-0.5 custom-scrollbar">
                      {availableMembers.map((member) => {
                        const firstName = member.user?.firstName || "";
                        const lastName = member.user?.lastName || "";
                        const email = member.user?.email || "";
                        const displayName = `${firstName} ${lastName}`.trim() || email || "Unnamed";
                        const userId = member.user?.id || member.userId;
                        const isSelected = selectedMemberIds.includes(userId);
                        return (
                        <DropdownMenuItem
                          key={userId}
                          onSelect={(e) => e.preventDefault()}
                          onClick={() => handleMemberSelect(userId)}
                          className={cn(
                            "flex items-center gap-3 px-2.5 py-2.5 rounded-lg border border-transparent cursor-pointer transition-all",
                            "hover:bg-primary/5 hover:border-primary/20",
                            isSelected && "bg-primary/5 border-primary/10"
                          )}
                        >
                          <Checkbox checked={isSelected} className="pointer-events-none" />
                          <UserAvatar user={member.user || member} size="xs" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate">
                              {displayName}
                            </span>
                            {email && (
                              <span className="text-[11px] text-muted-foreground truncate max-w-[150px]">
                                {email}
                              </span>
                            )}
                          </div>
                        </DropdownMenuItem>
                      );
                      })}
                    </div>
                    {availableMembers.length === 0 && (
                      <div className="px-2 py-3 text-center text-xs text-muted-foreground italic bg-muted/30 rounded-lg">
                        No members available
                      </div>
                    )}
                    {selectedMemberIds.length > 0 && (
                      <>
                        <DropdownMenuSeparator className="my-1" />
                        <div className="p-1.5">
                          <Button
                            size="sm"
                            onClick={() => setShowAssignConfirmation(true)}
                            className="w-full h-9 gap-2 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 font-medium"
                          >
                            <UserPlus className="size-4" />
                            Assign ({selectedMemberIds.length})
                          </Button>
                        </div>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                {onClearAssignment && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowClearAssignmentConfirmation(true)}
                    className="h-9 px-3 gap-2 text-amber-600 hover:bg-amber-100 dark:text-amber-500 dark:hover:bg-amber-900/20 font-medium transition-all group"
                  >
                    <X className="size-4 group-hover:scale-110 transition-transform" />
                    <span className="text-xs">Clear Assignment</span>
                  </Button>
                )}
              </>
            )}

            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteClick}
                className="h-9 px-3 gap-2 text-destructive hover:bg-destructive/10 font-medium transition-all group"
              >
                <Trash2 className="size-4 group-hover:scale-110 transition-transform" />
                <span className="text-xs">Delete</span>
              </Button>
            )}

            <div className="h-6 w-px bg-[var(--border)] mx-1" />

            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-9 w-9 p-0 hover:bg-muted/50 rounded-lg transition-all"
            >
              <X className="size-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Permanently Delete Tasks?"
        message={`This will permanently remove ${finalSelectedCount} selected ${
          finalSelectedCount === 1 ? "task" : "tasks"
        }. This action is destructive and cannot be reversed.`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        type="danger"
      />

      {selectedStatusId && (
        <ConfirmationModal
          isOpen={!!selectedStatusId}
          onClose={handleCancelStatus}
          onConfirm={handleConfirmStatus}
          title="Update Task Status"
          message={`Confirm switching ${finalSelectedCount} ${
            finalSelectedCount === 1 ? "task" : "tasks"
          } to the "${selectedStatus?.name}" status.`}
          confirmText={`Update to ${selectedStatus?.name}`}
          cancelText="Cancel"
          type="info"
        />
      )}

      {showAssignConfirmation && selectedMemberIds.length > 0 && (
        <ConfirmationModal
          isOpen={showAssignConfirmation}
          onClose={handleCancelAssign}
          onConfirm={handleConfirmAssign}
          title="Assign Tasks"
          message={`Confirm assigning ${finalSelectedCount} ${
            finalSelectedCount === 1 ? "task" : "tasks"
          } to ${selectedMemberNames.length} ${
            selectedMemberNames.length === 1 ? "member" : "members"
          }: ${selectedMemberNames.slice(0, 3).join(", ")}${
            selectedMemberNames.length > 3 ? ` +${selectedMemberNames.length - 3} more` : ""
          }.`}
          confirmText="Assign"
          cancelText="Cancel"
          type="info"
        />
      )}

      {onClearAssignment && (
        <ConfirmationModal
          isOpen={showClearAssignmentConfirmation}
          onClose={() => setShowClearAssignmentConfirmation(false)}
          onConfirm={() => {
            onClearAssignment();
            setShowClearAssignmentConfirmation(false);
          }}
          title="Clear Assignment?"
          message={`This will remove all assignees from ${finalSelectedCount} selected ${
            finalSelectedCount === 1 ? "task" : "tasks"
          }. You can reassign them later.`}
          confirmText="Clear Assignment"
          cancelText="Cancel"
          type="warning"
        />
      )}
    </>
  );
};
