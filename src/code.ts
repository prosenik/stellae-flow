/// <reference types="@figma/plugin-typings" />

import { FlowGraph, FlowNode, FlowEdge, LayoutResult, TIERS, TierConfig } from './types';

figma.showUI(__html__, { width: 420, height: 560, themeColors: true });

let currentTier: TierConfig = TIERS.free;
let diagramPage: PageNode | null = null;

// ─── Prototype Connection Scanner ───────────────────────────────

function scanPrototypeConnections(): FlowGraph {
  const page = figma.currentPage;
  const nodeMap = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];

  function walkNode(node: SceneNode) {
    if ('reactions' in node && (node as any).reactions) {
      const reactions = (node as any).reactions as Reaction[];
      for (const reaction of reactions) {
        if (!reaction.action) continue;
        const action = reaction.action as any;
        // We care about navigation/overlay actions that have a destination
        if (action.destinationId) {
          // Find the top-level frame ancestors for source and destination
          const sourceFrame = findTopFrame(node);
          const destNode = figma.getNodeById(action.destinationId);
          const destFrame = destNode ? findTopFrame(destNode as SceneNode) : null;

          if (sourceFrame && destFrame && sourceFrame.id !== destFrame.id) {
            // Register nodes
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

            const triggerType = reaction.trigger?.type || 'ON_CLICK';
            const actionType = action.type || 'NAVIGATE';

            edges.push({
              sourceId: sourceFrame.id,
              targetId: destFrame.id,
              trigger: triggerType,
              action: actionType,
            });
          }
        }
      }
    }

    if ('children' in node) {
      for (const child of (node as any).children) {
        walkNode(child);
      }
    }
  }

  // Walk all top-level children
  for (const child of page.children) {
    walkNode(child);
  }

  // Detect flow starting points
  const startingPointIds: string[] = [];
  if (page.flowStartingPoints) {
    for (const sp of page.flowStartingPoints) {
      if (nodeMap.has(sp.nodeId)) {
        startingPointIds.push(sp.nodeId);
      }
    }
  }

  // If no starting points defined, use nodes with no incoming edges
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

function findTopFrame(node: SceneNode): FrameNode | null {
  let current: BaseNode | null = node;
  while (current) {
    if (current.parent && current.parent.type === 'PAGE') {
      return current.type === 'FRAME' || current.type === 'COMPONENT' || current.type === 'COMPONENT_SET'
        ? (current as FrameNode)
        : null;
    }
    current = current.parent;
  }
  return null;
}

// ─── Flow Diagram Generator ─────────────────────────────────────

// Color palette for flow highlighting
const FLOW_COLORS: RGB[] = [
  { r: 0.18, g: 0.8, b: 0.44 },   // green - happy path
  { r: 0.91, g: 0.3, b: 0.24 },   // red - error
  { r: 0.2, g: 0.6, b: 0.86 },    // blue
  { r: 0.95, g: 0.61, b: 0.07 },  // orange
  { r: 0.56, g: 0.27, b: 0.68 },  // purple
];

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

