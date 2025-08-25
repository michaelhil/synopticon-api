/**
 * Type declarations for url-utils.js
 */

export interface ParsedURL {
  pathname: string;
  query: Record<string, string>;
  search: string;
  hash: string;
}

export function parseRequestURL(url: string, parseQuery?: boolean): ParsedURL;
export function validateURL(url: string): boolean;
export function normalizeURL(url: string): string;
