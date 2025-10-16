import React from "react";
import { Button } from "@/components/ui/button";
import { HiOutlineExclamationCircle, HiHome } from "react-icons/hi2";
import { RotateCcw } from "lucide-react";

interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => (
  <div className="pt-[20%] bg-[var(--background)] flex flex-col items-center justify-center px-6 text-center">
    <div className="animate-fadeIn">
      {/* Icon */}
      <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center rounded-full bg-[var(--destructive)]/20 text-[var(--destructive)] shadow-md">
        <HiOutlineExclamationCircle size={36} />
      </div>

      {/* Title */}
      <h1 className="text-md font-bold text-[var(--foreground)] mb-3">
        Error: {error || "An unexpected error occurred. Please try again"}
      </h1>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {onRetry && (
          <Button
            onClick={onRetry}
            className="sm:w-auto w-full flex items-center justify-center gap-2"
          >
            <RotateCcw />
            Retry
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => (window.location.href = "/dashboard")}
          className="sm:w-auto w-full flex items-center justify-center gap-2 border-[var(--border)]"
        >
          <HiHome size={18} /> Go To Dashboard
        </Button>
      </div>
    </div>
  </div>
);

export default ErrorState;
