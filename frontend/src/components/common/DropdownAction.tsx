import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import { HiChevronDown, HiMagnifyingGlass, HiXMark } from "react-icons/hi2";
import { useMemo, useState, useEffect } from "react";

// Base interfaces for different entity types
export interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  avatar?: string;
  role?: string;
}

export interface TaskStatus {
  id: string;
  name: string;
  color?: string;
  category?: string;
  position?: number;
  isDefault?: boolean;
  workflowId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  workflow?: {
    id: string;
    name: string;
    description?: string;
    organization?: {
      id: string;
      name: string;
      slug: string;
    };
  };
  _count?: {
    tasks: number;
  };
}

export interface ProjectMember {
  id: string;
  role: string;
  joinedAt: string;
  userId: string;
  projectId: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    status: string;
    lastLoginAt?: string | null;
  };
  project?: {
    id: string;
    name: string;
    slug: string;
    avatar?: string;
    color: string;
    workspace?: {
      id: string;
      name: string;
      slug: string;
      organization?: {
        id: string;
        name: string;
        slug: string;
      };
    };
  };
}

export type DropdownItem = User | TaskStatus | ProjectMember;

interface DropdownActionProps {
  currentItem: DropdownItem | null;
  availableItems: DropdownItem[];
  onItemSelect: (item: DropdownItem | null) => Promise<void>;
  placeholder: string;
  loading?: boolean;
  showUnassign?: boolean;
  hideAvatar?: boolean;
  hideSubtext?: boolean;
  onDropdownOpen?: () => Promise<void>;
  itemType: "user" | "status" | "projectMember";
  forceOpen?: boolean;
  onOpenStateChange?: (isOpen: boolean) => void;
}

// Type guards
const isUser = (item: DropdownItem): item is User => {
  return "email" in item && !("user" in item) && !("name" in item);
};

const isTaskStatus = (item: DropdownItem): item is TaskStatus => {
  return "name" in item && "color" in item && !("user" in item);
};

const isProjectMember = (item: DropdownItem): item is ProjectMember => {
  return "user" in item && "role" in item && "projectId" in item;
};

const getUserFromProjectMember = (member: ProjectMember): User => {
  return {
    id: member.user.id,
    firstName: member.user.firstName,
    lastName: member.user.lastName,
    email: member.user.email,
    avatar: member.user.avatar,
    role: member.role,
    username: `${member.user.firstName} ${member.user.lastName}`.trim(),
  };
};

const getDisplayData = (item: DropdownItem | null) => {
  if (!item) return null;

  if (isUser(item)) {
    return {
      name: item.username || `${item.firstName} ${item.lastName}`.trim(),
      subtext: item.email || item.role || "Member",
      avatar: item.avatar,
      user: item,
    };
  }

  if (isTaskStatus(item)) {
    return {
      name: item.name,
      subtext: item.category || "Status",
      color: item.color,
      user: null,
    };
  }

  if (isProjectMember(item)) {
    const user = getUserFromProjectMember(item);
    return {
      name: user.username || `${user.firstName} ${user.lastName}`.trim(),
      subtext: user.email || user.role || "Member",
      avatar: user.avatar,
      user: user,
    };
  }

  return null;
};

const getSearchText = (item: DropdownItem): string => {
  if (isUser(item)) {
    const name = `${item.firstName} ${item.lastName}`.toLowerCase();
    const username = item.username?.toLowerCase() || "";
    const email = item.email?.toLowerCase() || "";
    return `${name} ${username} ${email}`;
  }

  if (isTaskStatus(item)) {
    return `${item.name} ${item.category || ""}`.toLowerCase();
  }

  if (isProjectMember(item)) {
    const user = item.user;
    const name = `${user.firstName} ${user.lastName}`.toLowerCase();
    const email = user.email?.toLowerCase() || "";
    return `${name} ${email} ${item.role}`.toLowerCase();
  }

  return "";
};

