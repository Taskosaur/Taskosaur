import { ReactNode, useEffect, useState } from "react";
import { RxCross2 } from "react-icons/rx";
import Portal from "./Portal";
import Tooltip from "./ToolTip";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  animation?: "slide-right" | "slide-left" | "fade" | "none";
  top?: string;
  zIndex?: string;
  width?: string;
  height?: string;
  position?: string;
  closeOnOverlayClick?: boolean;
  overlayOpacity?: "light" | "dark" | "none";
}

export function CustomModal({
  isOpen,
  onClose,
  children,
  animation = "slide-right",
  top = "top-0",
  zIndex = "z-50",
  width = "w-full md:w-96",
  height = "h-auto",
  position = "items-center justify-center",
  closeOnOverlayClick = true,
  overlayOpacity = "dark",
}: ModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setTimeout(() => setIsVisible(true), 10);
    } else {
      document.body.style.overflow = "unset";
      setIsVisible(false);
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getAnimationClass = () => {
    if (!isVisible) {
      switch (animation) {
        case "slide-right":
          return "translate-x-full";
        case "slide-left":
          return "-translate-x-full";
        case "fade":
          return "opacity-0";
        default:
          return "";
      }
    }

    switch (animation) {
      case "slide-right":
      case "slide-left":
        return "translate-x-0";
      case "fade":
        return "opacity-100";
      default:
        return "";
    }
  };

  const getTransitionClass = () => {
    switch (animation) {
      case "slide-right":
      case "slide-left":
        return "transition-transform duration-300 ease-out";
      case "fade":
        return "transition-opacity duration-300 ease-out";
      default:
        return "";
    }
  };

  const getOverlayClass = () => {
    switch (overlayOpacity) {
      case "light":
        return "bg-black/30";
      case "dark":
        return "bg-black/60";
      case "none":
        return "bg-transparent";
      default:
        return "bg-black/60";
    }
  };

  return (
    <Portal>
      <div
        className={`fixed inset-0 ${zIndex} flex ${position} py-4 ${getOverlayClass()} ${getTransitionClass()} ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={closeOnOverlayClick ? onClose : undefined}
      >
        <div
          className={`relative ${width} ${height} px-3 max-h-full ${top} ${getTransitionClass()} ${getAnimationClass()} bg-[var(--background)]  shadow-xl flex flex-col pointer-events-auto`}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute -top-8 right-0 pr-3 z-10 w-full h-8 cursor-pointer rounded-none bg-[var(--background)] flex items-end justify-end transition-colors pointer-events-auto"
            aria-label="Close modal"
          >
            <Tooltip content="Close modal" position="left">
              <RxCross2 className="size-[24px]" />
            </Tooltip>
          </button>
          <div className="overflow-y-auto">{children}</div>
        </div>
      </div>
    </Portal>
  );
}
