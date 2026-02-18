// Shared types between code.ts and ui.ts

export interface FlowNode {
  id: string;
  name: string;
  width: number;
  height: number;
}

export interface FlowEdge {
  sourceId: string;
  targetId: string;
  trigger: string; // ON_CLICK, ON_HOVER, ON_DRAG, etc.
  action: string;  // NAVIGATE, OVERLAY, SWAP, BACK, etc.
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  startingPointIds: string[];
}

export interface LayoutNode {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutEdge {
  sourceId: string;
  targetId: string;
  trigger: string;
  action: string;
  points: { x: number; y: number }[];
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
}

export interface TierConfig {
  maxScreens: number;
  flowHighlighting: boolean;
  interactionLabels: boolean;
  pdfExport: boolean;
}

export const TIERS: Record<string, TierConfig> = {
  free: {
    maxScreens: 10,
    flowHighlighting: false,
    interactionLabels: false,
    pdfExport: false,
  },
  pro: {
    maxScreens: Infinity,
    flowHighlighting: true,
    interactionLabels: true,
    pdfExport: true,
  },
};

// Messages from code -> UI
export type CodeToUIMessage =
  | { type: 'graph'; graph: FlowGraph }
  | { type: 'generation-complete' }
  | { type: 'export-complete'; data: string; format: string }
  | { type: 'error'; message: string }
  | { type: 'status'; message: string };

// Messages from UI -> code
export type UIToCodeMessage =
  | { type: 'scan' }
  | { type: 'generate'; layout: LayoutResult; direction: 'LR' | 'TB' }
  | { type: 'export'; format: 'png' | 'pdf' }
  | { type: 'set-tier'; tier: string };
