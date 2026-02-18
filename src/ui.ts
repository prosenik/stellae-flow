import { FlowGraph, LayoutResult, LayoutNode, LayoutEdge } from './types';

// We bundle dagre inline since it's used in the UI iframe
import dagre from 'dagre';

// ─── State ───────────────────────────────────────────────────────

let currentGraph: FlowGraph | null = null;
let currentDirection: 'LR' | 'TB' = 'LR';
let currentTier = 'free';

// ─── UI Render ───────────────────────────────────────────────────

function render() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div class="header">
      <div class="logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#6C5CE7" stroke-width="2"/>
          <path d="M8 12L11 15L16 9" stroke="#6C5CE7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h1>stellae.flow</h1>
      </div>
      <p class="subtitle">Auto-generate flow diagrams from prototype connections</p>
    </div>

    <div class="section">
      <div class="controls-row">
        <button id="btn-scan" class="btn btn-primary">
          <span class="btn-icon">🔍</span> Scan Connections
        </button>
      </div>
    </div>

    <div id="graph-info" class="section hidden">
      <div class="stats">
        <div class="stat">
          <span class="stat-value" id="stat-screens">0</span>
          <span class="stat-label">Screens</span>
        </div>
        <div class="stat">
          <span class="stat-value" id="stat-connections">0</span>
          <span class="stat-label">Connections</span>
        </div>
        <div class="stat">
          <span class="stat-value" id="stat-flows">0</span>
          <span class="stat-label">Entry Points</span>
        </div>
      </div>

      <div class="node-list" id="node-list"></div>
    </div>

    <div id="settings" class="section">
      <h3>Settings</h3>
      <div class="setting-row">
        <label>Direction</label>
        <div class="toggle-group">
          <button class="toggle ${currentDirection === 'LR' ? 'active' : ''}" data-dir="LR">Left → Right</button>
          <button class="toggle ${currentDirection === 'TB' ? 'active' : ''}" data-dir="TB">Top → Bottom</button>
        </div>
      </div>
      <div class="setting-row">
        <label>Tier</label>
        <div class="toggle-group">
          <button class="toggle tier-toggle ${currentTier === 'free' ? 'active' : ''}" data-tier="free">Free</button>
          <button class="toggle tier-toggle ${currentTier === 'pro' ? 'active' : ''}" data-tier="pro">Pro</button>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="controls-row">
        <button id="btn-generate" class="btn btn-accent" disabled>
          <span class="btn-icon">✨</span> Generate Diagram
        </button>
      </div>
      <div class="controls-row export-row">
        <button id="btn-export-png" class="btn btn-secondary" disabled>📁 Export PNG</button>
        <button id="btn-export-pdf" class="btn btn-secondary ${currentTier !== 'pro' ? 'btn-disabled' : ''}" disabled>📄 Export PDF</button>
      </div>
    </div>

    <div id="status" class="status hidden"></div>
  `;

  bindEvents();
}

function bindEvents() {
  document.getElementById('btn-scan')!.addEventListener('click', () => {
    parent.postMessage({ pluginMessage: { type: 'scan' } }, '*');
    showStatus('Scanning...', 'info');
  });

  document.getElementById('btn-generate')!.addEventListener('click', () => {
    if (!currentGraph) return;
    const layout = computeLayout(currentGraph, currentDirection);
    parent.postMessage({ pluginMessage: { type: 'generate', layout, direction: currentDirection } }, '*');
    showStatus('Generating diagram...', 'info');
  });

  document.getElementById('btn-export-png')!.addEventListener('click', () => {
    parent.postMessage({ pluginMessage: { type: 'export', format: 'png' } }, '*');
  });

  document.getElementById('btn-export-pdf')!.addEventListener('click', () => {
    if (currentTier !== 'pro') return;
    parent.postMessage({ pluginMessage: { type: 'export', format: 'pdf' } }, '*');
  });

  // Direction toggles
  document.querySelectorAll('.toggle[data-dir]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentDirection = (btn as HTMLElement).dataset.dir as 'LR' | 'TB';
      document.querySelectorAll('.toggle[data-dir]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Tier toggles
  document.querySelectorAll('.tier-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTier = (btn as HTMLElement).dataset.tier || 'free';
      parent.postMessage({ pluginMessage: { type: 'set-tier', tier: currentTier } }, '*');
      render();
    });
  });
}

// ─── Layout Computation (dagre) ──────────────────────────────────

function computeLayout(graph: FlowGraph, direction: 'LR' | 'TB'): LayoutResult {
  const CARD_W = 324;  // THUMB_W + padding
  const CARD_H = 252;  // THUMB_H + padding + label

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

// ─── Status Display ──────────────────────────────────────────────

function showStatus(message: string, type: 'info' | 'error' | 'success') {
  const el = document.getElementById('status');
  if (!el) return;
  el.className = `status status-${type}`;
  el.textContent = message;
  el.classList.remove('hidden');
  if (type !== 'error') {
    setTimeout(() => el.classList.add('hidden'), 3000);
  }
}

function updateGraphInfo(graph: FlowGraph) {
  const section = document.getElementById('graph-info')!;
  section.classList.remove('hidden');

  document.getElementById('stat-screens')!.textContent = String(graph.nodes.length);
  document.getElementById('stat-connections')!.textContent = String(graph.edges.length);
  document.getElementById('stat-flows')!.textContent = String(graph.startingPointIds.length);

  const list = document.getElementById('node-list')!;
  list.innerHTML = graph.nodes.map(n => {
    const isStart = graph.startingPointIds.includes(n.id);
    return `<div class="node-item ${isStart ? 'start-node' : ''}">
      <span class="node-dot"></span>
      <span class="node-name">${n.name}</span>
      ${isStart ? '<span class="badge">Start</span>' : ''}
    </div>`;
  }).join('');

  // Enable generate button
  const genBtn = document.getElementById('btn-generate') as HTMLButtonElement;
  genBtn.disabled = false;
}

// ─── Message Handler ─────────────────────────────────────────────

window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  switch (msg.type) {
    case 'graph':
      currentGraph = msg.graph;
      updateGraphInfo(msg.graph);
      showStatus(`Found ${msg.graph.nodes.length} screens`, 'success');
      break;

    case 'generation-complete':
      showStatus('Diagram generated! ✨', 'success');
      (document.getElementById('btn-export-png') as HTMLButtonElement).disabled = false;
      if (currentTier === 'pro') {
        (document.getElementById('btn-export-pdf') as HTMLButtonElement).disabled = false;
      }
      break;

    case 'export-complete':
      downloadFile(msg.data, msg.format);
      showStatus(`${msg.format.toUpperCase()} exported!`, 'success');
      break;

    case 'error':
      showStatus(msg.message, 'error');
      break;

    case 'status':
      showStatus(msg.message, 'info');
      break;
  }
};

function downloadFile(base64: string, format: string) {
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    pdf: 'application/pdf',
  };
  const blob = base64ToBlob(base64, mimeTypes[format] || 'application/octet-stream');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flow-diagram.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

// ─── Init ────────────────────────────────────────────────────────

render();
