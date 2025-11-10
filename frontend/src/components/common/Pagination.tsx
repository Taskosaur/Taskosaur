import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface PaginationProps {
  pagination: PaginationInfo;
  pageSize: number;
  onPageSizeChange?: (size: number) => void;
  onPageChange: (page: number) => void;
  /** The noun for the items being paginated, e.g., "tasks", "projects" */
  itemType?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  pagination,
  pageSize,
  onPageSizeChange,
  onPageChange,
  itemType = "items", // Default to "items" if not provided
}) => (
  <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
    <div className="text-sm text-[var(--muted-foreground)]">
      Showing {(pagination.currentPage - 1) * pageSize + 1} to{" "}
      {Math.min(pagination.currentPage * pageSize, pagination.totalCount)} of{" "}
      {pagination.totalCount} {itemType}
    </div>
    <div className="flex items-center gap-2">
      {onPageSizeChange && (
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SelectTrigger className="w-20 border-none bg-[var(--card)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-none bg-[var(--popover)]">
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
      )}
      <Button
        variant="outline"
        size="sm"
        className="border-none bg-[var(--card)]"
        onClick={() => onPageChange(Math.max(1, pagination.currentPage - 1))}
        disabled={!pagination.hasPrevPage}
      >
        <HiChevronLeft size={16} />
      </Button>
      <span className="text-sm text-[var(--muted-foreground)] px-2">
        Page {pagination.currentPage} of {pagination.totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="border-none bg-[var(--card)]"
        onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.currentPage + 1))}
        disabled={!pagination.hasNextPage}
      >
        <HiChevronRight size={16} />
      </Button>
    </div>
  </div>
);

export default Pagination;
