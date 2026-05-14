import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import { HiChevronRight, HiChevronDown, HiViewGrid } from "react-icons/hi";
import { Workspace } from "@/types";
import { useWorkspace } from "@/contexts/workspace-context";
import { cn } from "@/lib/utils";
import { isValidSlug } from "@/utils/slugUtils";
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";

interface TreeNode {
  workspace: Workspace;
  children: TreeNode[];
}

interface WorkspaceTreeProps {
  currentWorkspaceSlug?: string | null;
}

function DraggableTreeItem({
  workspace,
  isCurrent,
  hasChildren,
  isExpanded,
  depth,
  onToggle,
  isOverTarget,
  children,
}: {
  workspace: Workspace;
  isCurrent: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
  depth: number;
  onToggle: (id: string, e: React.MouseEvent) => void;
  isOverTarget: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: workspace.id, data: { workspace } });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: workspace.id,
    data: { workspace },
  });

  const combinedRef = useCallback(
    (el: HTMLElement | null) => {
      setDragRef(el);
      setDropRef(el);
    },
    [setDragRef, setDropRef]
  );

  const showDropHighlight = isOver || isOverTarget;
  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    e.preventDefault();
    e.stopPropagation();
    if (isValidSlug(workspace.slug)) {
      router.push(`/${workspace.slug}`);
    }
  };

  return (
    <div>
      <div
        ref={combinedRef}
        {...attributes}
        {...listeners}
        onClick={handleClick}
        className={cn(
          "layout-sidebar-nav-link",
          isCurrent
            ? "layout-sidebar-nav-link-active"
            : "layout-sidebar-nav-link-inactive",
          isDragging && "opacity-40",
          showDropHighlight &&
          !isDragging &&
          "ring-2 ring-[var(--primary)] ring-inset rounded-md bg-[var(--primary)]/10"
        )}
        style={{
          paddingLeft: `${Math.max(12, depth * 16 + 12)}px`,
          cursor: isDragging ? "grabbing" : "pointer",
          touchAction: "none",
        }}
      >
        <span
          className={cn(
            "layout-sidebar-nav-link-icon flex-shrink-0",
            !hasChildren && "invisible"
          )}
          onClick={(e) => {
            if (hasChildren) {
              e.stopPropagation();
              onToggle(workspace.id, e);
            }
          }}
          onPointerDown={(e) => hasChildren && e.stopPropagation()}
        >
          {isExpanded ? (
            <HiChevronDown className="w-3.5 h-3.5" />
          ) : (
            <HiChevronRight className="w-3.5 h-3.5" />
          )}
        </span>

        <span className="layout-sidebar-nav-link-icon flex-shrink-0">
          <HiViewGrid className="w-4 h-4" />
        </span>

        <span className="layout-sidebar-nav-link-text">{workspace.name}</span>
      </div>

      {isExpanded && hasChildren && children}
    </div>
  );
}

function DragOverlayContent({ workspace }: { workspace: Workspace }) {
  return (
    <div
      className="layout-sidebar-nav-link layout-sidebar-nav-link-active shadow-lg rounded-md"
      style={{ width: 200, pointerEvents: "none" }}
    >
      <span className="layout-sidebar-nav-link-icon flex-shrink-0">
        <HiViewGrid className="w-4 h-4" />
      </span>
      <span className="layout-sidebar-nav-link-text">{workspace.name}</span>
    </div>
  );
}

function isPointerInRect(
  activatorEvent: Event,
  delta: { x: number; y: number },
  element: HTMLElement | null
): boolean {
  if (!element || !(activatorEvent instanceof PointerEvent)) return false;
  const rect = element.getBoundingClientRect();
  const finalX = activatorEvent.clientX + delta.x;
  const finalY = activatorEvent.clientY + delta.y;
  return (
    finalX >= rect.left &&
    finalX <= rect.right &&
    finalY >= rect.top &&
    finalY <= rect.bottom
  );
}

