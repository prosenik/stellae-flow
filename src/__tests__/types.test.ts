import { describe, it, expect } from 'vitest';
import { TIERS, type FlowGraph, type FlowNode, type FlowEdge, type TierConfig } from '../types';

// ─── Tier Configuration ──────────────────────────────────────────

describe('TIERS', () => {
  it('free tier has maxScreens of 10', () => {
    expect(TIERS.free.maxScreens).toBe(10);
  });

  it('free tier disables pro features', () => {
    expect(TIERS.free.flowHighlighting).toBe(false);
    expect(TIERS.free.interactionLabels).toBe(false);
    expect(TIERS.free.pdfExport).toBe(false);
  });

  it('pro tier has unlimited screens', () => {
    expect(TIERS.pro.maxScreens).toBe(Infinity);
  });

  it('pro tier enables all features', () => {
    expect(TIERS.pro.flowHighlighting).toBe(true);
    expect(TIERS.pro.interactionLabels).toBe(true);
    expect(TIERS.pro.pdfExport).toBe(true);
  });

  it('only has free and pro tiers', () => {
    expect(Object.keys(TIERS)).toEqual(['free', 'pro']);
  });
});

// ─── Type Shape Validation ───────────────────────────────────────

describe('type structures', () => {
  it('FlowNode has required fields', () => {
    const node: FlowNode = { id: '1', name: 'Home', width: 375, height: 812 };
    expect(node).toHaveProperty('id');
    expect(node).toHaveProperty('name');
    expect(node).toHaveProperty('width');
    expect(node).toHaveProperty('height');
  });

  it('FlowEdge has required fields', () => {
    const edge: FlowEdge = { sourceId: '1', targetId: '2', trigger: 'ON_CLICK', action: 'NAVIGATE' };
    expect(edge.sourceId).toBe('1');
    expect(edge.targetId).toBe('2');
  });

  it('FlowGraph holds nodes, edges, and startingPointIds', () => {
    const graph: FlowGraph = { nodes: [], edges: [], startingPointIds: [] };
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.edges)).toBe(true);
    expect(Array.isArray(graph.startingPointIds)).toBe(true);
  });
});
