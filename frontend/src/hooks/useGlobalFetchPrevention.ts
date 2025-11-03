import { useRef, useCallback, useEffect } from "react";

interface FetchState {
  isLoading: boolean;
  lastFetchKey: string;
  hasCompleted: boolean;
  data: any;
  timestamp: number;
}

// Global state to prevent duplicate fetches across all components
const globalFetchState = new Map<string, FetchState>();

const CACHE_DURATION = 30000; // 30 seconds cache

interface UseGlobalFetchPreventionReturn {
  shouldPreventFetch: (fetchKey: string) => boolean;
  markFetchStart: (fetchKey: string) => void;
  markFetchComplete: <T>(fetchKey: string, data: T) => void;
  markFetchError: (fetchKey: string, error: Error) => void;
  getCachedData: <T>(fetchKey: string) => T | null;
  reset: (fetchKey?: string) => void;
}

export function useGlobalFetchPrevention(): UseGlobalFetchPreventionReturn {
  const isInitialRender = useRef(true);

  useEffect(() => {
    isInitialRender.current = false;
  }, []);

  const shouldPreventFetch = useCallback((fetchKey: string): boolean => {
    const currentState = globalFetchState.get(fetchKey);
    const now = Date.now();

    if (!currentState) {
      return false;
    }

    // Prevent if currently loading
    if (currentState.isLoading) {
      return true;
    }
    // Prevent if recently completed (within cache duration)
    if (currentState.hasCompleted && now - currentState.timestamp < CACHE_DURATION) {
      return true;
    }

    return false;
  }, []);

  const markFetchStart = useCallback((fetchKey: string) => {
    // Additional check to prevent React strict mode double calls
    const currentState = globalFetchState.get(fetchKey);
    if (currentState && currentState.isLoading) {
      return;
    }
    globalFetchState.set(fetchKey, {
      isLoading: true,
      lastFetchKey: fetchKey,
      hasCompleted: false,
      data: null,
      timestamp: Date.now(),
    });
  }, []);

  const markFetchComplete = useCallback((fetchKey: string, data?: any) => {
    globalFetchState.set(fetchKey, {
      isLoading: false,
      lastFetchKey: fetchKey,
      hasCompleted: true,
      data,
      timestamp: Date.now(),
    });
  }, []);

  const markFetchError = useCallback((fetchKey: string) => {
    globalFetchState.set(fetchKey, {
      isLoading: false,
      lastFetchKey: fetchKey,
      hasCompleted: false,
      data: null,
      timestamp: Date.now(),
    });
  }, []);

  const getCachedData = useCallback((fetchKey: string) => {
    const currentState = globalFetchState.get(fetchKey);
    const now = Date.now();

    if (
      currentState &&
      currentState.hasCompleted &&
      now - currentState.timestamp < CACHE_DURATION
    ) {
      return currentState.data;
    }

    return null;
  }, []);

  const reset = useCallback((fetchKey?: string) => {
    if (fetchKey) {
      globalFetchState.delete(fetchKey);
    } else {
      globalFetchState.clear();
    }
  }, []);

  return {
    shouldPreventFetch,
    markFetchStart,
    markFetchComplete,
    markFetchError,
    getCachedData,
    reset,
  };
}
