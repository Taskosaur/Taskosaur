import Image from "next/image";

interface WorkspaceAvatarProps {
  workspace: string | { name: string; avatar?: string };
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  color?: "primary" | "secondary" | "success" | "danger" | "warning" | "info";
  className?: string;
}

export default function WorkspaceAvatar({
  workspace,
  size = "md",
  color = "primary",
  className = "",
}: WorkspaceAvatarProps) {
  const sizeClasses = {
    xs: "w-4 h-4 text-xs",
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm",
    xl: "w-12 h-12 text-sm",
  };

  const sizeDimensions = {
    xs: { width: 16, height: 16 },
    sm: { width: 24, height: 24 },
    md: { width: 32, height: 32 },
    lg: { width: 40, height: 40 },
    xl: { width: 48, height: 48 },
  };

  const colorClasses = {
    primary: "bg-gradient-to-br from-amber-500 to-orange-600 text-white",
    secondary: "bg-gradient-to-br from-stone-500 to-stone-600 text-white",
    success: "bg-gradient-to-br from-green-500 to-green-600 text-white",
    danger: "bg-gradient-to-br from-red-500 to-red-600 text-white",
    warning: "bg-gradient-to-br from-amber-400 to-yellow-500 text-white",
    info: "bg-gradient-to-br from-blue-500 to-blue-600 text-white",
  };

  const workspaceName = typeof workspace === "string" ? workspace : workspace.name;
  const avatarImage = typeof workspace !== "string" ? workspace.avatar : undefined;

  const getInitial = (name: string) => {
    if (!name) return "W";
    return name.charAt(0).toUpperCase();
  };

  const initial = getInitial(workspaceName);

  return (
    <div
      className={`
        ${sizeClasses[size]} 
        ${colorClasses[color]}
        rounded-lg 
        flex 
        items-center 
        justify-center 
        font-semibold 
        flex-shrink-0
        transition-all
        duration-200
        hover:scale-105
        ${className}
      `}
      title={workspaceName}
    >
      {avatarImage ? (
        <Image
          src={avatarImage}
          alt={workspaceName}
          width={sizeDimensions[size].width}
          height={sizeDimensions[size].height}
          className="h-full w-full rounded-lg object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.parentElement!.textContent = initial;
          }}
        />
      ) : (
        initial
      )}
    </div>
  );
}
