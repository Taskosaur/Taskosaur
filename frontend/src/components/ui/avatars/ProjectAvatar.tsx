import Image from "next/image";

interface ProjectAvatarProps {
  project: string | { name: string; avatar?: string };
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  color?: "primary" | "secondary" | "success" | "danger" | "warning" | "info";
  className?: string;
}

export default function ProjectAvatar({
  project,
  size = "md",
  color = "secondary",
  className = "",
}: ProjectAvatarProps) {
  const sizeClass = `project-avatar-${size}`;
  const colorClass = `project-avatar-${color}`;

  const projectName = typeof project === "string" ? project : project.name;
  const initial = projectName.charAt(0).toUpperCase();
  const avatarImage = typeof project !== "string" ? project.avatar : undefined;

  return (
    <div className={`project-avatar ${sizeClass} ${colorClass} ${className}`}>
      {avatarImage ? (
        <Image
          src={avatarImage}
          alt={projectName}
          className="h-full w-full rounded-lg object-cover"
          width={100}
          height={100}
        />
      ) : (
        initial
      )}
    </div>
  );
}
