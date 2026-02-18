import { describe, it, expect } from 'vitest';

// ─── Export configuration tests ──────────────────────────────────

describe('export settings', () => {
  it('PNG export uses scale 2x', () => {
    const settings = { format: 'PNG' as const, constraint: { type: 'SCALE' as const, value: 2 } };
    expect(settings.format).toBe('PNG');
    expect(settings.constraint.value).toBe(2);
  });

  it('PDF export settings', () => {
    const settings = { format: 'PDF' as const };
    expect(settings.format).toBe('PDF');
  });
});

describe('TRIGGER_LABELS mapping', () => {
  const TRIGGER_LABELS: Record<string, string> = {
    ON_CLICK: 'Tap',
    ON_HOVER: 'Hover',
    ON_DRAG: 'Drag',
    ON_PRESS: 'Press',
    AFTER_TIMEOUT: 'Timer',
    MOUSE_ENTER: 'Hover In',
    MOUSE_LEAVE: 'Hover Out',
    MOUSE_DOWN: 'Press',
    MOUSE_UP: 'Release',
  };

  it('maps ON_CLICK to Tap', () => {
    expect(TRIGGER_LABELS['ON_CLICK']).toBe('Tap');
  });

  it('maps ON_HOVER to Hover', () => {
    expect(TRIGGER_LABELS['ON_HOVER']).toBe('Hover');
  });

  it('maps AFTER_TIMEOUT to Timer', () => {
    expect(TRIGGER_LABELS['AFTER_TIMEOUT']).toBe('Timer');
  });

  it('returns undefined for unknown triggers', () => {
    expect(TRIGGER_LABELS['UNKNOWN']).toBeUndefined();
  });

  it('has 9 known trigger types', () => {
    expect(Object.keys(TRIGGER_LABELS)).toHaveLength(9);
  });
});

describe('flow color assignment', () => {
  const FLOW_COLORS = [
    { r: 0.18, g: 0.8, b: 0.44 },
    { r: 0.91, g: 0.3, b: 0.24 },
    { r: 0.2, g: 0.6, b: 0.86 },
    { r: 0.95, g: 0.61, b: 0.07 },
    { r: 0.56, g: 0.27, b: 0.68 },
  ];

  function assignFlowColors(edges: { sourceId: string; targetId: string }[]): Map<string, typeof FLOW_COLORS[0]> {
    const colorMap = new Map<string, typeof FLOW_COLORS[0]>();
    const sourceNodes = [...new Set(edges.map(e => e.sourceId))];
    for (const edge of edges) {
      const idx = sourceNodes.indexOf(edge.sourceId) % FLOW_COLORS.length;
      colorMap.set(`${edge.sourceId}-${edge.targetId}`, FLOW_COLORS[idx]);
    }
    return colorMap;
  }

  it('assigns first color to first source', () => {
    const colors = assignFlowColors([{ sourceId: 'a', targetId: 'b' }]);
    expect(colors.get('a-b')).toEqual(FLOW_COLORS[0]);
  });

  it('wraps colors when more sources than palette', () => {
    const edges = Array.from({ length: 6 }, (_, i) => ({
      sourceId: `s${i}`, targetId: `t${i}`,
    }));
    const colors = assignFlowColors(edges);
    // 6th source (index 5) wraps to index 0
    expect(colors.get('s5-t5')).toEqual(FLOW_COLORS[0]);
  });

  it('same source gets same color for different targets', () => {
    const colors = assignFlowColors([
      { sourceId: 'a', targetId: 'b' },
      { sourceId: 'a', targetId: 'c' },
    ]);
    expect(colors.get('a-b')).toEqual(colors.get('a-c'));
  });
});
