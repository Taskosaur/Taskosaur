// src/components/inbox/shared/Stepper.tsx

import React from "react";
import { HiCheck } from "react-icons/hi2";

interface Step {
  number: number;
  label: string;
  showWhen: boolean;
}

interface StepperProps {
  currentStep: number;
  hasInbox: boolean;
}

export default function Stepper({ currentStep, hasInbox }: StepperProps) {
  const allSteps: Step[] = [
    { number: 1, label: "Inbox Setup", showWhen: true },
    { number: 2, label: "Provider", showWhen: true },
    { number: 3, label: "Success", showWhen: true },

  ];

  const visibleSteps = allSteps.filter((step) => step.showWhen);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between relative">
        {/* Progress Line - calculated based on completed steps */}
        <div className="absolute top-3 left-0 right-0 h-0.5 bg-[var(--border)] z-0">
          <div
            className="h-full bg-[var(--primary)] transition-all duration-500 ease-in-out"
            style={{
              width: `${((visibleSteps.findIndex(step => step.number === currentStep)) / (visibleSteps.length - 1)) * 100}%`,
            }}
          />
        </div>

        {/* Step Items */}
        {/* Step Items with connecting lines */}
        {visibleSteps.map((stepItem, index) => {
          const displayNumber = stepItem.number; // Use actual step number, not sequential
          const isCompleted = currentStep > stepItem.number;
          const isCurrent = currentStep === stepItem.number;
          
          // If this is the first visible step and there are hidden completed steps before it, show as completed
          const hasCompletedHiddenSteps = index === 0 && stepItem.number > 1 && hasInbox;
          const shouldShowAsCompleted = isCompleted || (hasCompletedHiddenSteps && currentStep >= stepItem.number);
          
          return (
            <div
              key={stepItem.label}
              className="flex flex-col items-center relative z-10"
              style={{ flex: 1 }}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs transition-all duration-300 border-2 ${
                  isCompleted
                    ? "bg-[var(--primary)] text-[var(--background)] border-[var(--primary)] shadow-md"
                    : isCurrent
                    ? "bg-[var(--primary)] text-[var(--background)] border-[var(--primary)] shadow-lg scale-110"
                    : "bg-[var(--muted)] text-[var(--primary)] border-[var(--border)]"
                }`}
              >
                {isCompleted ? <HiCheck className="w-4 h-4" /> : displayNumber}
              </div>
              <span
                className={`text-xs font-medium mt-1 transition-colors duration-300 ${
                  isCurrent
                    ? "text-[var(--foreground)]"
                    : isCompleted
                    ? "text-[var(--primary)]"
                    : "text-[var(--muted-foreground)]"
                }`}
              >
                {stepItem.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}