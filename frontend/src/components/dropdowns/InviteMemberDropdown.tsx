import { useState, useEffect, useRef } from "react";
import { useProjectContext } from "@/contexts/project-context";
import { HiPlus, HiChevronDown, HiUsers, HiMagnifyingGlass, HiCheckCircle } from "react-icons/hi2";

interface Member {
  id: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
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

const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-4">
    <div className="animate-spin rounded-full h-6 w-6 border-2 border-amber-200 border-t-amber-600"></div>
  </div>
);

export default function InviteMemberDropdown() {
  const [showDropdown, setShowDropdown] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const { getOrganizationMembers } = useProjectContext();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const organizationId = localStorage.getItem("currentOrganizationId");

      if (!token || !organizationId) {
        console.error("Missing token or organization ID");
        return;
      }

      const data = await getOrganizationMembers(organizationId);
      // Map OrganizationMember[] to Member[] with safe defaults
      const mappedMembers = (data || []).map((orgMember: any) => {
        const user = orgMember.user || {};
        return {
          id: orgMember.id || "",
          user: {
            id: user.id || "",
            email: user.email || orgMember.email || "",
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            avatar: user.avatar || "",
          },
          role: orgMember.role || "",
        };
      });
      setMembers(mappedMembers);
    } catch (error) {
      console.error("Failed to fetch members:", error);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (selectedMembers.size === 0) return;

    setInviting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSelectedMembers(new Set());
      setShowDropdown(false);
      setSearchTerm("");
    } catch (error) {
      console.error("Failed to invite members:", error);
    } finally {
      setInviting(false);
    }
  };

  const toggleMember = (memberId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const filteredMembers = members.filter((member) => {
    const searchLower = searchTerm.toLowerCase();
    const email = member.user.email?.toLowerCase() || "";
    const firstName = member.user.firstName?.toLowerCase() || "";
    const lastName = member.user.lastName?.toLowerCase() || "";
    const fullName = `${firstName} ${lastName}`.trim();

    return (
      email.includes(searchLower) ||
      firstName.includes(searchLower) ||
      lastName.includes(searchLower) ||
      fullName.includes(searchLower)
    );
  });

  const getDisplayName = (member: Member) => {
    const { firstName, lastName } = member.user;
    if (firstName || lastName) {
      return `${firstName || ""} ${lastName || ""}`.trim();
    }
    return "No Name";
  };

  useEffect(() => {
    if (showDropdown && members.length === 0) {
      fetchMembers();
    }
  }, [showDropdown]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
      >
        <HiPlus size={16} />
        Invite Members
        <HiChevronDown
          size={14}
          className={`transition-transform ${showDropdown ? "rotate-180" : ""}`}
        />
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="p-4 border-b border-stone-200 dark:border-stone-700">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <HiUsers size={16} />
              Invite Team Members
            </h3>
            {selectedMembers.size > 0 && (
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                {selectedMembers.size} member{selectedMembers.size > 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {/* Search */}
          <div className="p-3 border-b border-stone-200 dark:border-stone-700">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <HiMagnifyingGlass size={16} className="text-stone-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search members..."
                className="block w-full pl-10 pr-3 py-2 border border-stone-300 dark:border-stone-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:bg-stone-800 dark:text-white text-sm"
              />
            </div>
          </div>

          {/* Members List */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <LoadingSpinner />
            ) : filteredMembers.length > 0 ? (
              <div className="py-2">
                {filteredMembers.map((member) => {
                  const isSelected = selectedMembers.has(member.id);
                  const displayName = getDisplayName(member);

                  return (
                    <button
                      key={member.id}
                      onClick={() => toggleMember(member.id)}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors border-b border-stone-100 dark:border-stone-700 last:border-b-0 ${
                        isSelected ? "bg-amber-50 dark:bg-amber-900/20" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={displayName} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-stone-900 dark:text-stone-100 truncate">
                              {member.user.email}
                            </p>
                            <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                              {displayName}
                            </p>
                            <p className="text-xs text-stone-400 dark:text-stone-500">
                              {member.role}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <HiCheckCircle size={18} className="text-amber-600 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <HiUsers size={32} className="mx-auto text-stone-400 mb-2" />
                <p className="text-sm text-stone-500 dark:text-stone-400 font-medium">
                  {searchTerm ? "No members found" : "No members available"}
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  {searchTerm
                    ? "Try adjusting your search terms"
                    : "Add members to your organization first"}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {selectedMembers.size > 0 && (
            <div className="p-4 border-t border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 rounded-b-lg">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setSelectedMembers(new Set())}
                  className="text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
                >
                  Clear selection
                </button>
                <button
                  onClick={handleInvite}
                  disabled={inviting}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 dark:disabled:bg-stone-600 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
                >
                  {inviting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Inviting...
                    </>
                  ) : (
                    <>
                      <HiPlus size={16} />
                      Invite {selectedMembers.size} member{selectedMembers.size > 1 ? "s" : ""}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
