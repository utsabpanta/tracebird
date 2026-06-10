import type { Attributes, Span } from '../types.js';
import * as openinference from './openinference.js';
import * as vercel from './vercel.js';
import * as claudeCode from './claude-code.js';

/**
 * Ingestion adapters normalize popular instrumentation "dialects" into the
 * canonical OpenTelemetry GenAI conventions (`gen_ai.*`) that the rest of core
 * understands — so pointing *any* of these at tracebird renders cleanly.
 */

export interface Adapter {
  name: string;
  detect(span: Span): boolean;
  canonical(span: Span): Attributes;
}

/** Order matters: most specific (span-name-prefixed) dialects first. */
export const ADAPTERS: Adapter[] = [claudeCode, vercel, openinference];

/** The dialect name for a span, or `'genai'` for the native convention. */
export function detectDialect(span: Span): string {
  for (const adapter of ADAPTERS) {
    if (adapter.detect(span)) return adapter.name;
  }
  return 'genai';
}

/**
 * Return a span with canonical `gen_ai.*` attributes filled in from whichever
 * dialect it matches. Original attributes always win — we only fill gaps, never
 * clobber values the emitter set explicitly — and nothing is removed.
 */
export function normalizeSpan(span: Span): Span {
  for (const adapter of ADAPTERS) {
    if (adapter.detect(span)) {
      const added = adapter.canonical(span);
      return { ...span, attributes: { ...added, ...span.attributes } };
    }
  }
  return span;
}
