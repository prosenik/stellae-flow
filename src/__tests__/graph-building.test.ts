import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FlowGraph, FlowNode, FlowEdge } from '../types';

// ─── Re-implement core graph scanning logic for testability ──────
// We extract the pure logic from code.ts and test it with mocks.

interface MockNode {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  parent: { type: string } | null;
  reactions?: any[];
  children?: MockNode[];
}

function findTopFrame(node: MockNode): MockNode | null {
  let current: any = node;
  while (current) {
    if (current.parent && current.parent.type === 'PAGE') {
      return (current.type === 'FRAME' || current.type === 'COMPONENT' || current.type === 'COMPONENT_SET')
        ? current
        : null;
    }
    current = current.parent;
  }
  return null;
}

function scanPrototypeConnections(
  pageChildren: MockNode[],
  getNodeById: (id: string) => MockNode | null,
  flowStartingPoints?: { nodeId: string }[],
): FlowGraph {
  const nodeMap = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];

  function walkNode(node: MockNode) {
    if (node.reactions) {
      for (const reaction of node.reactions) {
        if (!reaction.action) continue;
        const action = reaction.action;
        if (action.destinationId) {
          const sourceFrame = findTopFrame(node);
          const destNode = getNodeById(action.destinationId);
          const destFrame = destNode ? findTopFrame(destNode) : null;

          if (sourceFrame && destFrame && sourceFrame.id !== destFrame.id) {
            if (!nodeMap.has(sourceFrame.id)) {
              nodeMap.set(sourceFrame.id, {
                id: sourceFrame.id,
                name: sourceFrame.name,
                width: Math.round(sourceFrame.width),
                height: Math.round(sourceFrame.height),
              });
            }
            if (!nodeMap.has(destFrame.id)) {
              nodeMap.set(destFrame.id, {
                id: destFrame.id,
                name: destFrame.name,
                width: Math.round(destFrame.width),
                height: Math.round(destFrame.height),
              });
            }

            edges.push({
              sourceId: sourceFrame.id,
              targetId: destFrame.id,
              trigger: reaction.trigger?.type || 'ON_CLICK',
              action: action.type || 'NAVIGATE',
            });
          }
        }
      }
    }

    if (node.children) {
      for (const child of node.children) {
        walkNode(child);
      }
    }
  }

  for (const child of pageChildren) {
    walkNode(child);
  }

  const startingPointIds: string[] = [];
  if (flowStartingPoints) {
    for (const sp of flowStartingPoints) {
      if (nodeMap.has(sp.nodeId)) {
        startingPointIds.push(sp.nodeId);
      }
    }
  }

  if (startingPointIds.length === 0) {
    const hasIncoming = new Set(edges.map(e => e.targetId));
    for (const id of nodeMap.keys()) {
      if (!hasIncoming.has(id)) {
        startingPointIds.push(id);
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
    startingPointIds,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

const PAGE = { type: 'PAGE' };

function makeFrame(id: string, name: string, reactions: any[] = [], children: MockNode[] = []): MockNode {
  const frame: MockNode = {
    id, name, type: 'FRAME', width: 375, height: 812,
    parent: PAGE,
    reactions,
    children,
  };
  // Set parent for children
  for (const c of children) {
    c.parent = frame as any;
  }
  return frame;
}

function makeButton(id: string, name: string, destinationId: string, trigger = 'ON_CLICK', actionType = 'NAVIGATE'): MockNode {
  return {
    id, name, type: 'INSTANCE', width: 100, height: 44,
    parent: null, // set by parent
    reactions: [{
      trigger: { type: trigger },
      action: { type: actionType, destinationId },
    }],
  };
}

// ─── Tests ───────────────────────────────────────────────────────

describe('scanPrototypeConnections', () => {
  it('finds connections between frames', () => {
    const btn = makeButton('btn1', 'Go to Details', 'frame2');
    const frame1 = makeFrame('frame1', 'Home', [], [btn]);
    const frame2 = makeFrame('frame2', 'Details');

    const nodeStore = new Map([['frame2', frame2]]);
    // For destination lookup, we need the frame itself
    const getNodeById = (id: string) => {
      // Return a node whose top frame is frame2
      if (id === 'frame2') return frame2;
      return null;
    };

    const graph = scanPrototypeConnections([frame1, frame2], getNodeById);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].sourceId).toBe('frame1');
    expect(graph.edges[0].targetId).toBe('frame2');
    expect(graph.edges[0].trigger).toBe('ON_CLICK');
    expect(graph.edges[0].action).toBe('NAVIGATE');
  });

  it('returns empty graph when no connections', () => {
    const frame1 = makeFrame('frame1', 'Lonely');
    const graph = scanPrototypeConnections([frame1], () => null);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
    expect(graph.startingPointIds).toHaveLength(0);
  });

  it('handles multiple connections from one frame', () => {
    const btn1 = makeButton('btn1', 'Login', 'frame2');
    const btn2 = makeButton('btn2', 'Register', 'frame3');
    const frame1 = makeFrame('frame1', 'Home', [], [btn1, btn2]);
    const frame2 = makeFrame('frame2', 'Login');
    const frame3 = makeFrame('frame3', 'Register');

    const getNodeById = (id: string) => {
      if (id === 'frame2') return frame2;
      if (id === 'frame3') return frame3;
      return null;
    };

    const graph = scanPrototypeConnections([frame1, frame2, frame3], getNodeById);
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
  });

  it('detects starting points from flowStartingPoints', () => {
    const btn = makeButton('btn1', 'Go', 'frame2');
    const frame1 = makeFrame('frame1', 'Home', [], [btn]);
    const frame2 = makeFrame('frame2', 'Details');

    const getNodeById = (id: string) => id === 'frame2' ? frame2 : null;

    const graph = scanPrototypeConnections(
      [frame1, frame2],
      getNodeById,
      [{ nodeId: 'frame1' }],
    );

    expect(graph.startingPointIds).toEqual(['frame1']);
  });

  it('infers starting points when none defined (no incoming edges)', () => {
    const btn = makeButton('btn1', 'Go', 'frame2');
    const frame1 = makeFrame('frame1', 'Home', [], [btn]);
    const frame2 = makeFrame('frame2', 'Details');

    const getNodeById = (id: string) => id === 'frame2' ? frame2 : null;

    const graph = scanPrototypeConnections([frame1, frame2], getNodeById);
    // frame1 has no incoming edges, so it's a starting point
    expect(graph.startingPointIds).toContain('frame1');
    expect(graph.startingPointIds).not.toContain('frame2');
  });

  it('handles circular references', () => {
    const btn1 = makeButton('btn1', 'Go to B', 'frame2');
    const btn2 = makeButton('btn2', 'Go to A', 'frame1');
    const frame1 = makeFrame('frame1', 'A', [], [btn1]);
    const frame2 = makeFrame('frame2', 'B', [], [btn2]);

    const getNodeById = (id: string) => {
      if (id === 'frame1') return frame1;
      if (id === 'frame2') return frame2;
      return null;
    };

    const graph = scanPrototypeConnections([frame1, frame2], getNodeById);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(2);
    // Both have incoming, so no starting points inferred
    expect(graph.startingPointIds).toHaveLength(0);
  });

  it('ignores reactions without action', () => {
    const node: MockNode = {
      id: 'btn1', name: 'Button', type: 'INSTANCE', width: 100, height: 44,
      parent: null,
      reactions: [{ trigger: { type: 'ON_CLICK' }, action: null }],
    };
    const frame1 = makeFrame('frame1', 'Home', [], [node]);
    const graph = scanPrototypeConnections([frame1], () => null);
    expect(graph.edges).toHaveLength(0);
  });

  it('ignores self-referencing connections', () => {
    const btn = makeButton('btn1', 'Self', 'frame1');
    const frame1 = makeFrame('frame1', 'Home', [], [btn]);

    const getNodeById = (id: string) => id === 'frame1' ? frame1 : null;

    const graph = scanPrototypeConnections([frame1], getNodeById);
    // sourceFrame.id === destFrame.id → skipped
    expect(graph.edges).toHaveLength(0);
  });

  it('picks up different trigger types', () => {
    const btn = makeButton('btn1', 'Hover target', 'frame2', 'ON_HOVER', 'OVERLAY');
    const frame1 = makeFrame('frame1', 'Home', [], [btn]);
    const frame2 = makeFrame('frame2', 'Tooltip');

    const getNodeById = (id: string) => id === 'frame2' ? frame2 : null;

    const graph = scanPrototypeConnections([frame1, frame2], getNodeById);
    expect(graph.edges[0].trigger).toBe('ON_HOVER');
    expect(graph.edges[0].action).toBe('OVERLAY');
  });

  it('defaults trigger to ON_CLICK when missing', () => {
    const node: MockNode = {
      id: 'btn1', name: 'Button', type: 'INSTANCE', width: 100, height: 44,
      parent: null,
      reactions: [{ action: { type: 'NAVIGATE', destinationId: 'frame2' } }],
    };
    const frame1 = makeFrame('frame1', 'Home', [], [node]);
    const frame2 = makeFrame('frame2', 'Details');

    const getNodeById = (id: string) => id === 'frame2' ? frame2 : null;

    const graph = scanPrototypeConnections([frame1, frame2], getNodeById);
    expect(graph.edges[0].trigger).toBe('ON_CLICK');
  });

  it('rounds node dimensions', () => {
    const btn = makeButton('btn1', 'Go', 'frame2');
    const frame1: MockNode = {
      id: 'frame1', name: 'Home', type: 'FRAME',
      width: 375.5, height: 812.7,
      parent: PAGE,
      children: [btn],
    };
    btn.parent = frame1 as any;
    const frame2 = makeFrame('frame2', 'Details');

    const getNodeById = (id: string) => id === 'frame2' ? frame2 : null;

    const graph = scanPrototypeConnections([frame1, frame2], getNodeById);
    const homeNode = graph.nodes.find(n => n.id === 'frame1')!;
    expect(homeNode.width).toBe(376);
    expect(homeNode.height).toBe(813);
  });
});
