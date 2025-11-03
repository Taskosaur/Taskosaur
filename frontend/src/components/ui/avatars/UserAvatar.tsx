import Image from "next/image";
import { useState } from "react";

interface UserAvatarProps {
  user:
    | string
    | {
        name?: string;
        firstName?: string;
        lastName?: string;
        avatar?: string;
        id?: string;
      };
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  color?: "primary" | "secondary" | "success" | "danger" | "warning" | "info";
}

export default function UserAvatar({ user, size = "md", color = "primary" }: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const sizeStyles = {
    xs: { width: "1.5rem", height: "1.5rem", fontSize: "0.75rem" },
    sm: { width: "2rem", height: "2rem", fontSize: "0.875rem" },
    md: { width: "2.5rem", height: "2.5rem", fontSize: "1rem" },
    lg: { width: "3rem", height: "3rem", fontSize: "1.125rem" },
    xl: { width: "4rem", height: "4rem", fontSize: "1.5rem" },
  };

  const colorStyles = {
    primary: { backgroundColor: "#3b82f6", color: "#ffffff" },
    secondary: { backgroundColor: "#6b7280", color: "#ffffff" },
    success: { backgroundColor: "#10b981", color: "#ffffff" },
    danger: { backgroundColor: "#ef4444", color: "#ffffff" },
    warning: { backgroundColor: "#f59e0b", color: "#ffffff" },
    info: { backgroundColor: "#06b6d4", color: "#ffffff" },
  };

  const sizeStyle = sizeStyles[size];
  const colorStyle = colorStyles[color];

  const getUserName = () => {
    if (typeof user === "string") {
      return user;
    }

    if (!user) {
      return "User";
    }

    if (user.name) {
      return user.name;
    }

    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }

    if (user.firstName) {
      return user.firstName;
    }

    if (user.lastName) {
      return user.lastName;
    }

    return "User";
  };

  const isValidUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch (error_) {
      return string.startsWith("/");
    }
  };

  const userName = getUserName();
  const initial = userName ? userName.charAt(0).toUpperCase() : "U";
  const avatarImage = typeof user !== "string" && user ? user.avatar : undefined;

  // Only show image if we have a valid URL/path and no error occurred
  const shouldShowImage =
    avatarImage &&
    !imageError &&
    !avatarImage.includes("/api/placeholder") &&
    isValidUrl(avatarImage);
  return (
    <div
      style={{
        ...sizeStyle,
        ...colorStyle,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "500",
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
      }}
      title={userName}
    >
      {shouldShowImage ? (
        <Image
          src={avatarImage}
          alt={userName}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
          }}
          width={100}
          height={100}
          onError={() => setImageError(true)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
