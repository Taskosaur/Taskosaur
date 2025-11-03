import { useState, useCallback } from "react";

interface DragState<T = unknown> {
  isDragging: boolean;
  draggedItem: T | null;
  draggedFrom: string;
  draggedTo: string | null;
}

interface DragCallbacks<T = unknown> {
  onDragStart?: (item: T, from: string) => void;
  onDragEnd?: (item: T | null, from: string, to: string | null) => void;
  onDrop?: (item: T, from: string, to: string) => void;
}

export function useDragAndDrop<T = unknown>(callbacks: DragCallbacks<T> = {}) {
  const [dragState, setDragState] = useState<DragState<T>>({
    isDragging: false,
    draggedItem: null,
    draggedFrom: "",
    draggedTo: null,
  });

  // Extract stable callback references
  const { onDragStart, onDragEnd, onDrop } = callbacks;

  const handleDragStart = useCallback(
    (item: T, from: string) => {
      setDragState({
        isDragging: true,
        draggedItem: item,
        draggedFrom: from,
        draggedTo: null,
      });
      onDragStart?.(item, from);
    },
    [onDragStart]
  );

  const handleDragOver = useCallback((e: React.DragEvent, to: string) => {
    e.preventDefault();
    setDragState((prev) => ({ ...prev, draggedTo: to }));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, to: string) => {
      e.preventDefault();

      setDragState((prevState) => {
        if (prevState.draggedItem && prevState.draggedFrom !== to) {
          onDrop?.(prevState.draggedItem, prevState.draggedFrom, to);
        }

        onDragEnd?.(prevState.draggedItem, prevState.draggedFrom, to);

        return {
          isDragging: false,
          draggedItem: null,
          draggedFrom: "",
          draggedTo: null,
        };
      });
    },
    [onDrop, onDragEnd]
  );

  const handleDragEnd = useCallback(() => {
    setDragState((prevState) => {
      onDragEnd?.(prevState.draggedItem, prevState.draggedFrom, prevState.draggedTo);

      return {
        isDragging: false,
        draggedItem: null,
        draggedFrom: "",
        draggedTo: null,
      };
    });
  }, [onDragEnd]);

  return {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  };
}
