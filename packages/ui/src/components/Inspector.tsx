import type { ReactNode } from 'react';
import type { ChatMessage, LlmCall, ToolCall, TraceNode } from '@tracebird/core';
import { KIND_META } from '../nodeMeta.js';
import { formatCost, formatDuration, formatTokens } from '../format.js';

interface InspectorProps {
  node: TraceNode | undefined;
}

export function Inspector({ node }: InspectorProps) {
  if (!node) {
    return <p className="inspector-empty">Select a node to inspect it.</p>;
  }
  const meta = KIND_META[node.kind];

  return (
    <div className="inspector">
      <div className="inspector-header">
        <span className="tree-icon" style={{ color: meta.color }}>
          {meta.icon}
        </span>
        <div>
          <div className="inspector-title">{node.name}</div>
          <div className="inspector-kind">{meta.label}</div>
        </div>
      </div>

      <Facts node={node} />

      {node.kind === 'llm' && <LlmDetail llm={node as LlmCall} />}
      {node.kind === 'tool' && <ToolDetail tool={node as ToolCall} />}

      <Section title="Attributes" count={Object.keys(node.attributes).length}>
        {Object.keys(node.attributes).length > 0 ? (
          <JsonBlock value={node.attributes} />
        ) : (
          <p className="muted">No attributes.</p>
        )}
      </Section>
    </div>
  );
}

function Facts({ node }: { node: TraceNode }) {
  const facts: [string, string][] = [['Duration', formatDuration(node.durationMs)]];
  if (node.kind === 'llm') {
    const llm = node as LlmCall;
    if (llm.model) facts.push(['Model', llm.model]);
    if (llm.provider) facts.push(['Provider', llm.provider]);
    facts.push(['Input tokens', formatTokens(llm.usage.input)]);
    facts.push(['Output tokens', formatTokens(llm.usage.output)]);
    facts.push(['Cost', formatCost(llm.costUsd)]);
  }
  if (node.kind === 'tool') {
    const tool = node as ToolCall;
    if (tool.toolName) facts.push(['Tool', tool.toolName]);
    facts.push(['Status', tool.isError ? 'error' : 'ok']);
  }
  if (node.status.message) facts.push(['Message', node.status.message]);

  return (
    <dl className="facts">
      {facts.map(([k, v]) => (
        <div className="fact" key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function LlmDetail({ llm }: { llm: LlmCall }) {
  return (
    <>
      <Section title="Prompt" count={llm.prompt?.length}>
        <Messages messages={llm.prompt} />
      </Section>
      <Section title="Completion" count={llm.completion?.length}>
        <Messages messages={llm.completion} />
      </Section>
    </>
  );
}

function ToolDetail({ tool }: { tool: ToolCall }) {
  return (
    <>
      <Section title="Arguments">
        {tool.arguments !== undefined ? <JsonBlock value={tool.arguments} /> : <p className="muted">None.</p>}
      </Section>
      <Section title="Result">
        {tool.result !== undefined ? <JsonBlock value={tool.result} /> : <p className="muted">None.</p>}
      </Section>
    </>
  );
}

function Messages({ messages }: { messages: ChatMessage[] | undefined }) {
  if (!messages || messages.length === 0) return <p className="muted">None captured.</p>;
  return (
    <div className="messages">
      {messages.map((m, i) => (
        <div className="message" key={i}>
          <div className="message-role">{m.role}</div>
          {m.content && <div className="message-content">{m.content}</div>}
          {m.toolCalls && m.toolCalls.length > 0 && (
            <div className="tool-calls">
              {m.toolCalls.map((tc, j) => (
                <div className="tool-call" key={j}>
                  <span className="tool-call-name">{tc.name ?? 'tool'}</span>
                  <JsonBlock value={tc.arguments} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="inspector-section">
      <h3>
        {title}
        {count != null && <span className="count">{count}</span>}
      </h3>
      {children}
    </section>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return <pre className="json-block">{text}</pre>;
}