export default function WorkspaceTree({
  currentWorkspaceSlug,
}: WorkspaceTreeProps) {
  const { t } = useTranslation("sidebar");
  const {
    workspaceTree,
    getWorkspaceTree,
    getCurrentOrganizationId,
    updateWorkspace,
  } = useWorkspace();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const fetchedOrgRef = useRef<string | null>(null);
  const getWorkspaceTreeRef = useRef(getWorkspaceTree);
  getWorkspaceTreeRef.current = getWorkspaceTree;

  const rootZoneBottomRef = useRef<HTMLDivElement>(null);
  const orgId = getCurrentOrganizationId();
  useEffect(() => {
    if (orgId && fetchedOrgRef.current !== orgId) {
      fetchedOrgRef.current = orgId;
      getWorkspaceTreeRef.current(orgId).catch(console.error);
    }
  }, [orgId]);

  const tree = useMemo(() => {
    const map = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    workspaceTree.forEach((ws) => {
      map.set(ws.id, { workspace: ws, children: [] });
    });

    workspaceTree.forEach((ws) => {
      const node = map.get(ws.id);
      if (!node) return;

      if (ws.parentWorkspaceId && map.has(ws.parentWorkspaceId)) {
        map.get(ws.parentWorkspaceId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [workspaceTree]);

  // Expand parents if a child is selected
  useEffect(() => {
    if (!currentWorkspaceSlug || !workspaceTree.length) return;

    const currentWs = workspaceTree.find(
      (w) => w.slug === currentWorkspaceSlug
    );
    if (!currentWs || !currentWs.path) return;

    const ancestors = currentWs.path.split("/").filter(Boolean);
    ancestors.pop();

    if (ancestors.length > 0) {
      setExpanded((prev) => {
        const next = { ...prev };
        ancestors.forEach((id) => {
          next[id] = true;
        });
        return next;
      });
    }
  }, [currentWorkspaceSlug, workspaceTree]);

  const toggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const isDescendant = useCallback(
    (parentId: string, childId: string): boolean => {
      const child = workspaceTree.find((w) => w.id === childId);
      if (!child || !child.path) return false;
      return child.path.includes(parentId);
    },
    [workspaceTree]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const ws = event.active.data.current?.workspace as Workspace;
    setActiveWorkspace(ws || null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  }, []);

  const reparentWorkspace = useCallback(
    async (draggedId: string, newParentId: string | null) => {
      try {
        await updateWorkspace(draggedId, {
          parentWorkspaceId: newParentId,
        } as any);
        if (orgId) {
          fetchedOrgRef.current = null;
          getWorkspaceTreeRef.current(orgId).catch(console.error);
        }
      } catch (error) {
        console.error("Failed to reparent workspace:", error);
      }
    },
    [updateWorkspace, orgId]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over, delta, activatorEvent } = event;
      setActiveWorkspace(null);
      setOverId(null);

      const draggedId = active.id as string;
      const dragged = workspaceTree.find((w) => w.id === draggedId);
      if (dragged?.parentWorkspaceId) {
        const onBottom = isPointerInRect(activatorEvent, delta, rootZoneBottomRef.current);
        if (onBottom) {
          await reparentWorkspace(draggedId, null);
          return;
        }
      }

      if (!over || active.id === over.id) return;
      const targetId = over.id as string;
      if (isDescendant(draggedId, targetId)) return;
      if (dragged?.parentWorkspaceId === targetId) return;
      await reparentWorkspace(draggedId, targetId);
    },
    [isDescendant, workspaceTree, reparentWorkspace]
  );

  const handleDragCancel = useCallback(() => {
    setActiveWorkspace(null);
    setOverId(null);
  }, []);

  const renderNode = (node: TreeNode, depth = 0) => {
    const ws = node.workspace;
    const isExpanded = !!expanded[ws.id];
    const isCurrent = currentWorkspaceSlug === ws.slug;
    const hasChildren = node.children.length > 0;
    const isBeingDragged = activeWorkspace?.id === ws.id;

    return (
      <DraggableTreeItem
        key={ws.id}
        workspace={ws}
        isCurrent={isCurrent}
        hasChildren={hasChildren}
        isExpanded={isExpanded && !isBeingDragged}
        depth={depth}
        onToggle={toggleExpand}
        isOverTarget={overId === ws.id && !isBeingDragged}
      >
        {node.children.map((child) => renderNode(child, depth + 1))}
      </DraggableTreeItem>
    );
  };

  if (!tree.length) {
    return (
      <div className="py-2 px-3 text-xs text-[var(--sidebar-muted)] italic">
        {t("noNestedWorkspaces")}
      </div>
    );
  }
  const isSubWorkspaceDragging = !!(activeWorkspace && activeWorkspace.parentWorkspaceId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="relative flex flex-col gap-0.5">
        {tree.map((node) => renderNode(node))}

        <div ref={rootZoneBottomRef}
          className={cn(
            "absolute bottom-0 left-2 right-2 z-10 rounded-md text-[10px] text-center border-2 border-dashed transition-opacity",
            isSubWorkspaceDragging
              ? "py-3 px-3 opacity-100 border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
              : "py-3 px-3 opacity-0 pointer-events-none border-transparent"
          )}
        >
          {t("dropToMakeTopLevel")}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeWorkspace ? (
          <DragOverlayContent workspace={activeWorkspace} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