const ItemDisplay = ({
  item,
  placeholder,
  hideAvatar = false,
  hideSubtext = false,
}: {
  item: DropdownItem | null;
  placeholder: string;
  hideAvatar?: boolean;
  hideSubtext?: boolean;
}) => {
  if (!item) {
    return (
      <span className="text-sm text-[var(--muted-foreground)] truncate block">{placeholder}</span>
    );
  }

  const displayData = getDisplayData(item);
  if (!displayData) {
    return (
      <span className="text-sm text-[var(--muted-foreground)] truncate block">{placeholder}</span>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
      {!hideAvatar && (
        <>
          {displayData.user ? (
            <UserAvatar
              user={{
                firstName: displayData.user.firstName || "",
                lastName: displayData.user.lastName || "",
                avatar: displayData.user.avatar,
              }}
              size="sm"
            />
          ) : displayData.color ? (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: displayData.color }}
            >
              <div className="w-3 h-3 bg-white rounded-full opacity-80" />
            </div>
          ) : (
            <div className="w-6 h-6 bg-[var(--muted)] rounded-full flex items-center justify-center shrink-0">
              <div className="w-3 h-3 bg-[var(--muted-foreground)] rounded-full opacity-60" />
            </div>
          )}
        </>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-xs sm:text-sm font-medium text-[var(--foreground)] truncate">
          {displayData.name}
        </div>
        {!hideSubtext && (
          <div className="text-[11px] sm:text-[12px] text-[var(--muted-foreground)] truncate">
            {displayData.subtext}
          </div>
        )}
      </div>
    </div>
  );
};

export default function DropdownAction({
  currentItem,
  availableItems,
  onItemSelect,
  placeholder,
  loading = false,
  showUnassign = true,
  hideAvatar = false,
  hideSubtext = false,
  onDropdownOpen,
  itemType,
  forceOpen = false,
  onOpenStateChange,
}: DropdownActionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return availableItems;

    const query = searchQuery.toLowerCase();
    return availableItems.filter((item) => {
      const searchText = getSearchText(item);
      return searchText.includes(query);
    });
  }, [availableItems, searchQuery]);

  // Handle forceOpen prop
  useEffect(() => {
    if (forceOpen && !isOpen) {
      handleOpenChange(true);
    }
  }, [forceOpen]);

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);

    // Notify parent of state change
    onOpenStateChange?.(open);

    if (open && onDropdownOpen) {
      setIsFetching(true);
      try {
        await onDropdownOpen();
      } catch (error) {
        console.error("Error fetching data on dropdown open:", error);
      } finally {
        setIsFetching(false);
      }
    }

    if (!open) {
      setSearchQuery("");
    }
  };

  const handleItemSelect = async (item: DropdownItem | null) => {
    try {
      await onItemSelect(item);
      setIsOpen(false);
      setSearchQuery("");
    } catch (err) {
      console.error("Error selecting item", err);
    }
  };

  const shouldShowSearch = true;
  const isLoading = loading || isFetching;

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between border-[var(--border)] hover:bg-[var(--accent)]
           px-2 py-1.5 h-9 text-sm sm:px-3 sm:py-2 sm:h-10 sm:text-base"
        >
          <ItemDisplay
            item={currentItem}
            placeholder={placeholder}
            hideAvatar={hideAvatar}
            hideSubtext={hideSubtext}
          />
          <HiChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--muted-foreground)]" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 overflow-y-auto bg-[var(--card)] border-none shadow-md p-1"
        align="start"
      >
        {shouldShowSearch && (
          <>
            <div className="px-1 py-1 sticky top-0 bg-[var(--card)] z-10">
              <div className="relative">
                <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
                <Input
                  placeholder="Search..."
                  className="pl-10 h-7 bg-[var(--background)] border-[var(--border)] text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <DropdownMenuSeparator className="my-1" />
          </>
        )}

        {currentItem && showUnassign && (
          <>
            <DropdownMenuItem
              onClick={() => handleItemSelect(null)}
              className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-[var(--destructive)] focus:bg-[var(--destructive)]/10 hover:bg-[var(--destructive)]/10 rounded-sm"
            >
              <div className="w-6 h-6 bg-[var(--destructive)]/10 rounded-full flex items-center justify-center">
                <HiXMark className="w-3 h-3 text-[var(--destructive)]" />
              </div>
              <span className="text-xs">{itemType === "status" ? "Clear Status" : "Unassign"}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
          </>
        )}

        {isLoading ? (
          <div className="p-4 text-center text-sm text-[var(--muted-foreground)]">
            Loading {itemType === "user" ? "users" : itemType === "status" ? "statuses" : "members"}
            ...
          </div>
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => {
            const displayData = getDisplayData(item);
            if (!displayData) return null;

            const isSelected = currentItem?.id === item.id;

            return (
              <DropdownMenuItem
                key={item.id}
                onClick={() => handleItemSelect(item)}
                className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-sm transition-colors ${
                  isSelected
                    ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "text-[var(--foreground)] hover:bg-[var(--accent)] focus:bg-[var(--accent)]"
                }`}
              >
                {!hideAvatar && (
                  <>
                    {displayData.user ? (
                      <UserAvatar
                        user={{
                          firstName: displayData.user.firstName || "",
                          lastName: displayData.user.lastName || "",
                          avatar: displayData.user.avatar,
                        }}
                        size="sm"
                      />
                    ) : displayData.color ? (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: displayData.color }}
                      >
                        <div className="w-3 h-3 bg-white rounded-full opacity-80" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 bg-[var(--muted)] rounded-full flex items-center justify-center">
                        <div className="w-3 h-3 bg-[var(--muted-foreground)] rounded-full opacity-60" />
                      </div>
                    )}
                  </>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{displayData.name}</div>
                  {!hideSubtext && (
                    <div className="text-[12px] text-[var(--muted-foreground)] truncate">
                      {displayData.subtext}
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })
        ) : (
          <div className="p-4 text-center text-sm text-[var(--muted-foreground)]">
            No {itemType === "user" ? "users" : itemType === "status" ? "statuses" : "members"}{" "}
            found.
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
