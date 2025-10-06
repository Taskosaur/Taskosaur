import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { HiPencil } from "react-icons/hi2";
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

interface MemberSelectProps {
  label: string;
  selectedMembers: any[];
  onChange: (members: any[]) => void;
  members: any[];
  disabled?: boolean;
  placeholder?: string;
  editMode?: boolean;
  type?: "assignee" | "reporter";
}

function MemberSelect({
  label,
  selectedMembers,
  onChange,
  members,
  disabled = false,
  placeholder = "Select members...",
  editMode = false,
  type = "assignee",
}: MemberSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [autoOpenDropdown, setAutoOpenDropdown] = useState(false);

  // Auto-open dropdown when edit button is clicked
  useEffect(() => {
    if (autoOpenDropdown && isEditing && !isOpen) {
      setIsOpen(true);
      setAutoOpenDropdown(false);
    }
  }, [autoOpenDropdown, isEditing, isOpen]);

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

  // Filter members by search
  const filteredMembers = members.filter((member) => {
    const searchLower = search.toLowerCase();
    return (
      member.firstName?.toLowerCase().includes(searchLower) ||
      member.lastName?.toLowerCase().includes(searchLower) ||
      member.email?.toLowerCase().includes(searchLower)
    );
  });

  if (editMode) {
    const maxToShow = 3;
    const shownMembers = selectedMembers.slice(0, maxToShow);
    const extraCount = selectedMembers.length - maxToShow;

    // Get proper label text
    const baseLabel = label.endsWith("s") ? label.slice(0, -1) : label;
    const displayLabel =
      selectedMembers.length === 0
        ? `No ${baseLabel.toLowerCase()} selected`
        : undefined;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          <button
            type="button"
            className="ml-2 rounded transition flex items-center cursor-pointer  p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs"
            onClick={() => {
              if (isEditing && isOpen) {
                // Close dropdown if already open
                setIsOpen(false);
                setIsEditing(false);
                setAutoOpenDropdown(false);
              } else {
                // Open dropdown
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
                    avatar:
                      member.avatarUrl ||
                      member.avatar ||
                      "/default-avatar.png",
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
            <span className="text-xs text-[var(--muted-foreground)]">
              {displayLabel}
            </span>
          )}
        </div>
        {/* Show dropdowns (default or edit mode) only when editing */}
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
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={disabled}
                  >
                    {displayText}
                  </Button>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-full border-[var(--border)] bg-[var(--popover)]"
                align="start"
                sideOffset={0}
              >
                <div className=" pb-0">
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
                  {filteredMembers.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No members found.
                    </div>
                  ) : (
                    filteredMembers.map((member) => {
                      const isSelected = selectedMembers.some(
                        (m) => m.id === member.id
                      );
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
                              avatar:
                                member.avatarUrl ||
                                member.avatar ||
                                "/default-avatar.png",
                            }}
                            size="sm"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {member.firstName} {member.lastName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {member.email}
                            </span>
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
            <span
              className={
                selectedMembers.length === 0 ? "text-muted-foreground" : ""
              }
            >
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
            {filteredMembers.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">
                No members found.
              </div>
            ) : (
              filteredMembers.map((member) => {
                const isSelected = selectedMembers.some(
                  (m) => m.id === member.id
                );
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
                        avatar:
                          member.avatarUrl ||
                          member.avatar ||
                          "/default-avatar.png",
                      }}
                      size="sm"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm">
                        {member.firstName} {member.lastName}
                      </span>
                      <span className="text-xs text-gray-500">
                        {member.email}
                      </span>
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
