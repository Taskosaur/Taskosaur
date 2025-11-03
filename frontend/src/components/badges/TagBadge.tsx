import React from "react";

interface TagBadgeProps {
  tag: string;
  color?: string;
  className?: string;
}

export const TagBadge: React.FC<TagBadgeProps> = ({ tag, color, className }) => {
  if (color) {
    return (
      <span
        className={`tagbadge-base tagbadge-colored ${className || ""}`}
        style={{ backgroundColor: color }}
      >
        {tag}
      </span>
    );
  }

  return <span className={`tagbadge-base tagbadge-default ${className || ""}`}>{tag}</span>;
};