async function generateDiagram(layout: LayoutResult) {
  const sourcePage = figma.currentPage;

  // Create or reuse diagram page
  const pageName = `${sourcePage.name} — Flow Diagram`;
  let existingPage = figma.root.children.find(p => p.name === pageName);
  if (existingPage) {
    // Clear it
    for (const child of [...existingPage.children]) {
      child.remove();
    }
    diagramPage = existingPage;
  } else {
    diagramPage = figma.createPage();
    diagramPage.name = pageName;
  }

  // Switch to source page first to export thumbnails
  const thumbnailScale = 0.25;
  const thumbnails = new Map<string, Uint8Array>();

  figma.notify('Generating thumbnails...');
  
  for (const layoutNode of layout.nodes) {
    const node = figma.getNodeById(layoutNode.id);
    if (node && 'exportAsync' in node) {
      try {
        const bytes = await (node as FrameNode).exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: thumbnailScale },
        });
        thumbnails.set(layoutNode.id, bytes);
      } catch (e) {
        console.error(`Failed to export ${layoutNode.name}:`, e);
      }
    }
  }

  // Switch to diagram page
  figma.currentPage = diagramPage;

  // Padding and sizing
  const THUMB_W = 300;
  const THUMB_H = 200;
  const PADDING = 40;
  const CARD_PADDING = 12;

  // Create container frame
  const container = figma.createFrame();
  container.name = 'Flow Diagram';
  container.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.97, b: 0.98 } }];

  // Compute bounding box from layout
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of layout.nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + THUMB_W + CARD_PADDING * 2);
    maxY = Math.max(maxY, n.y + THUMB_H + CARD_PADDING * 2 + 40);
  }

  container.resize(
    maxX - minX + PADDING * 2,
    maxY - minY + PADDING * 2
  );

  // Assign flow colors based on paths from starting points
  const flowColors = assignFlowColors(layout);

  // Create screen cards
  const cardMap = new Map<string, FrameNode>();
  
  for (const layoutNode of layout.nodes) {
    const card = figma.createFrame();
    card.name = `Screen: ${layoutNode.name}`;
    card.x = layoutNode.x - minX + PADDING;
    card.y = layoutNode.y - minY + PADDING;
    card.resize(THUMB_W + CARD_PADDING * 2, THUMB_H + CARD_PADDING * 2 + 40);
    card.cornerRadius = 12;
    card.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    card.effects = [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.1 },
        offset: { x: 0, y: 4 },
        radius: 16,
        spread: 0,
        visible: true,
        blendMode: 'NORMAL',
      },
    ];

    // Thumbnail image
    const thumbBytes = thumbnails.get(layoutNode.id);
    if (thumbBytes) {
      const thumbRect = figma.createRectangle();
      thumbRect.name = 'Thumbnail';
      thumbRect.x = CARD_PADDING;
      thumbRect.y = CARD_PADDING;
      thumbRect.resize(THUMB_W, THUMB_H);
      thumbRect.cornerRadius = 6;

      const image = figma.createImage(thumbBytes);
      thumbRect.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FIT' }];
      card.appendChild(thumbRect);
    }

    // Screen name label
    const label = figma.createText();
    await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
    label.fontName = { family: 'Inter', style: 'Medium' };
    label.fontSize = 14;
    label.characters = layoutNode.name;
    label.x = CARD_PADDING;
    label.y = THUMB_H + CARD_PADDING + 10;
    label.resize(THUMB_W, 20);
    label.textTruncation = 'ENDING';
    label.fills = [{ type: 'SOLID', color: { r: 0.13, g: 0.13, b: 0.13 } }];
    card.appendChild(label);

    container.appendChild(card);
    cardMap.set(layoutNode.id, card);
  }

  // Draw arrows for edges
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  
  for (const edge of layout.edges) {
    const sourceCard = cardMap.get(edge.sourceId);
    const targetCard = cardMap.get(edge.targetId);
    if (!sourceCard || !targetCard) continue;

    const color = currentTier.flowHighlighting
      ? (flowColors.get(`${edge.sourceId}-${edge.targetId}`) || FLOW_COLORS[0])
      : { r: 0.4, g: 0.4, b: 0.45 };

    // Create arrow line using vector
    const arrow = createArrow(
      sourceCard.x + sourceCard.width,
      sourceCard.y + sourceCard.height / 2,
      targetCard.x,
      targetCard.y + targetCard.height / 2,
      color,
    );
    container.appendChild(arrow);

    // Add trigger badge if tier allows
    if (currentTier.interactionLabels) {
      const midX = (sourceCard.x + sourceCard.width + targetCard.x) / 2;
      const midY = (sourceCard.y + sourceCard.height / 2 + targetCard.y + targetCard.height / 2) / 2;

      const badge = createBadge(
        TRIGGER_LABELS[edge.trigger] || edge.trigger,
        midX,
        midY - 12,
        color
      );
      container.appendChild(badge);
    }
  }

  // Store reference for export
  diagramPage = figma.currentPage;
  
  figma.notify('✨ Flow diagram generated!');
  figma.ui.postMessage({ type: 'generation-complete' });
}

function createArrow(x1: number, y1: number, x2: number, y2: number, color: RGB): VectorNode {
  const vector = figma.createVector();
  vector.name = 'Arrow';

  const gap = 8;
  const arrowSize = 10;

  // Adjust start/end for gap
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len;
  const uy = dy / len;

  const sx = x1 + ux * gap;
  const sy = y1 + uy * gap;
  const ex = x2 - ux * gap;
  const ey = y2 - uy * gap;

  // Arrow head points
  const ax1 = ex - ux * arrowSize - uy * arrowSize * 0.5;
  const ay1 = ey - uy * arrowSize + ux * arrowSize * 0.5;
  const ax2 = ex - ux * arrowSize + uy * arrowSize * 0.5;
  const ay2 = ey - uy * arrowSize - ux * arrowSize * 0.5;

  // Build SVG path data relative to node origin
  const allX = [sx, ex, ax1, ax2];
  const allY = [sy, ey, ay1, ay2];
  const originX = Math.min(...allX);
  const originY = Math.min(...allY);

  vector.x = originX;
  vector.y = originY;

  const rsx = sx - originX, rsy = sy - originY;
  const rex = ex - originX, rey = ey - originY;
  const rax1 = ax1 - originX, ray1 = ay1 - originY;
  const rax2 = ax2 - originX, ray2 = ay2 - originY;

  vector.vectorPaths = [
    {
      windingRule: 'NONZERO',
      data: `M ${rsx} ${rsy} L ${rex} ${rey}`,
    },
    {
      windingRule: 'NONZERO',
      data: `M ${rex} ${rey} L ${rax1} ${ray1} M ${rex} ${rey} L ${rax2} ${ray2}`,
    },
  ];

  vector.strokes = [{ type: 'SOLID', color }];
  vector.strokeWeight = 2;
  vector.strokeCap = 'ROUND';

  return vector;
}

