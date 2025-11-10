import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { HiMagnifyingGlass, HiXMark } from "react-icons/hi2";
import { Button } from "../ui";
import Tooltip from "../common/ToolTip";
import { useOrganization } from "@/contexts/organization-context";
import { TokenManager } from "@/lib/api";
import { useRouter } from "next/router";

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const SearchManager = () => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  // Context variables
  const { universalSearch } = useOrganization();
  const currentOrganizationId = TokenManager.getCurrentOrgId();
  const PAGE_SIZE = 10;

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const paginatedResults = results;
  const totalPages = Math.ceil(totalResults / PAGE_SIZE);

  // Fetch results with debounced search term and page
  useEffect(() => {
    const fetchResults = async () => {
      const trimmed = debouncedSearchTerm.trim();
      if (trimmed === "" || !currentOrganizationId) {
        setResults([]);
        setSelectedIndex(0);
        setError(null);
        setTotalResults(0);
        return;
      }
      if (trimmed.length < 2) {
        setResults([]);
        setSelectedIndex(0);
        setError("Query must be at least 2 characters long");
        setTotalResults(0);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await universalSearch(trimmed, currentOrganizationId, page, PAGE_SIZE);
        setResults(response?.results || []);
        setTotalResults(response?.total || (response?.results?.length ?? 0));
        setSelectedIndex(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
        setTotalResults(0);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [debouncedSearchTerm, currentOrganizationId, universalSearch, page]);

  // Reset page when searchTerm changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm]);

  // Handle opening the search
  const openSearch = () => {
    setIsOpen(true);
    setSearchTerm("");
    setResults([]);
    setSelectedIndex(0);
    setPage(1);
    setError(null);

    const mainContent = document.getElementById("main-app") || document.body;
    mainContent.style.filter = "blur(8px)";
    mainContent.style.transition = "filter 0.3s ease-out";
  };

  // Handle closing the search
  const closeSearch = () => {
    setIsOpen(false);
    setSearchTerm("");
    setResults([]);
    setSelectedIndex(0);
    setPage(1);
    setError(null);

    // Remove blur effect
    const mainContent = document.getElementById("main-app") || document.body;
    mainContent.style.filter = "none";
  };

  const getWorkspaceSlug = (workspaceName) => {
    return workspaceName.toLowerCase().replace(/\s+/g, "-");
  };

  const handleResultSelect = (result) => {
    let navigationUrl = result.url;

    // Map different result types to correct frontend routes
    switch (result.type) {
      case "task":
        if (result.context.workspace && result.context.project) {
          const workspaceSlug = getWorkspaceSlug(result.context.workspace.name);
          const projectSlug = result.context.project.slug;
          navigationUrl = `/${workspaceSlug}/${projectSlug}/tasks/${result.id}`;
        } else {
          navigationUrl = `/tasks/${result.id}`;
        }
        router.push(navigationUrl);
        closeSearch();
        break;
      case "project":
        if (result.context.workspace) {
          const workspaceSlug = getWorkspaceSlug(result.context.workspace.name);
          const projectSlug = result.context.project.slug;
          navigationUrl = `/${workspaceSlug}/${projectSlug}`;
        }
        router.push(navigationUrl);
        closeSearch();
        break;
      case "workspace":
        const workspaceSlug = getWorkspaceSlug(result.title);
        navigationUrl = `/${workspaceSlug}`;
        router.push(navigationUrl);
        closeSearch();
        break;
      case "sprint":
        if (result.context.workspace && result.context.project) {
          const workspaceSlug = getWorkspaceSlug(result.context.workspace.name);
          const projectSlug = result.context.project.slug;
          navigationUrl = `/${workspaceSlug}/${projectSlug}/sprints/${result.id}`;
        }
        router.push(navigationUrl);
        closeSearch();
        break;
      case "user":
        closeSearch();
        break;
      default:
        router.push(navigationUrl);
        closeSearch();
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      switch (e.key) {
        case "Escape":
          closeSearch();
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, paginatedResults.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (paginatedResults[selectedIndex]) {
            handleResultSelect(paginatedResults[selectedIndex]);
          }
          break;
        default:
          break;
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Focus input when opened
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, paginatedResults, selectedIndex]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
      const mainContent = document.getElementById("main-app") || document.body;
      mainContent.style.filter = "none";
    };
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && paginatedResults.length > 0) {
      const selectedElement = resultsRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // Global shortcut handler
  useEffect(() => {
    const handleGlobalShortcut = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!isOpen) openSearch();
      }
    };
    window.addEventListener("keydown", handleGlobalShortcut);
    return () => window.removeEventListener("keydown", handleGlobalShortcut);
  }, [isOpen]);

  // Get icon for result type
  const getResultIcon = (type) => {
    switch (type) {
      case "workspace":
        return "🏢";
      case "project":
        return "📁";
      case "task":
        return "✅";
      case "user":
        return "👤";
      case "sprint":
        return "🏃";
      case "comment":
        return "💬";
      case "label":
        return "🏷️";
      default:
        return "🔍";
    }
  };

  const TriggerButton = () => (
    <Tooltip content="Search" position="bottom" color="primary">
      <Button onClick={openSearch} className="header-mode-toggle shadow-none">
        <HiMagnifyingGlass className="header-mode-toggle-icon" />
        <span className="hidden max-[530px]:inline-block text-sm font-medium">Search</span>
      </Button>
    </Tooltip>
  );

  const SearchOverlay = () => (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
      style={{ zIndex: 9999 }}
      onClick={closeSearch}
    >
      {/* Search Container */}
      <div
        className="w-full min-h-[50vh] max-w-2xl bg-[var(--card)]/95 backdrop-blur-xl rounded-xl shadow-2xl border border-[var(--border)]/50 animate-in slide-in-from-top-4 duration-500 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Section */}
        <div className="flex items-center px-4 py-3 border-b border-[var(--border)]/30 text-xs">
          <HiMagnifyingGlass className="header-mode-toggle-icon text-[var(--muted-foreground)] mr-2 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search anything..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none"
          />
          {/* Loading spinner when searching */}
          {loading && (
            <div className="ml-2 animate-spin h-4 w-4 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
          )}
          {/* Clear button when searchTerm is not empty and not loading */}
          {searchTerm && !loading && (
            <button
              onClick={() => {
                setSearchTerm("");
                setResults([]);
                setSelectedIndex(0);
                setPage(1);
                setError(null);
              }}
              className="ml-2 p-1 rounded-lg hover:bg-[var(--accent)]/50 transition-colors duration-200 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              aria-label="Clear search"
            >
              <HiXMark className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results Section */}
        <div
          className={`max-h-80 overflow-y-auto flex-1 ${
            loading ||
            error ||
            (searchTerm && !loading && !error && results.length === 0) ||
            (searchTerm === "" && !loading && !error)
              ? "flex flex-col justify-center items-center"
              : ""
          }`}
        >
          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center w-full h-full px-4 py-8 text-center text-[var(--muted-foreground)]">
              <div className="text-4xl mb-2 opacity-50">⏳</div>
              <div className="text-sm font-medium mb-1">Searching...</div>
            </div>
          )}
          {/* Error state */}
          {error && (
            <div className="flex flex-col items-center justify-center w-full h-full px-4 py-8 text-center text-[var(--muted-foreground)]">
              <div className="text-4xl mb-2 opacity-80 text-red-500">❌</div>
              <div className="text-base font-medium mb-1">{error}</div>
            </div>
          )}
          {/* No results state */}
          {searchTerm && !loading && !error && results.length === 0 && (
            <div className="flex flex-col items-center justify-center w-full h-full px-4 py-8 text-center text-[var(--muted-foreground)]">
              <div className="text-4xl mb-2 opacity-50">🔍</div>
              <div className="text-sm font-medium mb-1">No results found</div>
              <div className="text-xs">Try a different search term</div>
            </div>
          )}
          {/* Results list */}
          {!loading && !error && paginatedResults.length > 0 && (
            <div ref={resultsRef} className="py-1 w-full flex flex-col justify-start items-stretch">
              {paginatedResults.map((result, index) => (
                <div
                  key={result.id || index}
                  className={`flex items-center px-4 py-1 cursor-pointer transition-all duration-150 border-l-4 ${
                    index === selectedIndex
                      ? "bg-[var(--accent)] border-[var(--primary)] text-[var(--accent-foreground)]"
                      : "border-transparent hover:bg-[var(--accent)]/30 text-[var(--foreground)]"
                  }`}
                  onClick={() => handleResultSelect(result)}
                  style={{ minHeight: "32px" }}
                >
                  <span className="text-base mr-2 flex-shrink-0 cursor-pointer">
                    {getResultIcon(result.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-[14px] cursor-pointer">
                      {result.title}
                    </div>
                    <div className="text-[13px] opacity-70 truncate">
                      {result.context?.workspace?.name && `${result.context.workspace.name} • `}
                      {result.context?.project?.name && `${result.context.project.name} • `}
                      {result.type}
                    </div>
                  </div>
                  <div className="text-xs opacity-50 ml-2 cursor-pointer">
                    {index === selectedIndex ? "↵" : `⌘${index + 1}`}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Empty state */}
          {searchTerm === "" && !loading && !error && (
            <div className="flex flex-col items-center justify-center w-full h-full px-4 py-8 text-center text-[var(--muted-foreground)]">
              <div className="text-5xl mb-2 opacity-60">✨</div>
              <div className="text-base font-medium mb-1 text-[var(--foreground)]">
                Spotlight Search
              </div>
              <div className="text-xs mb-2">Start typing to search across your workspace</div>
              <div className="text-xs opacity-50 flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 bg-[var(--muted)]/30 px-1 py-0.5 rounded">
                  <span>⌘K to open</span>
                </span>
                <span className="mx-1">•</span>
                <span className="inline-flex items-center gap-1 bg-[var(--muted)]/30 px-1 py-0.5 rounded">
                  <span>ESC to close</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2 border-t border-[var(--border)]/30 bg-[var(--muted)]/20 rounded-b-xl flex items-center justify-between text-xs text-[var(--muted-foreground)]"
          style={{ minHeight: "48px", maxHeight: "48px", height: "48px" }}
        >
          {totalPages > 1 ? (
            <div className="flex items-center gap-4">
              <button
                className="px-2 py-1 text-xs rounded bg-[var(--muted)]/30 hover:bg-[var(--muted)]/50 disabled:opacity-50"
                onClick={() => setPage(page - 1)}
                disabled={page === 1 || loading}
                aria-label="Previous page"
              >
                ←
              </button>

              <span className="text-xs">
                {page} / {totalPages}
              </span>

              <button
                className="px-2 py-1 text-xs rounded bg-[var(--muted)]/30 hover:bg-[var(--muted)]/50 disabled:opacity-50"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages || loading}
                aria-label="Next page"
              >
                →
              </button>
            </div>
          ) : (
            <div style={{ width: "96px" }} />
          )}

          <span className="flex items-center gap-1">
            <span className="bg-[var(--muted)]/30 px-1 py-0.5 rounded">ESC</span>
            close
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <TriggerButton />
      {isOpen && createPortal(<SearchOverlay />, document.body)}
    </>
  );
};

export default SearchManager;
