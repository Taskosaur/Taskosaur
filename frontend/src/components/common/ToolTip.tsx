import React, { useState, useRef } from "react";
import PropTypes from "prop-types";
import { createPortal } from "react-dom";

const Tooltip = ({ children, content, position = "top", color = "dark", delay = 300 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (timeoutId) clearTimeout(timeoutId);
    const id = setTimeout(() => {
      if (triggerRef.current) {
        setIsVisible(true);
      }
    }, delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  const colorClasses = {
    dark: "bg-gray-800 text-white",
    light: "bg-gray-100 text-gray-800 border border-gray-300",
    primary: "bg-blue-500 text-white",
    success: "bg-green-500 text-white",
    warning: "bg-yellow-500 text-white",
    danger: "bg-red-500 text-white",
  };

  // Compute positioning
  const getTooltipStyle = () => {
    if (!triggerRef.current) return {};
    const rect = triggerRef.current.getBoundingClientRect();
    const spacing = 8; // gap between tooltip and element

    switch (position) {
      case "top":
        return {
          top: rect.top + window.scrollY - spacing,
          left: rect.left + rect.width / 2 + window.scrollX,
          transform: "translate(-50%, -100%)",
        };
      case "bottom":
        return {
          top: rect.bottom + window.scrollY + spacing,
          left: rect.left + rect.width / 2 + window.scrollX,
          transform: "translate(-50%, 0)",
        };
      case "left":
        return {
          top: rect.top + rect.height / 2 + window.scrollY,
          left: rect.left + window.scrollX - spacing,
          transform: "translate(-100%, -50%)",
        };
      case "right":
        return {
          top: rect.top + rect.height / 2 + window.scrollY,
          left: rect.right + window.scrollX + spacing,
          transform: "translate(0, -50%)",
        };
      default:
        return {};
    }
  };

  return (
    <div
      ref={triggerRef}
      className="inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible &&
        createPortal(
          <div
            className={`fixed z-[9999] px-3 py-2 rounded-md text-sm whitespace-nowrap shadow-lg ${colorClasses[color]}`}
            style={getTooltipStyle()}
          >
            {content}
            <div
              className={`fixed w-2 h-2 transform rotate-45 ${colorClasses[color].split(" ")[0]}`}
              style={{
                ...(position === "top" && { bottom: "-4px", left: "50%", marginLeft: "-4px" }),
                ...(position === "bottom" && { top: "-4px", left: "50%", marginLeft: "-4px" }),
                ...(position === "left" && { right: "-4px", top: "50%", marginTop: "-4px" }),
                ...(position === "right" && { left: "-4px", top: "50%", marginTop: "-4px" }),
              }}
            />
          </div>,
          document.body
        )}
    </div>
  );
};

Tooltip.propTypes = {
  children: PropTypes.node.isRequired,
  content: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  position: PropTypes.oneOf(["top", "bottom", "left", "right"]),
  color: PropTypes.oneOf(["dark", "light", "primary", "success", "warning", "danger"]),
  delay: PropTypes.number,
};

export default Tooltip;
