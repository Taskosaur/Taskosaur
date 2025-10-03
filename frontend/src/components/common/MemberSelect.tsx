import { useState } from "react";
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
}

function MemberSelect({
  label,
  selectedMembers,
  onChange,
  members,
  disabled = false,
  placeholder = "Select members...",
}: MemberSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleMemberToggle = (member: any) => {
    const isSelected = selectedMembers.some((m) => m.id === member.id);
    if (isSelected) {
      onChange(selectedMembers.filter((m) => m.id !== member.id));
    } else {
      onChange([...selectedMembers, member]);
    }
  };

  const displayText =
    selectedMembers.length > 0
      ? selectedMembers.length === 1
        ? `${selectedMembers[0].firstName} ${selectedMembers[0].lastName}`
        : `${selectedMembers.length} members selected`
      : placeholder;

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
          <div className="max-h-48 overflow-y-auto">
            {members.map((member) => {
              const isSelected = selectedMembers.some(
                (m) => m.id === member.id
              );
              return (
                <div
                  key={member.id}
                  className="flex items-center space-x-2 p-2 hover:bg-[var(--accent)] cursor-pointer"
                  onClick={() => handleMemberToggle(member)}
                >
                  <Checkbox
                    checked={isSelected}
                    onChange={() => handleMemberToggle(member)}
                  />
                  <span className="text-sm">
                    {member.firstName} {member.lastName} ({member.email})
                  </span>
                </div>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default MemberSelect;