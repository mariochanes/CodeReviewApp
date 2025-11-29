/**
 * Client-side caching utilities for code snippets
 * Provides localStorage-based caching to improve performance on subsequent visits
 * and reduce API calls, especially important for mobile users.
 */

import { CodeSnippet } from './github';
import { StaticSnippet } from './staticSnippets';

// Cache keys
const CACHE_KEY_PREFIX = 'code_review_app_';
const SNIPPETS_CACHE_KEY = `${CACHE_KEY_PREFIX}snippets`;
const LAST_VIEWED_KEY = `${CACHE_KEY_PREFIX}last_viewed`;
const CACHE_VERSION = '2'; // Increment this when making breaking changes to cache structure
const CACHE_VERSION_KEY = `${CACHE_KEY_PREFIX}cache_version`;
const CACHE_STATS_KEY = `${CACHE_KEY_PREFIX}stats`;

// Cache expiration (7 days in milliseconds)
const CACHE_EXPIRATION = 7 * 24 * 60 * 60 * 1000;

// Maximum number of snippets to store in cache
const MAX_CACHED_SNIPPETS = 30; // Increased from 20 to 30

// Cache statistics interface
interface CacheStats {
  hits: number;
  misses: number;
  lastUpdated: number;
  created: number;
}

interface CachedSnippet extends CodeSnippet {
  cachedAt: number;
}

interface SnippetCache {
  version: string;
  snippets: CachedSnippet[];
  lastUpdated: number;
}

/**
 * Initialize the cache with the current version
 */
function initializeCache(): SnippetCache {
  return {
    version: CACHE_VERSION,
    snippets: [],
    lastUpdated: Date.now()
  };
}

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = `${CACHE_KEY_PREFIX}test`;
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get the snippet cache from localStorage
 */
function getCache(): SnippetCache {
  if (!isLocalStorageAvailable()) {
    return initializeCache();
  }

  try {
    // Check cache version
    const cacheVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (cacheVersion !== CACHE_VERSION) {
      // Clear cache if version mismatch
      localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
      localStorage.removeItem(SNIPPETS_CACHE_KEY);
      localStorage.removeItem(LAST_VIEWED_KEY);
      return initializeCache();
    }

    const cacheData = localStorage.getItem(SNIPPETS_CACHE_KEY);
    if (!cacheData) {
      return initializeCache();
    }

    const cache: SnippetCache = JSON.parse(cacheData);
    return cache;
  } catch (error) {
    console.error('Error reading from snippet cache:', error);
    return initializeCache();
  }
}

/**
 * Save the snippet cache to localStorage
 */
function saveCache(cache: SnippetCache): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
    localStorage.setItem(SNIPPETS_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error saving to snippet cache:', error);
    // If we hit storage limits, clear the cache and try again
    try {
      localStorage.removeItem(SNIPPETS_CACHE_KEY);
      localStorage.setItem(SNIPPETS_CACHE_KEY, JSON.stringify(initializeCache()));
    } catch (e) {
      // If still failing, give up silently
    }
  }
}

/**
 * Add a snippet to the cache
 */
export function cacheSnippet(snippet: CodeSnippet): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    const cache = getCache();
    
    // Check if snippet already exists in cache
    const existingIndex = cache.snippets.findIndex(
      s => s.repository === snippet.repository && 
           s.filePath === snippet.filePath && 
           s.startLine === snippet.startLine && 
           s.endLine === snippet.endLine
    );

    const cachedSnippet: CachedSnippet = {
      ...snippet,
      cachedAt: Date.now()
    };

    if (existingIndex >= 0) {
      // Update existing snippet
      cache.snippets[existingIndex] = cachedSnippet;
    } else {
      // Add new snippet
      cache.snippets.unshift(cachedSnippet);
      
      // Limit cache size
      if (cache.snippets.length > MAX_CACHED_SNIPPETS) {
        cache.snippets = cache.snippets.slice(0, MAX_CACHED_SNIPPETS);
      }
    }

    cache.lastUpdated = Date.now();
    saveCache(cache);
  } catch (error) {
    console.error('Error caching snippet:', error);
  }
}

/**
 * Initialize or get cache statistics
 */
