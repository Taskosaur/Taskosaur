import React from "react";

import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Skeleton } from "../ui/skeleton";

const TaskTableSkeleton = () => {
  return (
    <Table>
      <TableBody>
        {Array.from({ length: 10 }).map((_, i) => (
          <TableRow
            key={i}
            className="h-12 odd:bg-[var(--odd-row)] animate-pulse border-[var(--border)]"
          >
            {/* Task title + icon + comments */}
            <TableCell className="tasktable-cell-task">
              <div className="flex items-start gap-3">
                <Skeleton className="w-6 h-6 rounded-md mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-4 w-10 rounded" />
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <Skeleton className="h-3 w-12 rounded" />
                  </div>
                </div>
              </div>
            </TableCell>
            {/* Priority */}
            <TableCell className="tasktable-cell">
              <Skeleton className="h-5 w-20 rounded-full" />
            </TableCell>

            {/* Status */}
            <TableCell className="tasktable-cell">
              <Skeleton className="h-5 w-20 rounded-full" />
            </TableCell>

            {/* Assignees */}
            <TableCell className="tasktable-cell-assignee w-32 min-w-[64px] max-w-[96px] text-center align-middle">
              <div className="flex justify-center -space-x-2">
                <Skeleton className="w-6 h-6 rounded-full" />
                <Skeleton className="w-6 h-6 rounded-full" />
                <Skeleton className="w-6 h-6 rounded-full" />
              </div>
            </TableCell>

            {/* Due date */}
            <TableCell className="tasktable-cell-date">
              <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4 rounded" />
                <Skeleton className="h-4 w-20 rounded" />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default TaskTableSkeleton;
