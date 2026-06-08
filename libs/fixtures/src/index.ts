/**
 * @tracebird/fixtures — sample OTLP payloads and recorded sessions used by
 * core/cli tests and as demo data for `tracebird open`.
 */

export * from './otlp/builders.js';
export { weatherHappyPath } from './otlp/weather-happy-path.js';
export { toolError } from './otlp/tool-error.js';
export { diffPairA, diffPairB } from './otlp/diff-pair.js';

import { weatherHappyPath } from './otlp/weather-happy-path.js';
import { toolError } from './otlp/tool-error.js';
import { diffPairA, diffPairB } from './otlp/diff-pair.js';

/** All OTLP request fixtures, keyed by a short name. */
export const otlpFixtures = {
  weatherHappyPath,
  toolError,
  diffPairA,
  diffPairB,
} as const;

export type OtlpFixtureName = keyof typeof otlpFixtures;
