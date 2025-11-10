import React, { useState, useEffect, useCallback, useMemo } from "react";
import { EditorState, convertToRaw, ContentState } from "draft-js";
import draftToHtml from "draftjs-to-html";
import "draft-js/dist/Draft.css";
import { toast } from "sonner";
import { useTask } from "../../contexts/task-context";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import {
  HiChatBubbleLeftRight,
  HiClock,
  HiPencil,
  HiTrash,
  HiEnvelope,
  HiCheckCircle,
} from "react-icons/hi2";
import { TaskComment, User } from "@/types";
import ActionButton from "../common/ActionButton";
import ConfirmationModal from "../modals/ConfirmationModal";
import { inboxApi } from "@/utils/api/inboxApi";
import { useAuth } from "@/contexts/auth-context";
import { DangerouslyHTMLComment, decodeHtml } from "../common/DangerouslyHTMLComment";
import dynamic from "next/dynamic";
const RichTextEditor = dynamic(() => import("../common/RichTextEditor"), {
  ssr: false,
});

let htmlToDraft: any;
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  htmlToDraft = require("html-to-draftjs").default;
}
interface TaskCommentsProps {
  taskId: string;
  projectId: string;
  allowEmailReplies?: boolean;
  onCommentAdded?: (comment: TaskComment) => void;
  onCommentUpdated?: (commentId: string, content: string) => void;
  onCommentDeleted?: (commentId: string) => void;
  onTaskRefetch?: () => void;
  hasAccess?: boolean;
  setLoading?: (loading: boolean) => void;
}

interface CommentWithAuthor extends TaskComment {
  emailMessageId?: string;
  sentAsEmail?: boolean;
  emailRecipients?: string[];
  emailRecipientNames?: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
}

