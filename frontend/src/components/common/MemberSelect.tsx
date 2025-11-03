import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/DropdownMenu";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useProject } from "@/contexts/project-context";
import { toast } from "sonner";

interface MemberSelectProps {
  label: string;
  selectedMembers: any[];
  onChange: (members: any[]) => void;
  members: any[];
  disabled?: boolean;
  placeholder?: string;
  editMode?: boolean;
  type?: "assignee" | "reporter";
  projectId?: string;
}

function MemberSelect({
  label,
  selectedMembers,
  onChange,
  members: initialMembers,
  disabled = false,
  placeholder = "Select members...",
  editMode = false,
  type = "assignee",
  projectId,
}: MemberSelectProps) {
  const { getProjectMembers } = useProject();

  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [autoOpenDropdown, setAutoOpenDropdown] = useState(false);

  const [members, setMembers] = useState<any[]>(initialMembers);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (autoOpenDropdown && isEditing && !isOpen) {
      setIsOpen(true);
      setAutoOpenDropdown(false);
    }
  }, [autoOpenDropdown, isEditing, isOpen]);

  useEffect(() => {
    if (!projectId || !isOpen) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);

      abortControllerRef.current = new AbortController();

      try {
        const fetchedMembers = await getProjectMembers(projectId, search.trim() || undefined);

        // Normalize member data
        const normalizedMembers = Array.isArray(fetchedMembers)
          ? fetchedMembers
              .filter((m) => m?.user)
              .map((m) => ({
                id: m.user.id,
                firstName: m.user.firstName || "",
                lastName: m.user.lastName || "",
                email: m.user.email || "",
                avatarUrl: m.user.avatar || m.user.avatarUrl,
                role: m.role,
              }))
          : [];

        setMembers(normalizedMembers);
      } catch (error: any) {
        // Don't show error if request was aborted
        if (error.name !== "AbortError") {
          console.error("Failed to fetch project members:", error);
          setSearchError("Failed to load members");
          toast.error("Failed to load project members");
        }
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce delay

    // Cleanup
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [search, projectId, isOpen]);

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setSearchError(null);
      // Reset to initial members if in create mode
      if (!editMode && initialMembers.length > 0) {
        setMembers(initialMembers);
      }
    }
  }, [isOpen, editMode, initialMembers]);

  const handleMemberToggle = (member: any) => {
    const isSelected = selectedMembers.some((m) => m.id === member.id);
    if (isSelected) {
      onChange(selectedMembers.filter((m) => m.id !== member.id));
    } else {
      onChange([...selectedMembers, member]);
    }
  };

  let displayText = placeholder;
  if (selectedMembers.length > 0) {
    displayText =
      selectedMembers.length === 1
        ? `${selectedMembers[0].firstName} ${selectedMembers[0].lastName}`
        : `${selectedMembers.length} members selected`;
  } else if (label && selectedMembers.length === 0) {
    const baseLabel = label.endsWith("s") ? label.slice(0, -1) : label;
    displayText = `Select ${baseLabel.toLowerCase()}...`;
  }

  if (editMode) {
    const maxToShow = 3;
    const shownMembers = selectedMembers.slice(0, maxToShow);
    const extraCount = selectedMembers.length - maxToShow;

    const baseLabel = label.endsWith("s") ? label.slice(0, -1) : label;
    const displayLabel =
      selectedMembers.length === 0 ? `No ${baseLabel.toLowerCase()} selected` : "";

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          <button
            type="button"
            className="ml-2 rounded transition flex items-center cursor-pointer p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs"
            onClick={() => {
              if (isEditing && isOpen) {
                setIsOpen(false);
                setIsEditing(false);
                setAutoOpenDropdown(false);
              } else {
                setIsEditing(true);
                setAutoOpenDropdown(true);
              }
            }}
            tabIndex={0}
            aria-label="Edit"
            style={{ lineHeight: 0 }}
          >
            Edit
          </button>
        </div>
        <div className="flex items-center gap-2 min-h-[28px]">
          {shownMembers.length > 0 ? (
            <>
              {shownMembers.map((member) => (
                <UserAvatar
                  key={member.id}
                  user={{
                    ...member,
                    avatar: member.avatarUrl || member.avatar || "/default-avatar.png",
                  }}
                  size="sm"
                />
              ))}
              {extraCount > 0 && (
                <span className="text-xs bg-[var(--muted)] px-2 py-1 rounded-full border border-[var(--border)]">
                  +{extraCount}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-[var(--muted-foreground)]">{displayLabel}</span>
          )}
        </div>

        {isEditing && (
          <div className="mt-2">
            <DropdownMenu
              open={isOpen}
              onOpenChange={(open) => {
                setIsOpen(open);
                if (!open) {
                  setAutoOpenDropdown(false);
                  setIsEditing(false);
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <div className="w-full h-0 opacity-0 pointer-events-none">
                  <Button variant="outline" className="w-full" disabled={disabled}>
                    {displayText}
                  </Button>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-full border-[var(--border)] bg-[var(--popover)]"
                align="start"
                sideOffset={0}
              >
                <div className="pb-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none" />
                    <Input
                      placeholder="Search members..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="mb-2 pl-9 h-9"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto">
                  {searchError ? (
                    <div className="p-2 text-sm text-red-500 text-center">{searchError}</div>
                  ) : members.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">No members found.</div>
                  ) : (
                    members.map((member) => {
                      const isSelected = selectedMembers.some((m) => m.id === member.id);
                      return (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 p-2 hover:bg-[var(--accent)] cursor-pointer"
                          onClick={() => handleMemberToggle(member)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleMemberToggle(member)}
                          />
                          <UserAvatar
                            user={{
                              ...member,
                              avatar: member.avatarUrl || member.avatar || "/default-avatar.png",
                            }}
                            size="sm"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {member.firstName} {member.lastName}
                            </span>
                            <span className="text-xs text-gray-500">{member.email}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    );
  }

  if (disabled) {
    return (
      <>
        <Label className="pb-2">{label}</Label>
        <div className="flex items-center gap-2">
          {selectedMembers.map((member) => (
            <UserAvatar
              key={member.id}
              user={{
                ...member,
                avatar: member.avatarUrl || member.avatar || "/default-avatar.png",
              }}
              size="sm"
            />
          ))}
        </div>
      </>
    );
  }

  // Create mode (non-edit)
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between border-[var(--border)] bg-[var(--background)] text-left"
            disabled={disabled}
          >
            <span className={selectedMembers.length === 0 ? "text-muted-foreground" : ""}>
              {displayText}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full min-w-[var(--radix-dropdown-menu-trigger-width)] border-[var(--border)] bg-[var(--popover)]">
          <div className="p-2 pb-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none" />
              <Input
                placeholder="Search members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-2 pl-9 h-9"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {searchError ? (
              <div className="p-2 text-sm text-red-500 text-center">{searchError}</div>
            ) : members.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">No members found.</div>
            ) : (
              members.map((member) => {
                const isSelected = selectedMembers.some((m) => m.id === member.id);
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-2 p-2 hover:bg-[var(--accent)] cursor-pointer"
                    onClick={() => handleMemberToggle(member)}
                  >
                    <Checkbox checked={isSelected} onChange={() => handleMemberToggle(member)} />
                    <UserAvatar
                      user={{
                        ...member,
                        avatar: member.avatarUrl || member.avatar || "/default-avatar.png",
                      }}
                      size="sm"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm">
                        {member.firstName} {member.lastName}
                      </span>
                      <span className="text-xs text-gray-500">{member.email}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default MemberSelect;
