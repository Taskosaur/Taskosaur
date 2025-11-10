import React, { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/DropdownMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  avatar?: string;
}

interface ProjectMember {
  id: string;
  user?: User;
  role: string;
}

interface UserSelectorProps {
  selectedUserId: string;
  onUserChange: (userId: string) => void;
  members: ProjectMember[];
  placeholder: string;
}

const UserSelector: React.FC<UserSelectorProps> = ({
  selectedUserId,
  onUserChange,
  members,
  placeholder,
}) => {
  const [search, setSearch] = useState("");

  const selected = members.find((m) => m.user?.id === selectedUserId)?.user;

  const filtered = members.filter((m) => {
    const u = m.user;
    if (!u) return false;
    const term = search.toLowerCase();
    return (
      `${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.id.toLowerCase().includes(term)
    );
  });

  return (
    <DropdownMenu>
      {/* trigger */}
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="kanban-user-selector-trigger">
          {selected ? `${selected.firstName} ${selected.lastName}` : placeholder}
        </Button>
      </DropdownMenuTrigger>

      {/* content */}
      <DropdownMenuContent className="kanban-user-selector-content">
        {/* search box */}
        <div className="kanban-user-selector-search-container">
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="kanban-user-selector-search-input"
          />
        </div>

        {/* user list */}
        <div className="kanban-user-selector-list">
          {filtered.map(({ id, user }) => (
            <DropdownMenuItem
              key={id}
              onClick={() => {
                onUserChange(user!.id);
                setSearch("");
              }}
              className="kanban-user-selector-item"
            >
              <span className="kanban-user-selector-item-name">
                {user?.firstName} {user?.lastName}
              </span>
              {user?.email && <span className="kanban-user-selector-item-email">{user.email}</span>}
            </DropdownMenuItem>
          ))}

          {/* no results */}
          {filtered.length === 0 && (
            <div className="kanban-user-selector-empty">No users found</div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserSelector;