const CommentItem = React.memo(
  ({
    comment,
    currentUser,
    allowEmailReplies,
    onEdit,
    onDelete,
    onSendAsEmail,
    formatTimestamp,
    colorMode,
    isAuth,
  }: {
    comment: CommentWithAuthor;
    currentUser: User;
    allowEmailReplies?: boolean;
    onEdit: (commentId: string, content: string) => void;
    onDelete: (commentId: string) => void;
    onSendAsEmail?: (commentId: string) => void;
    formatTimestamp: (
      createdAt: string,
      updatedAt: string
    ) => {
      text: string;
      isEdited: boolean;
      fullDate: string;
    };
    colorMode: "light" | "dark";
    isAuth: boolean;
  }) => {
    const [isHovered, setIsHovered] = useState(false);
    const timestamp = useMemo(
      () => formatTimestamp(comment.createdAt, comment.updatedAt),
      [comment.createdAt, comment.updatedAt, formatTimestamp]
    );

    const canEdit = isAuth && comment.authorId === currentUser.id;
    const displayName = useMemo(() => {
      if (comment.emailMessageId && comment.emailRecipientNames) {
        // Join multiple recipient names (e.g. "John, Jane")
        return comment.emailRecipientNames;
      }

      const firstName = comment.author?.firstName?.trim() || "";
      const lastName = comment.author?.lastName?.trim() || "";

      if (firstName || lastName) {
        return `${firstName} ${lastName}`.trim();
      }

      if (comment.author?.email) {
        return comment.author.email.split("@")[0];
      }

      return `User ${comment.author?.id?.slice(0, 8) || "Unknown"}`;
    }, [
      comment.emailMessageId,
      comment.emailRecipientNames,
      comment.author?.firstName,
      comment.author?.lastName,
      comment.author?.email,
      comment.author?.id,
    ]);

    return (
      <div
        className="group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex gap-2 items-start">
          <div className="flex-shrink-0 ">
            {comment.emailMessageId ? (
              <UserAvatar
                user={{
                  name: comment.emailRecipientNames,
                }}
                size="xs"
              />
            ) : (
              <UserAvatar
                user={{
                  firstName: comment.author.firstName,
                  lastName: comment.author.lastName,
                  avatar: comment.author.avatar,
                }}
                size="xs"
              />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2  mt-[3px]">
              <div className="flex items-center gap-2">
                {/* Username */}
                <span className="text-sm font-medium text-[var(--foreground)]">{displayName}</span>

                {/* Edit indicator */}
                {timestamp.isEdited && (
                  <span className="text-[12px] text-[var(--muted-foreground)]">(edited)</span>
                )}

                {canEdit && (
                  <div
                    className={`flex items-center  transition-opacity ${
                      isHovered ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <button
                      onClick={() => onEdit(comment.id, comment.content)}
                      className="p-1 text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)] hover:bg-[var(--muted)]/30 rounded transition-colors"
                      title="Edit comment"
                    >
                      <HiPencil className="size-3" />
                    </button>
                    <button
                      onClick={() => onDelete(comment.id)}
                      className="p-1 text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--destructive)] hover:bg-[var(--muted)]/30 rounded transition-colors"
                      title="Delete comment"
                    >
                      <HiTrash className="size-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Right side: Timestamp and Email indicators */}
              <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)] flex-shrink-0">
                <div className="flex items-center gap-1">
                  <HiClock className="size-2.5" />
                  <span className="cursor-default" title={timestamp.fullDate}>
                    {timestamp.text}
                  </span>
                </div>

                {/* Email indicators */}
                {comment.emailMessageId && (
                  <div
                    className="flex items-center gap-1 text-blue-600 dark:text-blue-400"
                    title="From email"
                  >
                    <HiEnvelope className="size-2.5" />
                    <span>via email</span>
                  </div>
                )}

                {comment.sentAsEmail && (
                  <div
                    className="flex items-center gap-1 text-green-600 dark:text-green-400"
                    title={`Sent as email to: ${
                      comment.emailRecipients?.join(", ") || "recipients"
                    }`}
                  >
                    <HiCheckCircle className="size-2.5" />
                    <span>sent as email</span>
                  </div>
                )}
              </div>
            </div>

            {/* Comment content */}
            <DangerouslyHTMLComment comment={comment.content} />

            {/* Send as Email button - positioned below content */}
            {allowEmailReplies && !comment.sentAsEmail && onSendAsEmail && (
              <div className={`mt-2 transition-opacity ${isHovered ? "opacity-100" : "opacity-0"}`}>
                <button
                  onClick={() => onSendAsEmail(comment.id)}
                  className="text-xs px-2 py-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors flex items-center gap-1"
                  title="Send as email reply"
                >
                  <HiEnvelope className="w-3 h-3" />
                  <span>Send as email</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

CommentItem.displayName = "CommentItem";

export default function TaskComments({
  taskId,
  projectId,
  allowEmailReplies = false,
  onCommentAdded,
  onCommentUpdated,
  onCommentDeleted,
  onTaskRefetch,
  hasAccess = false,
  setLoading,
}: TaskCommentsProps) {
  const { isAuthenticated } = useAuth();
  const isAuth = isAuthenticated();
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");
  const [showAll, setShowAll] = useState(false);
  const INITIAL_DISPLAY_COUNT = 3;

  const { getTaskComments, createTaskComment, updateTaskComment, deleteTaskComment } = useTask();

  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [editorState, setEditorState] = useState(EditorState.createEmpty());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingComments, setLoadingComments] = useState(true);
  const [sendingEmailCommentId, setSendingEmailCommentId] = useState<string | null>(null);

  useEffect(() => {
    const userString = localStorage.getItem("user");
    if (userString) setCurrentUser(JSON.parse(userString));
  }, []);

  const formatTimestamp = useCallback((createdAt: string, updatedAt: string) => {
    if (!createdAt) return { text: "Unknown time", isEdited: false, fullDate: "" };
    const created = new Date(createdAt);
    const updated = new Date(updatedAt);
    const isEdited = updated.getTime() - created.getTime() > 1000;
    const diff = (Date.now() - (isEdited ? updated : created).getTime()) / 1000;
    const mins = Math.floor(diff / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    const timeAgo =
      mins < 1
        ? "just now"
        : mins < 60
          ? `${mins}m ago`
          : hours < 24
            ? `${hours}h ago`
            : `${days}d ago`;
    return {
      text: `${isEdited ? "updated" : "commented"} ${timeAgo}`,
      isEdited,
      fullDate: (isEdited ? updated : created).toLocaleString(),
    };
  }, []);

  useEffect(() => {
    if (!taskId) return;
    const fetchComments = async () => {
      setLoadingComments(true);
      try {
        const taskComments = await getTaskComments(taskId, isAuth);
        setComments(taskComments || []);
      } catch (error) {
        console.error("Failed to fetch comments:", error);
      } finally {
        setLoadingComments(false);
      }
    };
    fetchComments();
  }, [taskId]);

  useEffect(() => {
    if (setLoading) {
      setLoading(loadingComments);
    }
  }, [loadingComments]);

  const refreshComments = useCallback(async () => {
    try {
      const taskComments = await getTaskComments(taskId, isAuth);
      setComments(taskComments || []);
      if (onTaskRefetch) {
        onTaskRefetch();
      }
    } catch (error) {
      console.error("Failed to refresh comments:", error);
    }
  }, [taskId]);

  const handleAddOrEdit = async () => {
    if (!currentUser || isSubmitting) return;

    const htmlContent = draftToHtml(convertToRaw(editorState.getCurrentContent())).trim();
    if (!htmlContent || htmlContent === "<p></p>") return;
    const cleanHtml = decodeHtml(htmlContent);
    setIsSubmitting(true);
    try {
      if (editingCommentId) {
        await updateTaskComment(editingCommentId, currentUser.id, {
          content: htmlContent,
        });
        toast.success("Comment updated successfully");
        onCommentUpdated?.(editingCommentId, cleanHtml);
      } else {
        const createdComment = await createTaskComment({
          taskId,
          authorId: currentUser.id,
          content: cleanHtml,
        });
        toast.success("Comment added successfully");
        onCommentAdded?.(createdComment);
      }
      await refreshComments();
      setEditorState(EditorState.createEmpty());
      setEditingCommentId(null);
    } catch {
      toast.error("Failed to save comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditComment = (id: string, content: string) => {
    const blocksFromHtml = htmlToDraft(content || "");
    const { contentBlocks, entityMap } = blocksFromHtml;
    const contentState = ContentState.createFromBlockArray(contentBlocks, entityMap);
    setEditorState(EditorState.createWithContent(contentState));
    setEditingCommentId(id);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditorState(EditorState.createEmpty());
  };

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

  const handleDeleteComment = (id: string) => {
    setCommentToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDeleteComment = async () => {
    if (!commentToDelete || !currentUser) return;
    try {
      await deleteTaskComment(commentToDelete, currentUser.id);
      toast.success("Comment deleted");
      await refreshComments();
      onCommentDeleted?.(commentToDelete);
    } finally {
      setDeleteModalOpen(false);
      setCommentToDelete(null);
    }
  };

  const handleSendAsEmail = useCallback(
    async (commentId: string) => {
      if (!allowEmailReplies) return;

      setSendingEmailCommentId(commentId);
      try {
        await inboxApi.sendCommentAsEmail(taskId, commentId);
        await refreshComments();
        toast.success("Comment sent as email successfully");
      } catch (error) {
        console.error("Failed to send comment as email:", error);
        toast.error("Failed to send comment as email");
      } finally {
        setSendingEmailCommentId(null);
      }
    },
    [allowEmailReplies, taskId, refreshComments]
  );

  const commentsList = useMemo(() => {
    if (loadingComments) {
      return null;
    }

    const displayedComments = showAll ? comments : comments.slice(0, INITIAL_DISPLAY_COUNT);

    return (
      <div className="space-y-0">
        {comments.length > 0 ? (
          <>
            {displayedComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUser={currentUser!}
                allowEmailReplies={allowEmailReplies}
                onEdit={handleEditComment}
                onDelete={handleDeleteComment}
                onSendAsEmail={handleSendAsEmail}
                formatTimestamp={formatTimestamp}
                colorMode={colorMode}
                isAuth
              />
            ))}
          </>
        ) : (
          <></>
        )}
      </div>
    );
  }, [
    loadingComments,
    comments,
    currentUser,
    handleEditComment,
    handleDeleteComment,
    formatTimestamp,
    colorMode,
    showAll,
  ]);

  const isEditorEmpty = useMemo(() => {
    const contentState = editorState.getCurrentContent();
    const plainText = contentState.getPlainText().trim();
    const hasText = plainText.length > 0;
    const hasContentBlocks = contentState
      .getBlockMap()
      .some((block) => block.getText().trim() !== "");

    return !(hasText || hasContentBlocks);
  }, [editorState]);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-2">
            <div className="p-1 rounded-md">
              <HiChatBubbleLeftRight size={20} className="text-[var(--primary)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[20px] font-semibold text-[var(--foreground)]">Comments</h3>
                {allowEmailReplies && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                    <HiEnvelope className="w-3 h-3" />
                    <span>Email enabled</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {comments.length === 0
                  ? "No comments"
                  : `${comments.length} ${comments.length === 1 ? "comment" : "comments"}`}
              </p>
            </div>
          </div>
        </div>

        {/* Comments List */}
        <div className="space-y-2">
          {commentsList}
          {comments.length > INITIAL_DISPLAY_COUNT && (
            <div className="flex justify-center pt-2">
              <button
                className="text-sm text-[var(--primary)] font-medium py-2 px-4 rounded-md hover:bg-[var(--accent)] cursor-pointer transition"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Show less" : `View (${comments.length - INITIAL_DISPLAY_COUNT} more)`}
              </button>
            </div>
          )}
        </div>

        {/* Draft.js Rich Text Editor */}
        {hasAccess && (
          <div>
            <div className="border border-[var(--border)] rounded-md p-2 bg-[var(--background)]">
              <RichTextEditor
                editorState={editorState}
                onChange={setEditorState}
                placeholder={editingCommentId ? "Edit your comment..." : "Add a comment..."}
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              {editingCommentId && (
                <ActionButton
                  variant="outline"
                  secondary
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                >
                  Cancel
                </ActionButton>
              )}
              <ActionButton
                primary
                onClick={handleAddOrEdit}
                showPlusIcon
                disabled={isSubmitting || isEditorEmpty}
                className="min-w-[193.56px]"
              >
                {isSubmitting ? "Saving..." : editingCommentId ? "Update" : "Add Comment"}
              </ActionButton>
            </div>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDeleteComment}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </>
  );
}
