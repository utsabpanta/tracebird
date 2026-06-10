import type { Attributes, AttributeValue } from '../types.js';

/** Shared helpers for ingestion adapters. */

export function asString(v: AttributeValue | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export function asNumber(v: AttributeValue | undefined): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

/** True if any attribute key starts with `prefix`. */
export function hasPrefix(attrs: Attributes, prefix: string): boolean {
  for (const key in attrs) if (key.startsWith(prefix)) return true;
  return false;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remap a dialect's indexed message attributes onto the canonical
 * `gen_ai.<group>.<i>.{role,content,tool_calls.*}` keys that the core extractor
 * understands. `infix` is the path between the index and the field
 * (e.g. `message` for `llm.input_messages.0.message.role`).
 */
export function remapIndexedMessages(
  attrs: Attributes,
  srcPrefix: string,
  infix: string,
  dstGroup: string,
  out: Attributes,
): void {
  const sep = infix ? `\\.${escapeRegExp(infix)}` : '';
  const re = new RegExp(`^${escapeRegExp(srcPrefix)}\\.(\\d+)${sep}\\.(.+)$`);
  for (const [key, value] of Object.entries(attrs)) {
    const m = re.exec(key);
    if (!m) continue;
    const i = m[1];
    const field = m[2];
    if (field === 'role') out[`${dstGroup}.${i}.role`] = value;
    else if (field === 'content') out[`${dstGroup}.${i}.content`] = value;
    else {
      // tool calls: <…>.tool_calls.<j>.[tool_call.]function.{name,arguments} | id
      const tc =
        /tool_calls\.(\d+)\.(?:tool_call\.)?(?:function\.)?(name|arguments|id)$/.exec(field);
      if (tc) out[`${dstGroup}.${i}.tool_calls.${tc[1]}.${tc[2]}`] = value;
    }
  }
}
