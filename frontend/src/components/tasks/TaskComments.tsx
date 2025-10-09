import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useTask } from "../../contexts/task-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import {
  HiChatBubbleLeftRight,
  HiExclamationTriangle,
  HiClock,
  HiPencil,
  HiTrash,
  HiEnvelope,
  HiCheckCircle
} from 'react-icons/hi2';
import { TaskComment, User } from '@/types';
import ActionButton from '../common/ActionButton';
import ConfirmationModal from '../modals/ConfirmationModal';
import { inboxApi } from '@/utils/api/inboxApi';
import MDEditor from "@uiw/react-md-editor";
import { useAuth } from "@/contexts/auth-context";

interface TaskCommentsProps {
  taskId: string;
  projectId: string;
  allowEmailReplies?: boolean;
  onCommentAdded?: (comment: TaskComment) => void;
  onCommentUpdated?: (commentId: string, content: string) => void;
  onCommentDeleted?: (commentId: string) => void;
  onTaskRefetch?: () => void;
  hasAccess?: boolean;
}

interface CommentWithAuthor extends TaskComment {

  emailMessageId?: string,
  sentAsEmail?: boolean,
  emailRecipients?: string[],
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
}

const CommentItem = React.memo(({
  comment,
  currentUser,
  allowEmailReplies,
  onEdit,
  onDelete,
  onSendAsEmail,
  formatTimestamp, colorMode,
  isAuth
}: {
  comment: CommentWithAuthor;
  currentUser: User;
  allowEmailReplies?: boolean;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  onSendAsEmail?: (commentId: string) => void;
  formatTimestamp: (createdAt: string, updatedAt: string) => {
    text: string;
    isEdited: boolean;
    fullDate: string
  };
  colorMode: "light" | "dark";
  isAuth: boolean
}) => {
  console.log(allowEmailReplies)
  const [isHovered, setIsHovered] = useState(false);
  const timestamp = useMemo(() => 
    formatTimestamp(comment.createdAt, comment.updatedAt), 
    [comment.createdAt, comment.updatedAt, formatTimestamp]
  );
  
  const canEdit = !isAuth && comment.authorId === currentUser.id;
  const displayName = useMemo(() => {
    if (comment.author?.firstName || comment.author?.lastName) {
      return `${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim();
    }
    if (comment.author?.email) {
      return comment.author.email.split('@')[0];
    }
    return `User ${comment.author?.id?.slice(0, 8) || 'Unknown'}`;
  }, [comment.author]);


    const avatarProps = useMemo(
      () => ({
        firstName: comment.author?.firstName || "",
        lastName: comment.author?.lastName || "",
        avatar: comment.author?.avatar,
      }),
      [comment.author]
    );

    return (
      <div
        className="group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex gap-2 items-start">
          <div className="flex-shrink-0 mt-1">
            <UserAvatar user={avatarProps} size="xs" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1 pb-1">
              <div className="flex-1">
                <div className="rounded-xl inline-block">
                  <div className="flex items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-[var(--foreground)]">
                          {displayName}
                        </span>
                        {timestamp.isEdited && (
                          <span className="text-[12px] text-[var(--muted-foreground)] ml-1">
                            (edited)
                          </span>
                        )}
                      </div>
                      <div
                        className="comment-markdown text-[13px] text-[var(--foreground)] leading-relaxed"
                        data-color-mode={colorMode}
                      >
                        <MDEditor.Markdown
                          source={comment.content}
                          style={{
                            backgroundColor: "transparent",
                            fontSize: "13px",
                            color: "var(--foreground)",
                            padding: 0,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Meta info row */}
                <div className="flex items-center gap-1 text-[12px] text-[var(--muted-foreground)]">
                  <HiClock className="size-2.5" />
                  <span className="cursor-default" title={timestamp.fullDate}>
                    {timestamp.text}
                  </span>
                </div>
              </div>
              
              {/* Meta info row */}
              <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)]">
                <div className="flex items-center gap-1">
                  <HiClock className="size-2.5" />
                  <span
                    className="cursor-default"
                    title={timestamp.fullDate}
                  >
                    {timestamp.text}
                  </span>
                </div>

                {/* Email indicators */}
                {comment.emailMessageId && (
                  <div className="flex items-center gap-1 text-blue-600" title="From email">
                    <HiEnvelope className="size-2.5" />
                    <span>via email</span>
                  </div>
                )}

                {comment.sentAsEmail && (
                  <div className="flex items-center gap-1 text-green-600" title={`Sent as email to: ${comment.emailRecipients?.join(', ') || 'recipients'}`}>
                    <HiCheckCircle className="size-2.5" />
                    <span>sent as email</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div
              className={`flex items-center gap-1 transition-opacity ${
                isHovered ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {/* Send as Email button */}
              {allowEmailReplies && !comment.sentAsEmail && onSendAsEmail && (
                <button
                  onClick={() => onSendAsEmail(comment.id)}
                  className="p-1.5 text-[var(--muted-foreground)] cursor-pointer hover:text-blue-600 hover:bg-[var(--muted)]/30 rounded-full transition-colors"
                  title="Send as email reply"
                >
                  <HiEnvelope className="w-3 h-3" />
                </button>
              )}

              {canEdit && (
                <>
                  <button
                    onClick={() => onEdit(comment.id, comment.content)}
                    className="p-1.5 text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)] hover:bg-[var(--muted)]/30 rounded-full transition-colors"
                    title="Edit comment"
                  >
                    <HiPencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDelete(comment.id)}
                    className="p-1.5 text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--destructive)] hover:bg-[var(--muted)]/30 rounded-full transition-colors"
                    title="Delete comment"
                  >
                    <HiTrash className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
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
}: TaskCommentsProps) {
  const { isAuthenticated } = useAuth();
  const isAuth = isAuthenticated();
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");
  const [showAll, setShowAll] = useState(false);
  const INITIAL_DISPLAY_COUNT = 3;

  useEffect(() => {
    if (typeof document !== "undefined") {
      setColorMode(
        document.documentElement.classList.contains("dark") ? "dark" : "light"
      );
    }
  }, []);

  const {
    getTaskComments,
    createTaskComment,
    updateTaskComment,
    deleteTaskComment,
  } = useTask();

  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingComments, setLoadingComments] = useState(true);
  const [sendingEmailCommentId, setSendingEmailCommentId] = useState<string | null>(null);

  // Get current user from localStorage
  useEffect(() => {
    const getUserFromStorage = () => {
      try {
        const userString = localStorage.getItem("user");
        if (userString) {
          const user: User = JSON.parse(userString);
          setCurrentUser(user);
        }
      } catch (error) {
        console.error("Error parsing user from localStorage:", error);
      }
    };
    getUserFromStorage();
  }, []);

  // Format timestamp with smart logic for created vs updated
  const formatTimestamp = useCallback(
    (createdAt: string, updatedAt: string) => {
      if (!createdAt)
        return { text: "Unknown time", isEdited: false, fullDate: "" };

      try {
        const created = new Date(createdAt);
        const updated = new Date(updatedAt);
        const now = new Date();

        const timeDiff = Math.abs(updated.getTime() - created.getTime());
        const isOriginalComment = timeDiff < 1000;

        const timeToUse = isOriginalComment ? created : updated;
        const action = isOriginalComment ? "commented" : "updated";

        const diffInMs = now.getTime() - timeToUse.getTime();
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        let timeAgo;
        if (diffInMinutes < 1) {
          timeAgo = "just now";
        } else if (diffInMinutes < 60) {
          timeAgo = `${diffInMinutes}m ago`;
        } else if (diffInHours < 24) {
          timeAgo = `${diffInHours}h ago`;
        } else if (diffInDays < 7) {
          timeAgo = `${diffInDays}d ago`;
        } else {
          timeAgo = timeToUse.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year:
              timeToUse.getFullYear() !== now.getFullYear()
                ? "numeric"
                : undefined,
          });
        }

        return {
          text: `${action} ${timeAgo}`,
          isEdited: !isOriginalComment,
          fullDate: timeToUse.toLocaleString(),
        };
      } catch {
        return { text: "Unknown time", isEdited: false, fullDate: "" };
      }
    },
    []
  );

  // Fetch comments when component mounts or taskId changes
  useEffect(() => {
    if (!taskId) return;

    const fetchComments = async () => {
      setLoadingComments(true);
      try {
        const taskComments = await getTaskComments(taskId, isAuth);
        setComments(taskComments || []);
      } catch (error) {
        console.error("Failed to fetch comments:", error);
        setComments([]);
      } finally {
        setLoadingComments(false);
      }
    };

    fetchComments();
  }, [taskId]);

  const refreshComments = useCallback(async () => {
    try {
      const taskComments = await getTaskComments(taskId, isAuth);
      setComments(taskComments || []);
      if (onTaskRefetch) {
        await onTaskRefetch();
      }
    } catch (error) {
      console.error("Failed to refresh comments:", error);
    }
  }, [taskId, getTaskComments, onTaskRefetch]);

  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || isSubmitting || !currentUser) return;

    setIsSubmitting(true);
    try {
      const commentData = {
        content: newComment.trim(),
        taskId,
        authorId: currentUser.id,
      };

      const createdComment = await createTaskComment(commentData);
      await refreshComments();
      setNewComment("");
      onCommentAdded?.(createdComment);
      toast.success("Comment added successfully");
    } catch (error) {
      console.error("Failed to add comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    newComment,
    isSubmitting,
    currentUser,
    taskId,
    createTaskComment,
    refreshComments,
    onCommentAdded,
  ]);

  const handleEditComment = useCallback(
    (commentId: string, content: string) => {
      setEditingCommentId(commentId);
      setEditingContent(content);
      setNewComment("");
    },
    []
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editingContent.trim() || !currentUser || !editingCommentId) return;

    setIsSubmitting(true);
    try {
      await updateTaskComment(editingCommentId, currentUser.id, {
        content: editingContent.trim(),
      });
      await refreshComments();
      setEditingCommentId(null);
      setEditingContent("");
      onCommentUpdated?.(editingCommentId, editingContent.trim());
      toast.success("Comment updated successfully");
    } catch (error) {
      toast.error("Failed to update comment");
      console.error("Failed to edit comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    editingCommentId,
    editingContent,
    currentUser,
    updateTaskComment,
    refreshComments,
    onCommentUpdated,
  ]);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

  const handleDeleteComment = useCallback((commentId: string) => {
    setCommentToDelete(commentId);
    setDeleteModalOpen(true);
  }, []);

  const confirmDeleteComment = useCallback(async () => {
    if (!commentToDelete || !currentUser) return;
    try {
      await deleteTaskComment(commentToDelete, currentUser.id);
      await refreshComments();
      onCommentDeleted?.(commentToDelete);
      toast.success("Comment deleted successfully");
    } catch (error) {
      console.error("Failed to delete comment:", error);
      toast.error("Failed to delete comment");
    } finally {
      setDeleteModalOpen(false);
      setCommentToDelete(null);
    }
  }, [
    commentToDelete,
    currentUser,
    deleteTaskComment,
    refreshComments,
    onCommentDeleted,
  ]);

  const handleCancelEdit = useCallback(() => {
    setEditingCommentId(null);
    setEditingContent("");
  }, []);

  const handleSendAsEmail = useCallback(async (commentId: string) => {
    if (!allowEmailReplies) return;

    setSendingEmailCommentId(commentId);
    try {
      await inboxApi.sendCommentAsEmail(taskId, commentId);
      await refreshComments();
      toast.success('Comment sent as email successfully');
    } catch (error) {
      console.error('Failed to send comment as email:', error);
      toast.error('Failed to send comment as email');
    } finally {
      setSendingEmailCommentId(null);
    }
  }, [allowEmailReplies, taskId, refreshComments]);

  // Memoize comments list to prevent unnecessary re-renders
  const commentsList = useMemo(() => {
    if (loadingComments) {
      return (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-2 animate-pulse py-2">
              <div className="w-8 h-8 bg-[var(--muted)] rounded-full flex-shrink-0 mt-1" />
              <div className="flex-1 space-y-2">
                <div className="bg-[var(--muted)]/30 rounded-xl p-3">
                  <div className="h-3 bg-[var(--muted)] rounded w-1/4 mb-2" />
                  <div className="h-4 bg-[var(--muted)] rounded w-3/4" />
                </div>
                <div className="h-2 bg-[var(--muted)] rounded w-16 ml-1" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    const displayedComments = showAll
      ? comments
      : comments.slice(0, INITIAL_DISPLAY_COUNT);

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
            {/* View More / Show Less Button */}
            {comments.length > INITIAL_DISPLAY_COUNT && (
              <div className="flex justify-center pt-2">
                {!showAll ? (
                  <button
                    className="text-sm text-[var(--primary)] font-medium py-2 px-4 rounded-md hover:bg-[var(--accent)] focus:outline-none cursor-pointer transition-colors"
                    onClick={() => setShowAll(true)}
                  >
                    View more ({comments.length - INITIAL_DISPLAY_COUNT} more)
                  </button>
                ) : (
                  <button
                    className="text-sm text-[var(--primary)] font-medium py-2 px-4 rounded-md hover:bg-[var(--accent)] focus:outline-none cursor-pointer transition-colors"
                    onClick={() => setShowAll(false)}
                  >
                    Show less
                  </button>
                )}
              </div>
            )}
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

  // if (!currentUser) {
  //   return (
  //     <Alert className="bg-[var(--muted)]/50 border-[var(--border)] text-[var(--muted-foreground)]">
  //       <HiExclamationTriangle className="h-4 w-4" />
  //       <AlertDescription>
  //         Please log in to view and add comments.
  //       </AlertDescription>
  //     </Alert>
  //   );
  // }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-2">
            <div className="p-1 rounded-md">
              <HiChatBubbleLeftRight
                size={20}
                className="text-[var(--primary)]"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  Comments
                </h3>
                {allowEmailReplies && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-xs">
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
        {commentsList}

        {/* Unified Comment Form - Add/Edit */}
        {hasAccess && (
          <div>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="relative" data-color-mode={colorMode}>
                  <MDEditor
                    value={editingCommentId ? editingContent : newComment}
                    onChange={(val) =>
                      editingCommentId
                        ? setEditingContent(val || "")
                        : setNewComment(val || "")
                    }
                    hideToolbar={false}
                    className="task-md-editor"
                    textareaProps={{
                      placeholder: editingCommentId
                        ? "Edit your comment..."
                        : "Add a comment...",
                      className:
                        "bg-[var(--background)] text-[var(--foreground)] border-none focus:outline-none",
                      disabled: isSubmitting,
                    }}
                    height={200}
                    preview="edit"
                    visibleDragbar={false}
                    commandsFilter={(command) =>
                      command && command.name === "live" ? false : command
                    }
                  />
                </div>
                <div className="flex justify-end gap-2 mt-2 cursor-pointer">
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
                    showPlusIcon
                    secondary
                    onClick={
                      editingCommentId ? handleSaveEdit : handleAddComment
                    }
                    disabled={
                      isSubmitting ||
                      (editingCommentId
                        ? !editingContent.trim()
                        : !newComment.trim())
                    }
                  >
                    {isSubmitting
                      ? "Posting..."
                      : editingCommentId
                      ? "Update"
                      : "Add Comment"}
                  </ActionButton>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setCommentToDelete(null);
        }}
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
