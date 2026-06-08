import { SCHEMA_VERSION, type Run } from './types.js';

/**
 * `.jsonl` session format: one {@link Run} per line. The schema is versioned via
 * `Run.schemaVersion`; readers should tolerate unknown future minor additions.
 */

/** Serialize a run to a single JSONL line (no trailing newline). */
export function serializeRun(run: Run): string {
  return JSON.stringify({ ...run, schemaVersion: run.schemaVersion ?? SCHEMA_VERSION });
}

export class RunParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
    this.name = 'RunParseError';
  }
}

function isRun(value: unknown): value is Run {
  return (
    typeof value === 'object' &&
    value !== null &&
    'root' in value &&
    'schemaVersion' in value &&
    typeof (value as Run).root === 'object'
  );
}

/** Parse a single JSONL line into a {@link Run}. */
export function parseRun(line: string, lineNumber = 0): Run {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new RunParseError('invalid JSON', lineNumber);
  }
  if (!isRun(parsed)) {
    throw new RunParseError('not a tracebird Run record', lineNumber);
  }
  if (parsed.schemaVersion > SCHEMA_VERSION) {
    throw new RunParseError(
      `session schemaVersion ${parsed.schemaVersion} is newer than supported ${SCHEMA_VERSION}`,
      lineNumber,
    );
  }
  return parsed;
}

/** Serialize many runs to a `.jsonl` document (one run per line, trailing NL). */
export function serializeSession(runs: Run[]): string {
  return runs.map(serializeRun).join('\n') + (runs.length ? '\n' : '');
}

/**
 * Parse a `.jsonl` session document into runs. Blank lines are skipped; a single
 * malformed line is skipped (and reported via `onError`) rather than aborting
 * the whole load.
 */
export function parseSession(
  text: string,
  onError?: (err: RunParseError) => void,
): Run[] {
  const runs: Run[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      runs.push(parseRun(line, i + 1));
    } catch (err) {
      if (err instanceof RunParseError) onError?.(err);
      else throw err;
    }
  }
  return runs;
}
