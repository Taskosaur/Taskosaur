import React, { useState, useRef } from "react";
import { Users, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface User {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
}

interface SearchableAssigneeDropdownProps {
  value: string;
  onChange: (value: string) => void;
  users: User[];
  onSearch: (term: string) => void;
}

export default function SearchableAssigneeDropdown({
  value,
  onChange,
  users,
  onSearch,
}: SearchableAssigneeDropdownProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedUser = users.find((user) => user.user.id === value);

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();

  const handlePopoverOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    if (!open) {
      setLocalSearchTerm("");
      onSearch("");
    }
  };

  const handleSearchChange = (value: string) => {
    setLocalSearchTerm(value);
    onSearch(value);
  };

  return (
    <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={popoverOpen}
          className="w-full justify-between border-[var(--border)] bg-[var(--background)] text-sm font-normal h-9"
        >
          {selectedUser ? (
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarImage
                  src={selectedUser.user.avatar || "/placeholder.svg"}
                  alt={`${selectedUser.user.firstName} ${selectedUser.user.lastName}`}
                />
                <AvatarFallback className="text-xs">
                  {getInitials(selectedUser.user.firstName, selectedUser.user.lastName)}
                </AvatarFallback>
              </Avatar>
              <span>{`${selectedUser.user.firstName} ${selectedUser.user.lastName}`}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>Select default assignee</span>
            </div>
          )}
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        className="p-0 bg-[var(--card)] border-[var(--border)] shadow-sm"
        style={{ minWidth: triggerRef.current?.offsetWidth }}
      >
        <Command>
          <CommandInput
            placeholder="Search assignees..."
            value={localSearchTerm}
            onValueChange={handleSearchChange}
            className="border-b border-[var(--border)] focus:ring-0 w-full"
          />
          <CommandList>
            <CommandEmpty>No assignees found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onChange("");
                  setPopoverOpen(false);
                }}
                className="flex items-center gap-2 cursor-pointer hover:bg-[var(--muted)]"
              >
                No default assignee
              </CommandItem>
              {users.map((user) => (
                <CommandItem
                  key={user.user.id}
                  value={`${user.user.firstName} ${user.user.lastName}`}
                  onSelect={() => {
                    onChange(user.user.id);
                    setPopoverOpen(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer hover:bg-[var(--muted)]"
                >
                  <Avatar className="w-6 h-6">
                    <AvatarImage
                      src={user.user.avatar || "/placeholder.svg"}
                      alt={`${user.user.firstName} ${user.user.lastName}`}
                    />
                    <AvatarFallback className="text-xs">
                      {getInitials(user.user.firstName, user.user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm">{`${user.user.firstName} ${user.user.lastName}`}</span>
                    <span className="text-xs text-muted-foreground">{user.user.email}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
