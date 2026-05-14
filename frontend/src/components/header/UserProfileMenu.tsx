import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { HiChevronDown, HiCog } from "react-icons/hi";
import { RiLogoutCircleRLine } from "react-icons/ri";
import ConfirmationModal from "../modals/ConfirmationModal";

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  role?: string;
}

interface UserProfileMenuProps {
  user: User | null;
  onLogout: () => Promise<void>;
  hasOrganizationAccess?: boolean;
  className?: string;
}

export default function UserProfileMenu({
  user,
  onLogout,
  hasOrganizationAccess = true,
  className = "",
}: UserProfileMenuProps) {
  const { t } = useTranslation(["header", "common"]);
  const [isClient, setIsClient] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [avatarSrc, setAvatar] = useState("");
  useEffect(() => {
    setIsClient(true);
    if (!user?.avatar) {
      setAvatar("");
    } else if (/^https?:\/\//.test(user.avatar)) {
      setAvatar(user.avatar);
    } else {
      setAvatar(`${process.env.NEXT_PUBLIC_API_BASE_URL}/uploads/${user.avatar}`);
    }
  }, [user]);

  const getInitials = () => {
    if (!isClient || !user) return "U";
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "U";
  };

  const getFullName = () => {
    if (!isClient || !user) return t("header:user");
    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    return fullName || t("header:user");
  };

  const getUserRole = () => user?.role == "SUPER_ADMIN" ? t("header:superAdmin") : user?.role || t("header:admin");

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await onLogout();
      setLogoutModalOpen(false);
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!user) {
    return (
      <div className={`header-user-loading ${className}`}>
        <div className="header-user-loading-avatar"></div>
        <div className="hidden md:block">
          <div className="header-user-loading-text"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className={`header-user-trigger ${className}`}>
            <Avatar className="header-user-avatar">
              <AvatarImage src={avatarSrc} alt={getInitials()} />
              <AvatarFallback className="header-user-avatar-fallback">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="header-user-info">
              <div className="header-user-name">{getFullName()}</div>
            </div>
            <HiChevronDown className="header-user-chevron" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="header-user-dropdown" align="end" sideOffset={6}>
          {/* User Info Header */}
          <div className="header-user-info-header">
            <Avatar className="header-user-info-avatar">
              <AvatarImage src={avatarSrc} alt={getInitials()} />
              <AvatarFallback className="header-user-info-avatar-fallback">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="header-user-info-details">
              <div className="header-user-info-name">{getFullName()}</div>
              <div className="header-user-info-meta">
                <span>{user.email}</span>
                <Badge variant="secondary" className="header-user-info-badge">
                  {getUserRole()}
                </Badge>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="header-user-menu-container">
            {hasOrganizationAccess && (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/settings/profile" className="header-user-menu-item">
                    <div className="header-user-menu-icon-container header-user-menu-icon-container-settings">
                      <HiCog className="header-user-menu-icon-settings" />
                    </div>
                    <div className="header-user-menu-text">{t("header:profile")}</div>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1" />
              </>
            )}

            <DropdownMenuItem
              className="header-user-menu-item"
              onClick={() => setLogoutModalOpen(true)}
              disabled={isLoggingOut}
            >
              <div className="header-user-menu-icon-container header-user-menu-icon-container-logout">
                <RiLogoutCircleRLine className="header-user-menu-icon-logout" />
              </div>
              <div className="header-user-menu-text">
                {isLoggingOut ? t("header:loggingOut") : t("header:logout")}
              </div>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
        title={t("header:confirmLogoutTitle")}
        message={t("header:confirmLogoutMessage")}
        confirmText={t("header:logout")}
        cancelText={t("common:cancel")}
        type="danger"
      />
    </>
  );
}
