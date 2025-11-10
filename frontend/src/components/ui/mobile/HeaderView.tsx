import React, { useState } from "react";
import { SlOptionsVertical } from "react-icons/sl";
import { HiChatBubbleLeftRight } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import OrganizationSelector from "@/components/header/OrganizationSelector";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import InvitationManager from "@/components/header/InvitationManager";
import { ModeToggle } from "@/components/header/ModeToggle";
import SearchManager from "@/components/header/SearchManager";

interface HeaderViewProps {
  currentUser: any;
  currentOrganizationId: string | null;
  hasOrganizationAccess: boolean;
  toggleChat?: () => void;
  isChatOpen?: boolean;
  isAIEnabled?: boolean;
}

export default function HeaderView({
  currentUser,
  currentOrganizationId,
  hasOrganizationAccess,
  toggleChat,
  isChatOpen,
  isAIEnabled,
}: HeaderViewProps) {
  const [isKebabMenuOpen, setIsKebabMenuOpen] = useState(false);

  return (
    <div className="header-right">
      <DropdownMenu open={isKebabMenuOpen} onOpenChange={setIsKebabMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="header-mode-toggle"
            aria-label="More options"
          >
            <SlOptionsVertical className="header-mode-toggle-icon" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          className="w-[90vw] p-3 bg-[var(--background)] border-none"
          sideOffset={8}
        >
          <div className="flex flex-col space-y-3">
            {/* Organization Selector */}
            {hasOrganizationAccess && (
              <div className="flex items-center justify-center pb-3">
                <OrganizationSelector />
              </div>
            )}

            {hasOrganizationAccess && (
              <>
                {/* Notification Dropdown */}
                <div className="flex items-center justify-center py-2">
                  <NotificationDropdown
                    userId={currentUser?.id}
                    organizationId={currentOrganizationId}
                  />
                </div>

                {/* Invitation Manager */}
                <div className="flex items-center justify-center py-2">
                  <InvitationManager userId={currentUser?.id} />
                </div>

                {/* Mode Toggle */}
                <div className="flex items-center justify-center py-2">
                  <ModeToggle />
                </div>

                {/* Search Manager */}
                <div className="flex items-center justify-center py-2">
                  <SearchManager />
                </div>

                {/* AI Chat button */}
                {toggleChat && isAIEnabled && (
                  <div className="flex items-center justify-center py-2">
                    <Button
                      onClick={() => {
                        toggleChat();
                        setIsKebabMenuOpen(false);
                      }}
                      variant="ghost"
                      size="icon"
                      aria-label="Toggle AI Chat"
                      className={`header-mode-toggle transition-all duration-200 ${
                        isChatOpen
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 ring-2 ring-blue-500/20"
                          : ""
                      }`}
                    >
                      <HiChatBubbleLeftRight
                        className={`header-mode-toggle-icon transition-colors duration-200 ${
                          isChatOpen ? "text-blue-600 dark:text-blue-400 scale-110" : ""
                        }`}
                      />
                      <span>AI Chat</span>
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
