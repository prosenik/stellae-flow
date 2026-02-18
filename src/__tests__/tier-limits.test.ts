import { describe, it, expect } from 'vitest';
import { TIERS, type FlowGraph, type TierConfig } from '../types';

// ─── Re-implement tier enforcement logic from code.ts ────────────

function enforceTierLimit(graph: FlowGraph, tier: TierConfig): { allowed: boolean; message?: string } {
  if (graph.nodes.length > tier.maxScreens) {
    return {
      allowed: false,
      message: `Free tier supports up to ${tier.maxScreens} screens. Found ${graph.nodes.length}. Upgrade to Pro for unlimited.`,
    };
  }
  return { allowed: true };
}

function canExportPdf(tier: TierConfig): boolean {
  return tier.pdfExport;
}

// ─── Helpers ─────────────────────────────────────────────────────

function makeGraph(nodeCount: number): FlowGraph {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: String(i), name: `Screen ${i}`, width: 375, height: 812,
  }));
  return { nodes, edges: [], startingPointIds: [] };
}

// ─── Tests ───────────────────────────────────────────────────────

describe('tier limits', () => {
  it('free tier allows up to 10 screens', () => {
    expect(enforceTierLimit(makeGraph(10), TIERS.free).allowed).toBe(true);
  });

  it('free tier rejects 11 screens', () => {
    const result = enforceTierLimit(makeGraph(11), TIERS.free);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('11');
    expect(result.message).toContain('10');
  });

  it('free tier rejects 100 screens', () => {
    expect(enforceTierLimit(makeGraph(100), TIERS.free).allowed).toBe(false);
  });

  it('pro tier allows 100 screens', () => {
    expect(enforceTierLimit(makeGraph(100), TIERS.pro).allowed).toBe(true);
  });

  it('pro tier allows 1000 screens', () => {
    expect(enforceTierLimit(makeGraph(1000), TIERS.pro).allowed).toBe(true);
  });

  it('empty graph is always allowed', () => {
    expect(enforceTierLimit(makeGraph(0), TIERS.free).allowed).toBe(true);
    expect(enforceTierLimit(makeGraph(0), TIERS.pro).allowed).toBe(true);
  });

  it('exactly at limit is allowed', () => {
    expect(enforceTierLimit(makeGraph(10), TIERS.free).allowed).toBe(true);
  });
});

describe('PDF export gating', () => {
  it('free tier cannot export PDF', () => {
    expect(canExportPdf(TIERS.free)).toBe(false);
  });

  it('pro tier can export PDF', () => {
    expect(canExportPdf(TIERS.pro)).toBe(true);
  });
});

describe('feature flags per tier', () => {
  it('free tier has no flow highlighting', () => {
    expect(TIERS.free.flowHighlighting).toBe(false);
  });

  it('pro tier has flow highlighting', () => {
    expect(TIERS.pro.flowHighlighting).toBe(true);
  });

  it('free tier has no interaction labels', () => {
    expect(TIERS.free.interactionLabels).toBe(false);
  });

  it('pro tier has interaction labels', () => {
    expect(TIERS.pro.interactionLabels).toBe(true);
  });
});
