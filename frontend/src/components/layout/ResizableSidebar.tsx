import React, { useState, useRef, useEffect, useCallback } from "react";
import { getSidebarWidth, setSidebarWidth } from "@/utils/sidebarUtils";

interface ResizableSidebarProps {
  children: React.ReactNode;
  className?: string;
  minWidth?: number;
  maxWidth?: number;
}

export default function ResizableSidebar({
  children,
  className = "",
  minWidth = 200,
  maxWidth = 400,
}: ResizableSidebarProps) {
  // Initialize with saved width or default
  const [width, setWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return getSidebarWidth();
    }
    return 260; // Default width for SSR
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  // Load saved width on component mount
  useEffect(() => {
    const savedWidth = getSidebarWidth();
    if (savedWidth !== width) {
      setWidth(savedWidth);
    }
  }, []);

  // Listen for width changes from other components
  useEffect(() => {
    const handleSidebarWidthChange = (event: CustomEvent) => {
      setWidth(event.detail.width);
    };

    window.addEventListener("sidebarWidthChange", handleSidebarWidthChange as EventListener);

    return () => {
      window.removeEventListener("sidebarWidthChange", handleSidebarWidthChange as EventListener);
    };
  }, []);

  // Handle mouse down on resize handle
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }, []);

  // Handle mouse move while dragging
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging && sidebarRef.current) {
        const sidebarRect = sidebarRef.current.getBoundingClientRect();
        const newWidth = e.clientX - sidebarRect.left;

        // Apply min and max constraints
        const constrainedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);

        setWidth(constrainedWidth);
      }
    },
    [isDragging, minWidth, maxWidth]
  );

  // Handle mouse up to stop resizing
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      // Save the new width to localStorage
      setSidebarWidth(width);
    }
  }, [isDragging, width]);

  // Attach and remove event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={sidebarRef}
      className={`layout-resizable-sidebar-container ${className}`}
      style={{ width: `${width}px` }}
    >
      {children}

      {/* Resize handle */}
      <div
        ref={resizeHandleRef}
        className="layout-resizable-sidebar-handle group"
        onMouseDown={handleMouseDown}
      >
        <div className="layout-resizable-sidebar-handle-extend"></div>
        <div className="layout-resizable-sidebar-handle-indicator"></div>
      </div>
    </div>
  );
}
