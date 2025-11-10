import { useState, useEffect, useRef } from "react";
import { useProjectContext } from "@/contexts/project-context";
import { HiChevronDown, HiXMark } from "react-icons/hi2";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  avatar?: string;
}

interface Member {
  id: string;
  user?: User;
  role: string;
}

const UserAvatar = ({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) => {
  const sizes = {
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm",
  };

  const getInitials = (name: string) => {
    if (!name || name.trim() === "") return "UN";

    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div
      className={`${sizes[size]} rounded-full bg-amber-500 flex items-center justify-center text-white font-medium`}
    >
      {getInitials(name)}
    </div>
  );
};

interface ProjectMemberDropdownProps {
  projectId: string;
  selectedUser: User | null;
  onUserChange: (user: User | null) => void;
  placeholder?: string;
  allowUnassign?: boolean;
  unassignText?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function ProjectMemberDropdown({
  projectId,
  selectedUser,
  onUserChange,
  placeholder = "Select member...",
  allowUnassign = true,
  unassignText = "Unassign",

  disabled = false,
}: ProjectMemberDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const lastFetchedProjectRef = useRef<string>("");
  const membersCache = useRef<Map<string, Member[]>>(new Map());

  const { getProjectMembers } = useProjectContext();

  // Cleanup effect
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  // Load cached members when projectId changes
  useEffect(() => {
    if (projectId && membersCache.current.has(projectId)) {
      const cachedMembers = membersCache.current.get(projectId)!;
      setMembers(cachedMembers);
      lastFetchedProjectRef.current = projectId;
    } else if (projectId !== lastFetchedProjectRef.current) {
      setMembers([]);
      lastFetchedProjectRef.current = "";
    }
  }, [projectId]);

  const fetchMembers = async () => {
    if (!projectId || membersCache.current.has(projectId)) {
      return;
    }

    if (lastFetchedProjectRef.current === projectId) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const currentController = abortControllerRef.current;

    setLoading(true);

    try {
      const data = await getProjectMembers(projectId);

      // Check if component is still mounted and request wasn't aborted
      if (!isMountedRef.current || currentController.signal.aborted) {
        return;
      }

      const membersList = data || [];
      setMembers(membersList);

      // Cache the results
      membersCache.current.set(projectId, membersList);
      lastFetchedProjectRef.current = projectId;
    } catch (error) {
      if (!currentController.signal.aborted && isMountedRef.current) {
        console.error("Failed to fetch project members:", error);
        setMembers([]);
      }
    } finally {
      if (isMountedRef.current && !currentController.signal.aborted) {
        setLoading(false);
      }
    }
  };

  // Handle dropdown opening
  const handleDropdownToggle = () => {
    if (disabled) return;

    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);

    // Fetch members when opening dropdown if we don't have cached data
    if (newIsOpen && projectId && !membersCache.current.has(projectId)) {
      fetchMembers();
    }
  };

  const handleUserSelect = (user: User | null) => {
    onUserChange(user);
    setIsOpen(false);
  };

  const getUserDisplayName = (user: User) => {
    return user.username || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
  };

  const getUserInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    if (user.username) {
      return user.username;
    }
    return user.email;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {selectedUser ? (
        <button
          type="button"
          onClick={handleDropdownToggle}
          disabled={disabled}
          className="w-full flex items-center justify-between p-2 border border-stone-300 dark:border-stone-600 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-2">
            <UserAvatar name={getUserInitials(selectedUser)} />
            <span className="text-xs font-medium text-stone-900 dark:text-stone-100 truncate">
              {getUserDisplayName(selectedUser)}
            </span>
          </div>
          <HiChevronDown size={16} className="text-stone-400" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleDropdownToggle}
          disabled={disabled}
          className="w-full p-2 border border-stone-300 dark:border-stone-600 rounded-lg text-stone-500 dark:text-stone-400 hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-left text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {disabled ? "Select project first..." : placeholder}
        </button>
      )}

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-stone-800 shadow-lg rounded-lg border border-stone-200 dark:border-stone-700 max-h-48 overflow-y-auto">
          {!projectId ? (
            <div className="px-3 py-2 text-xs text-stone-500 dark:text-stone-400">
              Please select a project first
            </div>
          ) : loading ? (
            <div className="px-3 py-2 text-xs text-stone-500 dark:text-stone-400">
              Loading members...
            </div>
          ) : members.length === 0 ? (
            <div className="px-3 py-2 text-xs text-stone-500 dark:text-stone-400">
              No members found in this project
            </div>
          ) : (
            <>
              {allowUnassign && selectedUser && (
                <button
                  type="button"
                  onClick={() => handleUserSelect(null)}
                  className="w-full px-3 py-2 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <HiXMark size={14} />
                  {unassignText}
                </button>
              )}
              {members
                .filter((member) => member.user)
                .map((member) => {
                  const user = member.user!;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleUserSelect(user)}
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-stone-50 dark:hover:bg-stone-700 flex items-center gap-2 ${
                        selectedUser?.id === user.id ? "bg-amber-50 dark:bg-amber-900/20" : ""
                      }`}
                    >
                      <UserAvatar name={getUserInitials(user)} />
                      <div className="min-w-0">
                        <div className="font-medium text-stone-900 dark:text-stone-100 truncate">
                          {getUserDisplayName(user)}
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400">
                          {member.role || "Member"}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
