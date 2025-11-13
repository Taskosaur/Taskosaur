import ActionButton from "@/components/common/ActionButton";
import { useRouter } from "next/router";
import React from "react";

const NotFound = () => {
  const router = useRouter();
  return (
    <div className="flex justify-center items-center pt-[15%]">
      <div className="flex flex-col items-center justify-center p-6 bg-[var(--background)] text-center overflow-hidden">
        <h1 className="text-[8rem] sm:text-[10rem] font-extrabold leading-none text-[var(--primary)] drop-shadow-md">
          404
        </h1>

        <h2 className="mt-4 text-2xl font-bold text-[var(--foreground)]">Oops! Page not found</h2>

        <p className="mt-3 mb-8 max-w-md text-sm sm:text-base text-[var(--muted-foreground)]">
          We can't seem to find the page you're looking for. It might have been moved or deleted.
        </p>

        <ActionButton
          onClick={() => window.location.href = "/dashboard"}
          primary
          className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-5 py-3.5 text-sm font-medium text-[var(--foreground)] shadow-sm hover:bg-[var(--primary)] hover:text-white transition-colors duration-200"
        >
          Back to Home Page
        </ActionButton>
      </div>
    </div>
  );
};

export default NotFound;
