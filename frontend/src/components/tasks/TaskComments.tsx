import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { ShadowDomHtmlRenderer } from "@/components/common/ShadowDomHtmlRenderer";
import { SafeMarkdownRenderer } from "@/components/common/SafeMarkdownRenderer";
import { sanitizeEditorContent } from "@/utils/sanitize-content";
import { inboxApi } from "@/utils/api/inboxApi";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "next-themes";
import DualModeEditor from "@/components/common/DualModeEditor";

/**
 * Detects if content is rich text HTML (from Draft.js or similar editors)
 * vs markdown content that might contain some inline HTML
 */
const isRichTextHtml = (content: string): boolean => {
  if (!content || typeof content !== "string") return false;

  // Trim whitespace
  const trimmed = content.trim();

  // Check if content starts with an HTML block tag (Draft.js always wraps content in block tags)
  // This catches Draft.js output like <p>text</p>, <h1>heading</h1>, etc.
  const startsWithBlockTag = /^<(p|div|h[1-6]|ul|ol|li|blockquote|pre|table)[^>]*>/i.test(trimmed);

  // Check if content ends with a closing HTML block tag
  const endsWithBlockTag = /<\/(p|div|h[1-6]|ul|ol|li|blockquote|pre|table)>\s*$/i.test(trimmed);

  // Check for inline HTML formatting tags (strong, em, etc.) which indicate rich text
  const hasInlineFormatting = /<(strong|em|b|i|u|s|del|strike|span|a|code)[^>]*>/i.test(trimmed);

  // Check for <br> tags (common in rich text)
  const hasBrTags = /<br\s*\/?>/i.test(trimmed);

  // It's HTML if:
  // - Starts AND ends with block tags (typical Draft.js output), OR
  // - Starts with block tag AND has inline formatting, OR
  // - Starts with block tag AND has <br> tags
  return (startsWithBlockTag && endsWithBlockTag) ||
         (startsWithBlockTag && hasInlineFormatting) ||
         (startsWithBlockTag && hasBrTags);
};
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

    const isEmailOrRichText = useMemo(() => 
      Boolean(comment.emailMessageId || isRichTextHtml(comment.content)), 
    [comment.emailMessageId, comment.content]);

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
            {isEmailOrRichText ? (
              <div className="mt-1">
                <ShadowDomHtmlRenderer content={comment.content} />
              </div>
            ) : (
              <div className="prose prose-sm max-w-none bg-[var(--background)] text-sm text-[var(--foreground)] p-2 rounded-md border border-[var(--border)] mt-1">
                <div className="markdown-content">
                  <SafeMarkdownRenderer content={comment.content} />
                </div>
              </div>
            )}

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
  
  // Pagination configuration
  const OLDEST_COUNT = 2; // Number of oldest comments to always show
  const NEWEST_COUNT = 2; // Number of newest comments to always show
  const LOAD_MORE_BATCH_SIZE = 5; // Number of comments to load per "View more" click
  
  // Track how many middle comments are currently visible
  const [visibleMiddleCount, setVisibleMiddleCount] = useState(0);

  const { getTaskComments, createTaskComment, updateTaskComment, deleteTaskComment } = useTask();
  const { resolvedTheme } = useTheme();

  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [commentContent, setCommentContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingComments, setLoadingComments] = useState(true);
  const [sendingEmailCommentId, setSendingEmailCommentId] = useState<string | null>(null);

  const [splitIndex, setSplitIndex] = useState(0); // Tracks where top comments end and bottom start

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalComments, setTotalComments] = useState(0);
  const [amountRemaining, setAmountRemaining] = useState(0); // Track exact remaining from backend
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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
        // Fetch with 'middle' pagination
        const result = await getTaskComments(taskId, isAuth, { 
          page: 1, 
          paginationType: 'middle',
          limit: LOAD_MORE_BATCH_SIZE, // Not used for page 1 logic in backend for counts, but good to pass
          oldestCount: OLDEST_COUNT,
          newestCount: NEWEST_COUNT
        });
        
        // Type guard to check if result is paginated response
        if (typeof result === 'object' && 'data' in result) {
          setComments(result.data || []);
          setCurrentPage(result.page);
          setTotalPages(result.totalPages);
          setHasMore(result.hasMore);
          setTotalComments(result.total);
          
          // initial split index
          const initialCount = result.data.length;
          if (result.total <= OLDEST_COUNT + NEWEST_COUNT) {
             setSplitIndex(initialCount);
             setAmountRemaining(0);
          } else {
             setSplitIndex(OLDEST_COUNT);
             // Remaining = Total - (Oldest + Newest)
             setAmountRemaining(result.total - (OLDEST_COUNT + NEWEST_COUNT));
          }

        } else {
          // Fallback
          setComments(result || []);
          setSplitIndex((result || []).length);
        }
        
        setVisibleMiddleCount(0);
      } catch (error) {
        console.error("Failed to fetch comments:", error);
      } finally {
        setLoadingComments(false);
      }
    };
    fetchComments();
  }, [taskId, isAuth]); 

  useEffect(() => {
    if (setLoading) {
      setLoading(loadingComments);
    }
  }, [loadingComments]);

  const refreshComments = useCallback(async () => {
    try {
      // If user hasn't loaded any middle comments yet, just do initial fetch
      if (currentPage === 1) {
        const result = await getTaskComments(taskId, isAuth, { 
          page: 1, 
          paginationType: 'middle',
          limit: LOAD_MORE_BATCH_SIZE,
          oldestCount: OLDEST_COUNT,
          newestCount: NEWEST_COUNT
        });
        
        if (typeof result === 'object' && 'data' in result) {
          setComments(result.data || []);
          setTotalPages(result.totalPages);
          setHasMore(result.hasMore);
          setTotalComments(result.total);
          
          const initialCount = result.data.length;
          if (result.total <= OLDEST_COUNT + NEWEST_COUNT) {
            setSplitIndex(initialCount);
            setAmountRemaining(0);
          } else {
            setSplitIndex(OLDEST_COUNT);
            setAmountRemaining(result.total - (OLDEST_COUNT + NEWEST_COUNT));
          }
        }
      } else {
        // User has expanded middle comments - preserve their view by fetching all pages up to current
        const firstPage = await getTaskComments(taskId, isAuth, { 
          page: 1, 
          paginationType: 'middle',
          limit: LOAD_MORE_BATCH_SIZE,
          oldestCount: OLDEST_COUNT,
          newestCount: NEWEST_COUNT
        });
        
        if (typeof firstPage === 'object' && 'data' in firstPage) {
          let allComments = [...firstPage.data];
          let currentSplitIndex = OLDEST_COUNT;
          
          // Fetch all middle pages that were previously loaded
          for (let page = 2; page <= currentPage; page++) {
            const middlePage = await getTaskComments(taskId, isAuth, { 
              page, 
              paginationType: 'middle',
              limit: LOAD_MORE_BATCH_SIZE,
              oldestCount: OLDEST_COUNT,
              newestCount: NEWEST_COUNT
            });
            
            if (typeof middlePage === 'object' && 'data' in middlePage) {
              // Insert at split index
              const before = allComments.slice(0, currentSplitIndex);
              const after = allComments.slice(currentSplitIndex);
              allComments = [...before, ...middlePage.data, ...after];
              currentSplitIndex += middlePage.data.length;
            }
          }
          
          setComments(allComments);
          setSplitIndex(currentSplitIndex);
          setTotalPages(firstPage.totalPages);
          setHasMore(firstPage.hasMore && currentPage < firstPage.totalPages);
          setTotalComments(firstPage.total);
          setAmountRemaining(Math.max(0, firstPage.total - (OLDEST_COUNT + NEWEST_COUNT) - (currentPage - 1) * LOAD_MORE_BATCH_SIZE));
        }
      }
      
      if (onTaskRefetch) {
        onTaskRefetch();
      }
    } catch (error) {
      console.error("Failed to refresh comments:", error);
    }
  }, [taskId, isAuth, currentPage, getTaskComments, OLDEST_COUNT, NEWEST_COUNT, LOAD_MORE_BATCH_SIZE, onTaskRefetch]);

  const loadMoreComments = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      const result = await getTaskComments(taskId, isAuth, { 
        page: currentPage + 1, 
        limit: LOAD_MORE_BATCH_SIZE,
        paginationType: 'middle',
        oldestCount: OLDEST_COUNT,
        newestCount: NEWEST_COUNT
      });
      
      // Type guard to check if result is paginated response
      if (typeof result === 'object' && 'data' in result) {
        // Insert new middle comments at splitIndex
        setComments(prev => {
          const before = prev.slice(0, splitIndex);
          const after = prev.slice(splitIndex);
          return [...before, ...result.data, ...after];
        });
        
        // Update split index to include the newly added middle comments
        setSplitIndex(prev => prev + result.data.length);
        
        // Update pagination tracking
        setCurrentPage(result.page);
        setTotalPages(result.totalPages);
        setHasMore(result.hasMore);
        setTotalComments(result.total);
        
        // Update remaining count
        // We loaded `result.data.length`.
         setAmountRemaining(prev => Math.max(0, prev - result.data.length));
      }
    } catch (error) {
      console.error("Failed to load more comments:", error);
      toast.error("Failed to load more comments");
    } finally {
      setIsLoadingMore(false);
    }
  }, [taskId, isAuth, currentPage, hasMore, isLoadingMore, LOAD_MORE_BATCH_SIZE, getTaskComments, splitIndex, OLDEST_COUNT, NEWEST_COUNT]);

  const handleAddOrEdit = async () => {
    if (!currentUser || isSubmitting) return;

    const trimmedContent = commentContent.trim();
    if (!trimmedContent) return;
    
    // Sanitize content before sending to backend
    const sanitizedContent = sanitizeEditorContent(trimmedContent);
    if (!sanitizedContent) {
      toast.error('Comment content is invalid or contains unsafe markup');
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (editingCommentId) {
        // Find original comment to compare content
        const originalComment = comments.find(c => c.id === editingCommentId);
        if (originalComment && originalComment.content === sanitizedContent) {
          toast.info("No changes made");
          setCommentContent("");
          setEditingCommentId(null);
          setIsSubmitting(false);
          return;
        }

        const updatedComment = await updateTaskComment(editingCommentId, currentUser.id, {
          content: sanitizedContent,
        });
        
        // Update comment in place without refreshing
        setComments(prev => prev.map(c => 
          c.id === editingCommentId 
            ? { ...c, content: sanitizedContent, updatedAt: updatedComment.updatedAt }
            : c
        ));
        
        toast.success("Comment updated successfully");
        onCommentUpdated?.(editingCommentId, sanitizedContent);
      } else {
        const createdComment = await createTaskComment({
          taskId,
          authorId: currentUser.id,
          content: sanitizedContent,
        });
        
        // Append new comment to the end (newest position)
        setComments(prev => [...prev, createdComment]);
        setTotalComments(prev => prev + 1);
        
        // Recalculate amountRemaining if we're in paginated mode
        if (totalComments > OLDEST_COUNT + NEWEST_COUNT) {
          setAmountRemaining(prev => prev + 1);
        }
        
        toast.success("Comment added successfully");
        onCommentAdded?.(createdComment);
      }
      
      // Trigger parent refetch if needed (for task comment count, etc.)
      if (onTaskRefetch) {
        onTaskRefetch();
      }
      setCommentContent("");
      setEditingCommentId(null);
    } catch {
      toast.error("Failed to save comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditComment = (id: string, content: string) => {
    setCommentContent(content || "");
    setEditingCommentId(id);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setCommentContent("");
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
      
      // Find the index of deleted comment to adjust splitIndex if needed
      const deletedIndex = comments.findIndex(c => c.id === commentToDelete);
      
      // Remove comment from array
      setComments(prev => prev.filter(c => c.id !== commentToDelete));
      setTotalComments(prev => prev - 1);
      
      // Adjust splitIndex if the deleted comment was in the top section
      if (deletedIndex !== -1 && deletedIndex < splitIndex) {
        setSplitIndex(prev => Math.max(0, prev - 1));
      }
      
      // Adjust amountRemaining if we're in paginated mode
      if (totalComments > OLDEST_COUNT + NEWEST_COUNT) {
        // If deleted from middle section (not yet loaded), decrease remaining
        if (deletedIndex >= OLDEST_COUNT && deletedIndex < splitIndex) {
          setAmountRemaining(prev => Math.max(0, prev - 1));
        }
      }
      
      toast.success("Comment deleted");
      onCommentDeleted?.(commentToDelete);
      
      // Trigger parent refetch if needed
      if (onTaskRefetch) {
        onTaskRefetch();
      }
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

    if (comments.length === 0) {
      return <></>;
    }

    // No need to reverse, comments are maintained in correct order (oldest -> newest) in the state
    
    const topComments = comments.slice(0, splitIndex);
    const bottomComments = comments.slice(splitIndex);

    return (
      <div className="space-y-0">
        {topComments.map((comment) => (
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

        {/* View more button for middle comments */}
        {amountRemaining > 0 && (
          <div className="flex justify-center py-3">
            <button
              className="text-sm text-[var(--primary)] font-medium py-2 px-4 rounded-md hover:bg-[var(--accent)] cursor-pointer transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={loadMoreComments}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <span>Loading...</span>
              ) : (
                <>
                  <span>View {Math.min(LOAD_MORE_BATCH_SIZE, amountRemaining)} more comment{Math.min(LOAD_MORE_BATCH_SIZE, amountRemaining) > 1 ? 's' : ''}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">({amountRemaining} remaining)</span>
                </>
              )}
            </button>
          </div>
        )}

        {bottomComments.map((comment) => (
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
      </div>
    );
  }, [
    loadingComments,
    comments, // Array changes when we append
    splitIndex, // Tracks split point
    amountRemaining,
    isLoadingMore,
    currentUser,
    handleEditComment,
    handleDeleteComment,
    formatTimestamp,
    colorMode,
    allowEmailReplies,
    handleSendAsEmail,
    loadMoreComments,
    LOAD_MORE_BATCH_SIZE
  ]);


  const isEditorEmpty = useMemo(() => {
    return !commentContent.trim();
  }, [commentContent]);

  useEffect(() => {
    if (resolvedTheme) {
      setColorMode(resolvedTheme as "light" | "dark");
    }
  }, [resolvedTheme]);

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
                  : `${totalComments} ${comments.length === 1 ? "comment" : "comments"}`}
              </p>
            </div>
          </div>
        </div>

        {/* Comments List */}
        <div className="space-y-2">
          {commentsList}
        </div>

        {/* Dual Mode Editor (Markdown / Rich Text) */}
        {hasAccess && (
          <div>
            <DualModeEditor
              value={commentContent}
              onChange={(val) => setCommentContent(val || "")}
              placeholder={editingCommentId ? "Edit your comment..." : "Add a comment..."}
              height={200}
              colorMode={colorMode}
              disabled={isSubmitting}
            />
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
