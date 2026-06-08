import { durationMs, type TraceNode } from '@tracebird/core';
import { KIND_META } from '../nodeMeta.js';
import { formatDuration } from '../format.js';

interface ScrubberProps {
  timeline: TraceNode[];
  selectedId: string | undefined;
  onSelect: (node: TraceNode) => void;
}

/**
 * The time-travel scrubber: a slider over the run's nodes in time order.
 * Dragging it selects the node at that point — this *is* the time travel.
 */
export function Scrubber({ timeline, selectedId, onSelect }: ScrubberProps) {
  if (timeline.length === 0) return null;
  const index = Math.max(
    0,
    timeline.findIndex((n) => n.id === selectedId),
  );
  const current = timeline[index];
  const t0 = timeline[0].startTimeUnixNano;
  const offset = durationMs(t0, current.startTimeUnixNano);
  const meta = KIND_META[current.kind];

  return (
    <div className="scrubber">
      <div className="scrubber-ticks">
        {timeline.map((node, i) => (
          <button
            type="button"
            key={node.id}
            className={`scrubber-tick${i === index ? ' active' : ''}`}
            style={{ background: KIND_META[node.kind].color }}
            title={node.name}
            aria-label={node.name}
            onClick={() => onSelect(node)}
          />
        ))}
      </div>
      <div className="scrubber-controls">
        <input
          type="range"
          min={0}
          max={timeline.length - 1}
          value={index}
          onChange={(e) => onSelect(timeline[Number(e.target.value)])}
          aria-label="Scrub through run timeline"
        />
        <div className="scrubber-readout">
          <span className="tree-icon" style={{ color: meta.color }}>
            {meta.icon}
          </span>
          <span className="scrubber-name">{current.name}</span>
          <span className="muted">
            +{formatDuration(offset)} · step {index + 1}/{timeline.length}
          </span>
        </div>
      </div>
    </div>
  );
}