function createBadge(text: string, x: number, y: number, color: RGB): FrameNode {
  const badge = figma.createFrame();
  badge.name = `Badge: ${text}`;
  badge.layoutMode = 'HORIZONTAL';
  badge.paddingLeft = 8;
  badge.paddingRight = 8;
  badge.paddingTop = 4;
  badge.paddingBottom = 4;
  badge.primaryAxisAlignItems = 'CENTER';
  badge.counterAxisAlignItems = 'CENTER';
  badge.cornerRadius = 10;
  badge.fills = [{ type: 'SOLID', color, opacity: 0.12 }];
  badge.x = x - 20;
  badge.y = y;
  badge.primaryAxisSizingMode = 'AUTO';
  badge.counterAxisSizingMode = 'AUTO';

  const label = figma.createText();
  label.fontName = { family: 'Inter', style: 'Regular' };
  label.fontSize = 11;
  label.characters = text;
  label.fills = [{ type: 'SOLID', color }];
  badge.appendChild(label);

  return badge;
}

function assignFlowColors(layout: LayoutResult): Map<string, RGB> {
  const colorMap = new Map<string, RGB>();
  // Simple: assign colors based on source node grouping
  const sourceNodes = [...new Set(layout.edges.map(e => e.sourceId))];
  for (const edge of layout.edges) {
    const idx = sourceNodes.indexOf(edge.sourceId) % FLOW_COLORS.length;
    colorMap.set(`${edge.sourceId}-${edge.targetId}`, FLOW_COLORS[idx]);
  }
  return colorMap;
}

// ─── Export ──────────────────────────────────────────────────────

async function exportDiagram(format: 'png' | 'pdf') {
  if (!diagramPage) {
    figma.ui.postMessage({ type: 'error', message: 'No diagram to export. Generate one first.' });
    return;
  }

  const frame = diagramPage.children.find(n => n.name === 'Flow Diagram');
  if (!frame || !('exportAsync' in frame)) {
    figma.ui.postMessage({ type: 'error', message: 'Flow Diagram frame not found.' });
    return;
  }

  try {
    if (format === 'pdf' && !currentTier.pdfExport) {
      figma.ui.postMessage({ type: 'error', message: 'PDF export is a Pro feature.' });
      return;
    }

    const settings: ExportSettings = format === 'pdf'
      ? { format: 'PDF' }
      : { format: 'PNG', constraint: { type: 'SCALE', value: 2 } };

    const bytes = await (frame as FrameNode).exportAsync(settings);
    
    // Convert to base64 for download
    const base64 = figma.base64Encode(bytes);
    figma.ui.postMessage({
      type: 'export-complete',
      data: base64,
      format,
    });
    figma.notify(`📁 ${format.toUpperCase()} exported!`);
  } catch (e: any) {
    figma.ui.postMessage({ type: 'error', message: `Export failed: ${e.message}` });
  }
}

// ─── Message Handler ─────────────────────────────────────────────

figma.ui.onmessage = async (msg: any) => {
  try {
    switch (msg.type) {
      case 'scan': {
        figma.ui.postMessage({ type: 'status', message: 'Scanning prototype connections...' });
        const graph = scanPrototypeConnections();
        
        if (graph.nodes.length === 0) {
          figma.ui.postMessage({ type: 'error', message: 'No prototype connections found on this page. Add some prototype links between frames first.' });
          return;
        }

        // Enforce tier limits
        if (graph.nodes.length > currentTier.maxScreens) {
          figma.ui.postMessage({
            type: 'error',
            message: `Free tier supports up to ${currentTier.maxScreens} screens. Found ${graph.nodes.length}. Upgrade to Pro for unlimited.`,
          });
          return;
        }

        figma.ui.postMessage({ type: 'graph', graph });
        figma.notify(`Found ${graph.nodes.length} screens, ${graph.edges.length} connections`);
        break;
      }

      case 'generate': {
        await generateDiagram(msg.layout);
        break;
      }

      case 'export': {
        await exportDiagram(msg.format);
        break;
      }

      case 'set-tier': {
        currentTier = TIERS[msg.tier] || TIERS.free;
        break;
      }
    }
  } catch (e: any) {
    figma.ui.postMessage({ type: 'error', message: e.message || 'Unknown error' });
  }
};
