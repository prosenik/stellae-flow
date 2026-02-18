import { describe, it, expect } from 'vitest';
import dagre from 'dagre';
import type { FlowGraph, LayoutResult, LayoutNode, LayoutEdge } from '../types';

// ─── Re-implement computeLayout for testing (same logic as ui.ts) ─

function computeLayout(graph: FlowGraph, direction: 'LR' | 'TB'): LayoutResult {
  const CARD_W = 324;
  const CARD_H = 252;

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 120,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    g.setNode(node.id, { label: node.name, width: CARD_W, height: CARD_H });
  }

  for (const edge of graph.edges) {
    g.setEdge(edge.sourceId, edge.targetId);
  }

  dagre.layout(g);

  const nodes: LayoutNode[] = graph.nodes.map(n => {
    const gNode = g.node(n.id);
    return {
      id: n.id,
      name: n.name,
      x: Math.round(gNode.x - CARD_W / 2),
      y: Math.round(gNode.y - CARD_H / 2),
      width: CARD_W,
      height: CARD_H,
    };
  });

  const edges: LayoutEdge[] = graph.edges.map(e => {
    const gEdge = g.edge(e.sourceId, e.targetId);
    return {
      sourceId: e.sourceId,
      targetId: e.targetId,
      trigger: e.trigger,
      action: e.action,
      points: gEdge?.points?.map((p: any) => ({ x: Math.round(p.x), y: Math.round(p.y) })) || [],
    };
  });

  return { nodes, edges };
}

// ─── Helpers ─────────────────────────────────────────────────────

function makeNode(id: string, name: string) {
  return { id, name, width: 375, height: 812 };
}

function makeEdge(sourceId: string, targetId: string, trigger = 'ON_CLICK', action = 'NAVIGATE') {
  return { sourceId, targetId, trigger, action };
}

// ─── Tests ───────────────────────────────────────────────────────

describe('computeLayout', () => {
  it('returns layout for a simple linear flow', () => {
    const graph: FlowGraph = {
      nodes: [makeNode('1', 'Home'), makeNode('2', 'Details')],
      edges: [makeEdge('1', '2')],
      startingPointIds: ['1'],
    };

    const layout = computeLayout(graph, 'LR');

    expect(layout.nodes).toHaveLength(2);
    expect(layout.edges).toHaveLength(1);
    // In LR mode, node 1 should be to the left of node 2
    const n1 = layout.nodes.find(n => n.id === '1')!;
    const n2 = layout.nodes.find(n => n.id === '2')!;
    expect(n1.x).toBeLessThan(n2.x);
  });

  it('TB direction places nodes top-to-bottom', () => {
    const graph: FlowGraph = {
      nodes: [makeNode('1', 'Home'), makeNode('2', 'Details')],
      edges: [makeEdge('1', '2')],
      startingPointIds: ['1'],
    };

    const layout = computeLayout(graph, 'TB');
    const n1 = layout.nodes.find(n => n.id === '1')!;
    const n2 = layout.nodes.find(n => n.id === '2')!;
    expect(n1.y).toBeLessThan(n2.y);
  });

  it('handles single node with no edges', () => {
    const graph: FlowGraph = {
      nodes: [makeNode('1', 'Lonely Screen')],
      edges: [],
      startingPointIds: ['1'],
    };

    const layout = computeLayout(graph, 'LR');
    expect(layout.nodes).toHaveLength(1);
    expect(layout.edges).toHaveLength(0);
    expect(layout.nodes[0].width).toBe(324);
    expect(layout.nodes[0].height).toBe(252);
  });

  it('handles circular references', () => {
    const graph: FlowGraph = {
      nodes: [makeNode('1', 'A'), makeNode('2', 'B'), makeNode('3', 'C')],
      edges: [makeEdge('1', '2'), makeEdge('2', '3'), makeEdge('3', '1')],
      startingPointIds: ['1'],
    };

    const layout = computeLayout(graph, 'LR');
    expect(layout.nodes).toHaveLength(3);
    expect(layout.edges).toHaveLength(3);
    // All nodes should have valid coordinates
    for (const n of layout.nodes) {
      expect(typeof n.x).toBe('number');
      expect(typeof n.y).toBe('number');
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });

  it('edges have points array', () => {
    const graph: FlowGraph = {
      nodes: [makeNode('1', 'A'), makeNode('2', 'B')],
      edges: [makeEdge('1', '2')],
      startingPointIds: ['1'],
    };

    const layout = computeLayout(graph, 'LR');
    expect(layout.edges[0].points.length).toBeGreaterThan(0);
    for (const p of layout.edges[0].points) {
      expect(typeof p.x).toBe('number');
      expect(typeof p.y).toBe('number');
    }
  });

  it('preserves edge metadata (trigger, action)', () => {
    const graph: FlowGraph = {
      nodes: [makeNode('1', 'A'), makeNode('2', 'B')],
      edges: [makeEdge('1', '2', 'ON_HOVER', 'OVERLAY')],
      startingPointIds: ['1'],
    };

    const layout = computeLayout(graph, 'LR');
    expect(layout.edges[0].trigger).toBe('ON_HOVER');
    expect(layout.edges[0].action).toBe('OVERLAY');
  });

  it('handles a branching flow', () => {
    const graph: FlowGraph = {
      nodes: [makeNode('1', 'Home'), makeNode('2', 'Login'), makeNode('3', 'Register')],
      edges: [makeEdge('1', '2'), makeEdge('1', '3')],
      startingPointIds: ['1'],
    };

    const layout = computeLayout(graph, 'LR');
    expect(layout.nodes).toHaveLength(3);
    const home = layout.nodes.find(n => n.id === '1')!;
    const login = layout.nodes.find(n => n.id === '2')!;
    const register = layout.nodes.find(n => n.id === '3')!;
    // Both targets should be to the right of home in LR
    expect(home.x).toBeLessThan(login.x);
    expect(home.x).toBeLessThan(register.x);
  });

  it('handles many nodes (stress test)', () => {
    const nodes = Array.from({ length: 20 }, (_, i) => makeNode(String(i), `Screen ${i}`));
    const edges = Array.from({ length: 19 }, (_, i) => makeEdge(String(i), String(i + 1)));
    const graph: FlowGraph = { nodes, edges, startingPointIds: ['0'] };

    const layout = computeLayout(graph, 'LR');
    expect(layout.nodes).toHaveLength(20);
    // Nodes should be in increasing x order for a linear chain in LR
    for (let i = 0; i < 19; i++) {
      const curr = layout.nodes.find(n => n.id === String(i))!;
      const next = layout.nodes.find(n => n.id === String(i + 1))!;
      expect(curr.x).toBeLessThan(next.x);
    }
  });
});