function getCacheStats(): CacheStats {
  if (!isLocalStorageAvailable()) {
    return {
      hits: 0,
      misses: 0,
      lastUpdated: Date.now(),
      created: Date.now()
    };
  }

  try {
    const statsData = localStorage.getItem(CACHE_STATS_KEY);
    if (!statsData) {
      const newStats: CacheStats = {
        hits: 0,
        misses: 0,
        lastUpdated: Date.now(),
        created: Date.now()
      };
      localStorage.setItem(CACHE_STATS_KEY, JSON.stringify(newStats));
      return newStats;
    }

    return JSON.parse(statsData);
  } catch (error) {
    console.error('Error reading cache stats:', error);
    return {
      hits: 0,
      misses: 0,
      lastUpdated: Date.now(),
      created: Date.now()
    };
  }
}

/**
 * Update cache statistics
 */
function updateCacheStats(isHit: boolean): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    const stats = getCacheStats();
    
    if (isHit) {
      stats.hits += 1;
    } else {
      stats.misses += 1;
    }
    
    stats.lastUpdated = Date.now();
    localStorage.setItem(CACHE_STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('Error updating cache stats:', error);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStatistics(): CacheStats {
  return getCacheStats();
}

/**
 * Get a random snippet from the cache
 */
export function getRandomCachedSnippet(): CodeSnippet | null {
  if (!isLocalStorageAvailable()) {
    updateCacheStats(false);
    return null;
  }

  try {
    const cache = getCache();
    
    // Filter out expired snippets
    const now = Date.now();
    const validSnippets = cache.snippets.filter(
      snippet => now - snippet.cachedAt < CACHE_EXPIRATION
    );

    if (validSnippets.length === 0) {
      updateCacheStats(false);
      return null;
    }

    // Get a random snippet from the cache
    const randomIndex = Math.floor(Math.random() * validSnippets.length);
    updateCacheStats(true);
    return validSnippets[randomIndex];
  } catch (error) {
    console.error('Error getting cached snippet:', error);
    updateCacheStats(false);
    return null;
  }
}

/**
 * Get the most recently viewed snippet from the cache
 */
export function getLastViewedSnippet(): CodeSnippet | null {
  if (!isLocalStorageAvailable()) {
    updateCacheStats(false);
    return null;
  }

  try {
    const lastViewedId = localStorage.getItem(LAST_VIEWED_KEY);
    if (!lastViewedId) {
      updateCacheStats(false);
      return null;
    }

    const cache = getCache();
    const [repo, path, startLine, endLine] = lastViewedId.split('|');
    
    const snippet = cache.snippets.find(
      s => s.repository === repo && 
           s.filePath === path && 
           s.startLine === parseInt(startLine) && 
           s.endLine === parseInt(endLine)
    );

    if (snippet) {
      updateCacheStats(true);
      return snippet;
    } else {
      updateCacheStats(false);
      return null;
    }
  } catch (error) {
    console.error('Error getting last viewed snippet:', error);
    updateCacheStats(false);
    return null;
  }
}

/**
 * Set the last viewed snippet
 */
export function setLastViewedSnippet(snippet: CodeSnippet): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    const snippetId = `${snippet.repository}|${snippet.filePath}|${snippet.startLine}|${snippet.endLine}`;
    localStorage.setItem(LAST_VIEWED_KEY, snippetId);
  } catch (error) {
    console.error('Error setting last viewed snippet:', error);
  }
}

/**
 * Convert a static snippet to a code snippet
 */
export function convertStaticToCodeSnippet(staticSnippet: StaticSnippet): CodeSnippet {
  return {
    ...staticSnippet,
    score: 10, // Give static snippets a decent score
    metrics: {
      complexity: 5,
      codeSmells: 0,
      interestingPatterns: 3,
      educationalValue: 2,
      potentialIssues: 0
    }
  };
}

/**
 * Clear the snippet cache
 */
export function clearSnippetCache(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    localStorage.removeItem(SNIPPETS_CACHE_KEY);
    localStorage.removeItem(LAST_VIEWED_KEY);
    localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
  } catch (error) {
    console.error('Error clearing snippet cache:', error);
  }
}
