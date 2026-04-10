import React, { useState, useCallback, useEffect } from "react";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Background,
  Position,
  getBezierPath,
} from "reactflow";
import Swal from "sweetalert2";
import "reactflow/dist/style.css";

import CustomNode, {
  buildDefaultHandles,
  buildWanPlaceholders,
  MIKROTIK_MODELS,
} from "./components/CustomNode/CustomNode";
import CloudNode from "./components/CloudNode/CloudNode";
import { PROVIDER_COLORS, WAN_COLORS } from "./constants";
import EditableEdge from "./components/EditableEdge/EditableEdge";
import WanEdge from "./components/WanEdge/WanEdge";
import Sidebar from "./components/Sidebar/Sidebar";
import MapControls from "./components/Controls/MapControls";
import ClientSelector from "./components/ClientSelector/ClientSelector";
import MapLegend from "./components/MapLegend/MapLegend";
import {
  nodesApi,
  connectionsApi,
  clientsApi,
  cloudsApi,
} from "./services/api";
import { socketService } from "./services/socket";

const nodeTypes = { customNode: CustomNode, cloudNode: CloudNode };
const edgeTypes = { editableEdge: EditableEdge, wanEdge: WanEdge };

// ── Línea de conexión WAN en tiempo real ──────────────────────────────────────
// Se muestra mientras el usuario arrastra desde un CloudNode hacia el nodo raíz,
// ANTES de que la conexión se confirme. Detecta si el origen es un cloudNode
// y usa el color naranja WAN para que la experiencia visual sea consistente.
let wanLineStyleInjected = false;
const injectWanLineStyle = () => {
  if (wanLineStyleInjected) return;
  wanLineStyleInjected = true;
  const s = document.createElement("style");
  s.textContent = `
    @keyframes wanConnecting {
      from { stroke-dashoffset: 24; }
      to   { stroke-dashoffset: 0; }
    }
    .wan-connecting-line {
      stroke-dasharray: 10 6;
      animation: wanConnecting 0.9s linear infinite;
    }
  `;
  document.head.appendChild(s);
};
injectWanLineStyle();

const WanConnectionLine = ({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  fromNode,
}) => {
  // Detectar si el origen es un proveedor (cloudNode)
  const isFromCloud = fromNode?.type === "cloudNode";
  const providerIndex = fromNode?.data?.providerIndex ?? 0;
  const color = isFromCloud
    ? (WAN_COLORS[providerIndex] ?? "#f97316")
    : "#3b82f6"; // azul normal para conexiones entre nodos

  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });

  const off = 3.5;
  // Vector perpendicular para las dos líneas paralelas
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  const pathUp = getBezierPath({
    sourceX: fromX + nx * off,
    sourceY: fromY + ny * off,
    sourcePosition: fromPosition,
    targetX: toX + nx * off,
    targetY: toY + ny * off,
    targetPosition: toPosition,
  })[0];
  const pathDown = getBezierPath({
    sourceX: fromX - nx * off,
    sourceY: fromY - ny * off,
    sourcePosition: fromPosition,
    targetX: toX - nx * off,
    targetY: toY - ny * off,
    targetPosition: toPosition,
  })[0];

  if (!isFromCloud) {
    // Conexión normal — línea simple azul
    return (
      <g>
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeOpacity={0.4}
        />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2.2}
          strokeDasharray="8 5"
          strokeLinecap="round"
          style={{ animation: "wanConnecting 0.9s linear infinite" }}
        />
        <circle
          cx={toX}
          cy={toY}
          r={4}
          fill={color}
          stroke="#fff"
          strokeWidth={2}
        />
      </g>
    );
  }

  // Conexión WAN — doble línea animada con el color naranja del proveedor
  return (
    <g>
      {/* Glow */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeOpacity={0.1}
      />

      {/* Upload */}
      <path
        d={pathUp}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeOpacity={0.2}
      />
      <path
        d={pathUp}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        className="wan-connecting-line"
        style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
      />

      {/* Download */}
      <path
        d={pathDown}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeOpacity={0.12}
      />
      <path
        d={pathDown}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeOpacity={0.6}
        strokeDasharray="10 6"
        strokeLinecap="round"
        style={{ animation: "wanConnecting 1.3s linear infinite reverse" }}
      />

      {/* Punto destino pulsante */}
      <circle
        cx={toX}
        cy={toY}
        r={7}
        fill={color}
        fillOpacity={0.15}
        stroke={color}
        strokeWidth={1.5}
        strokeOpacity={0.4}
      />
      <circle
        cx={toX}
        cy={toY}
        r={4}
        fill={color}
        stroke="#fff"
        strokeWidth={2.5}
        style={{ filter: `drop-shadow(0 0 5px ${color})` }}
      />

      {/* Mini badge "WAN" flotante */}
      <foreignObject
        x={toX + 10}
        y={toY - 12}
        width={60}
        height={22}
        style={{ overflow: "visible", pointerEvents: "none" }}
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            background: color,
            color: "#fff",
            fontSize: 9,
            fontWeight: 800,
            padding: "2px 7px",
            borderRadius: 10,
            whiteSpace: "nowrap",
            fontFamily: "system-ui,sans-serif",
            boxShadow: `0 2px 6px ${color}66`,
          }}
        >
          ☁️ WAN
        </div>
      </foreignObject>
    </g>
  );
};

// ── Sanitiza un handle: si era "target-top-0" / "source-top-0"
// (handles eliminados al reservar Top para WAN), lo reemplaza con null.
// sanitizeHandle — limpia handles obsoletos de conexiones guardadas en BD.
// Solo elimina los handles WAN placeholder (wan-placeholder-*) y handles
// que tenían formato "-top-" del esquema antiguo cuando Top era global.
// NO elimina handles normales en Top de nodos no raíz — son válidos.
const sanitizeHandle = (handle) => {
  if (!handle) return null;
  // Handles WAN placeholder — ya no existen una vez conectado un proveedor real
  if (handle.startsWith("wan-placeholder-")) return null;
  // Handles del esquema anterior donde Top estaba reservado globalmente
  // Solo aplica al formato exacto "source-top-N" / "target-top-N"
  if (/^(source|target)-top-\d+$/.test(handle)) return null;
  return handle;
};

// ── Edge normal (nodo ↔ nodo) ─────────────────────────────────────────────
const connectionToEdge = (conn, existingEdge = null) => ({
  id: `edge-${conn.id}`,
  source: conn.sourceId,
  target: conn.targetId,
  sourceHandle: sanitizeHandle(conn.sourceHandle),
  targetHandle: sanitizeHandle(conn.targetHandle),
  type: "editableEdge",
  animated: false,
  style: { stroke: "#3b82f6", strokeWidth: 2 },
  data: {
    connectionId: conn.id,
    waypoints: existingEdge?.data?.waypoints ?? conn.waypoints ?? [],
    sourceInterface: conn.sourceInterface ?? "",
    targetInterface: conn.targetInterface ?? "",
    linkType: conn.linkType ?? "",
    bandwidth: conn.bandwidth ?? "",
    vlan: conn.vlan ?? "",
    notes: conn.notes ?? "",
  },
});

// ── Edge WAN (nube ↔ nodo) ────────────────────────────────────────────────
// providerColor y providerName se usan en WanEdge para colorear la línea
// con el color del proveedor y mostrar su nombre en el badge.
const cloudConnectionToEdge = (conn, existingEdge = null, allClouds = []) => {
  // Calcular el color del proveedor por su índice de creación
  const sorted = [...allClouds].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
  const providerIndex = sorted.findIndex((c) => c.id === conn.cloudId);
  const providerColor =
    WAN_COLORS[providerIndex >= 0 ? providerIndex : 0] ?? "#f97316";
  const cloud = allClouds.find((c) => c.id === conn.cloudId);

  return {
    id: `wan-${conn.id}`,
    source: conn.cloudId,
    target: conn.nodeId,
    sourceHandle: "wan-out",
    targetHandle: `wan-in-${conn.cloudId}`,
    type: "wanEdge",
    animated: false,
    data: {
      connectionId: conn.id,
      nodePort: conn.nodePort ?? "",
      bandwidth: conn.cloud?.bandwidth ?? conn.bandwidth ?? "",
      waypoints: existingEdge?.data?.waypoints ?? [],
      isWan: true,
      providerColor,
      providerName: cloud?.name ?? conn.cloud?.name ?? "Proveedor",
      providerIndex: providerIndex >= 0 ? providerIndex : 0,
    },
  };
};

// ── Modal conexión normal ─────────────────────────────────────────────────
const LINK_TYPES = ["UTP", "Fibra", "SFP", "SFP+", "Wireless", "DAC", "Otro"];
const BANDWIDTHS = [
  "100 Mbps",
  "1 Gbps",
  "2.5 Gbps",
  "10 Gbps",
  "25 Gbps",
  "40 Gbps",
  "100 Gbps",
];

const askConnectionDetails = async (sourceName, targetName) => {
  const { value } = await Swal.fire({
    title: "Detalles del enlace",
    width: 480,
    showCancelButton: true,
    confirmButtonColor: "#3b82f6",
    confirmButtonText: "✓ Crear conexión",
    cancelButtonText: "Cancelar",
    html: `
      <div style="text-align:left;font-size:13px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;
          padding:8px 12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
          <span style="font-weight:700;color:#1e293b">${sourceName}</span>
          <span style="color:#94a3b8;font-size:18px">→</span>
          <span style="font-weight:700;color:#1e293b">${targetName}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div>
            <label style="font-size:11px;font-weight:700;color:#3b82f6;
              text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">
              Interfaz origen</label>
            <input id="srcIface" class="swal2-input" placeholder="ether2, sfp1…"
              style="margin:0;width:100%;font-family:monospace;font-size:12px;
              border-color:#bfdbfe;background:#eff6ff">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#22c55e;
              text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">
              Interfaz destino</label>
            <input id="dstIface" class="swal2-input" placeholder="ether3, sfp2…"
              style="margin:0;width:100%;font-family:monospace;font-size:12px;
              border-color:#bbf7d0;background:#f0fdf4">
          </div>
        </div>
        <label style="font-size:11px;font-weight:700;color:#64748b;
          text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px">
          Tipo de enlace</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
          ${LINK_TYPES.map(
            (t) => `
            <label style="cursor:pointer">
              <input type="radio" name="linkType" value="${t}" style="display:none">
              <span class="lt-chip" style="display:inline-block;padding:4px 10px;
                border-radius:20px;border:1.5px solid #e2e8f0;font-size:11px;
                font-weight:500;color:#64748b;background:#f8fafc">${t}</span>
            </label>`,
          ).join("")}
        </div>
        <label style="font-size:11px;font-weight:700;color:#64748b;
          text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px">
          Velocidad</label>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">
          ${BANDWIDTHS.map(
            (b) => `
            <label style="cursor:pointer">
              <input type="radio" name="bandwidth" value="${b}" style="display:none">
              <span class="bw-chip" data-bw="${b}" style="display:inline-block;padding:3px 9px;
                border-radius:20px;border:1.5px solid #e2e8f0;font-size:11px;
                color:#64748b;background:#f8fafc">${b}</span>
            </label>`,
          ).join("")}
        </div>
        <input id="bwCustom" class="swal2-input" placeholder="O escribe un valor…"
          style="margin:0 0 12px;width:100%;font-size:12px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="font-size:11px;font-weight:700;color:#64748b;
              text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">VLAN</label>
            <input id="vlan" class="swal2-input" placeholder="100, MGMT…"
              style="margin:0;width:100%;font-family:monospace;font-size:12px">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#64748b;
              text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Notas</label>
            <input id="notes" class="swal2-input" placeholder="Observaciones…"
              style="margin:0;width:100%;font-size:12px">
          </div>
        </div>
      </div>
      <style>
        .lt-chip.active{border-color:#3b82f6!important;background:#eff6ff!important;color:#2563eb!important;font-weight:700!important}
        .bw-chip.active{border-color:#6366f1!important;background:#eef2ff!important;color:#4f46e5!important;font-weight:700!important}
      </style>`,
    didOpen: () => {
      document.querySelectorAll(".lt-chip").forEach((chip) => {
        chip.parentElement.addEventListener("click", () => {
          document
            .querySelectorAll(".lt-chip")
            .forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
          chip.parentElement.querySelector("input").checked = true;
        });
      });
      document.querySelectorAll(".bw-chip").forEach((chip) => {
        chip.parentElement.addEventListener("click", () => {
          document
            .querySelectorAll(".bw-chip")
            .forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
          chip.parentElement.querySelector("input").checked = true;
          document.getElementById("bwCustom").value = chip.dataset.bw;
        });
      });
    },
    preConfirm: () => ({
      sourceInterface: document.getElementById("srcIface").value.trim(),
      targetInterface: document.getElementById("dstIface").value.trim(),
      linkType:
        document.querySelector('input[name="linkType"]:checked')?.value ?? "",
      bandwidth: document.getElementById("bwCustom").value.trim(),
      vlan: document.getElementById("vlan").value.trim(),
      notes: document.getElementById("notes").value.trim(),
    }),
  });
  return value ?? null;
};

// ── Modal conexión WAN ────────────────────────────────────────────────────
const askWanDetails = async (cloudName, nodeName) => {
  const { value } = await Swal.fire({
    title: "☁️ Enlace WAN",
    html: `
      <div style="text-align:left;font-size:13px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;
          padding:10px 14px;background:#f0f9ff;border-radius:10px;
          border:1px solid #bfdbfe">
          <span style="font-size:20px">☁️</span>
          <div>
            <div style="font-weight:700;color:#1e3a5f">${cloudName}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px">Proveedor de internet</div>
          </div>
          <span style="color:#94a3b8;font-size:20px;margin:0 4px">↔</span>
          <div>
            <div style="font-weight:700;color:#1e293b">${nodeName}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px">Nodo padre / router borde</div>
          </div>
        </div>
        <label style="font-size:11px;font-weight:700;color:#64748b;
          text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px">
          Puerto WAN del nodo padre</label>
        <input id="wanPort" class="swal2-input"
          placeholder="ether1, sfp-sfpplus1, wan1…"
          style="width:100%;font-family:monospace;margin:0;font-size:13px;
          border-color:#bfdbfe;background:#eff6ff">
        <p style="font-size:11px;color:#94a3b8;margin-top:6px">
          Puerto físico donde se conecta el cable del proveedor (opcional).
        </p>
      </div>`,
    focusConfirm: false,
    confirmButtonColor: "#1e3a5f",
    confirmButtonText: "☁️ Crear enlace WAN",
    showCancelButton: true,
    cancelButtonText: "Cancelar",
    preConfirm: () => ({
      nodePort: document.getElementById("wanPort").value.trim() || null,
    }),
  });
  return value ?? null;
};

// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isEditMode, setIsEditMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentClientId, setCurrentClientId] = useState(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [isEditingSidebar, setIsEditingSidebar] = useState(false);

  useEffect(() => {
    loadInitialClient();
    setupSocketConnection();
    return () => socketService.disconnect();
  }, []);

  useEffect(() => {
    if (currentClientId) loadNetworkMap(currentClientId);
    else {
      setNodes([]);
      setEdges([]);
    }
  }, [currentClientId]);

  const loadInitialClient = async () => {
    try {
      const res = await clientsApi.getAll();
      if (res.data?.length > 0) setCurrentClientId(res.data[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  const setupSocketConnection = () => {
    socketService.connect();
    socketService.onNodeStatusUpdate((data) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === data.nodeId
            ? {
                ...n,
                data: { ...n.data, status: data.status, ping: data.latencyMs },
              }
            : n,
        ),
      );
    });
    socketService.onCloudStatusUpdate((data) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === data.cloudId && n.type === "cloudNode"
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: data.status,
                  lastLatency: data.latencyMs,
                },
              }
            : n,
        ),
      );
    });
  };

  const handleHandlesChange = useCallback(
    async (nodeId, updatedHandles) => {
      // 1. Actualizar handles del nodo
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, handles: updatedHandles } }
            : n,
        ),
      );

      // 2. Forzar re-render de edges conectados a este nodo.
      //    Cuando los handles se redistribuyen, sus offsets CSS cambian pero
      //    los IDs se mantienen. ReactFlow necesita recalcular los endpoints
      //    de los edges que apuntan a esos handles.
      //    Tocar una propiedad del edge (style) fuerza el recálculo.
      setEdges((eds) =>
        eds.map((e) => {
          if (e.source !== nodeId && e.target !== nodeId) return e;
          // Verificar si alguno de los handles del edge está en updatedHandles
          const handleIds = updatedHandles.map((h) => h.id);
          const srcMoved = handleIds.includes(e.sourceHandle);
          const tgtMoved = handleIds.includes(e.targetHandle);
          if (!srcMoved && !tgtMoved) return e;
          // Forzar re-render tocando el estilo (no cambia nada visual)
          return { ...e, style: { ...e.style } };
        }),
      );

      try {
        await nodesApi.updateHandles(nodeId, updatedHandles);
      } catch (err) {
        console.error(err);
      }
    },
    [setNodes, setEdges],
  );

  const handleModelChange = useCallback(
    async (nodeId, newModel) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, model: newModel } } : n,
        ),
      );
      try {
        await nodesApi.updateNode(nodeId, { model: newModel });
      } catch (e) {
        console.error(e);
      }
    },
    [setNodes],
  );

  const openSidebar = useCallback(
    (nodeId) => {
      setNodes((nds) => {
        const node = nds.find((n) => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
          setIsSidebarOpen(true);
          setIsEditingSidebar(false);
        }
        return nds;
      });
    },
    [setNodes],
  );

  const handleCloudUpdate = useCallback(
    (cloudId, updatedData) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === cloudId ? { ...n, data: { ...n.data, ...updatedData } } : n,
        ),
      );
    },
    [setNodes],
  );

  // ── updateNodeConnectionCounts ────────────────────────────────────────────
  // IMPORTANTE: Solo los nodos marcados como isRootNode reciben handles WAN
  // naranjos. Nodos intermedios, hoja y aislados NUNCA los reciben, aunque
  // queden sin conexiones entrantes.
  const updateNodeConnectionCounts = useCallback(
    (sourceId, targetId, delta) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === sourceId) {
            const cur = n.data.connectionsAsSource ?? [];
            const newSrc =
              delta > 0 ? [...cur, { id: "tmp", targetId }] : cur.slice(0, -1);
            const newData = { ...n.data, connectionsAsSource: newSrc };
            const normalH = (n.data.handles || []).filter((h) => !h.isWan);
            const wanH =
              n.data.isRootNode &&
              (newData.connectionsAsTarget?.length ?? 0) === 0
                ? buildWanPlaceholders()
                : [];
            return {
              ...n,
              data: { ...newData, handles: [...normalH, ...wanH] },
            };
          }
          if (n.id === targetId) {
            const cur = n.data.connectionsAsTarget ?? [];
            const newTgt =
              delta > 0 ? [...cur, { id: "tmp", sourceId }] : cur.slice(0, -1);
            const newData = { ...n.data, connectionsAsTarget: newTgt };
            const normalH = (n.data.handles || []).filter((h) => !h.isWan);
            const wanH =
              n.data.isRootNode &&
              (newData.connectionsAsTarget?.length ?? 0) === 0
                ? buildWanPlaceholders()
                : [];
            return {
              ...n,
              data: { ...newData, handles: [...normalH, ...wanH] },
            };
          }
          return n;
        }),
      );
    },
    [setNodes],
  );

  // ── buildWanHandles ───────────────────────────────────────────────────────
  // Solo el nodo marcado como isRootNode tiene handles WAN naranjos arriba.
  const buildWanHandles = useCallback(
    (nodeId, cloudConnections, allClouds, nodeData) => {
      if (!nodeData?.isRootNode) return [];

      const myConns = cloudConnections.filter((c) => c.nodeId === nodeId);
      if (myConns.length === 0) {
        return [
          {
            id: "wan-placeholder-1",
            type: "target",
            position: Position.Top,
            offset: 35,
            isWan: true,
            color: "#f97316",
            cloudName: "Proveedor 1",
            isPlaceholder: true,
          },
          {
            id: "wan-placeholder-2",
            type: "target",
            position: Position.Top,
            offset: 65,
            isWan: true,
            color: "#ea580c",
            cloudName: "Proveedor 2",
            isPlaceholder: true,
          },
        ];
      }

      const sorted = [...allClouds].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      );
      const total = myConns.length;
      return myConns.map((conn, i) => {
        const cloud = allClouds.find((c) => c.id === conn.cloudId);
        const providerIndex = sorted.findIndex((c) => c.id === conn.cloudId);
        const color =
          WAN_COLORS[providerIndex >= 0 ? providerIndex : i] ?? "#f97316";
        const pct = total === 1 ? 50 : Math.round(20 + (60 / (total - 1)) * i);
        return {
          id: `wan-in-${conn.cloudId}`,
          type: "target",
          position: Position.Top,
          offset: pct,
          isWan: true,
          color,
          cloudId: conn.cloudId,
          cloudName: cloud?.name ?? "Proveedor",
          providerIndex: providerIndex >= 0 ? providerIndex : i,
        };
      });
    },
    [],
  );

  // ── makeReactFlowNode ─────────────────────────────────────────────────────
  const makeReactFlowNode = useCallback(
    (nodeData, existingNode = null, wanHandles = []) => {
      const baseHandles = nodeData.handles?.length
        ? nodeData.handles
        : (existingNode?.data?.handles ?? buildDefaultHandles());

      // Para nodo RAÍZ: quitar handles normales en Top (reservado exclusivamente
      // para WAN naranjas) y quitar WAN anteriores (se reemplazan con wanHandles).
      // Para nodos NORMALES: solo quitar WAN anteriores — Top está permitido
      // para handles azules/verdes normales.
      const normalHandles = nodeData.isRootNode
        ? baseHandles.filter((h) => !h.isWan && h.position !== "top")
        : baseHandles.filter((h) => !h.isWan);

      return {
        id: nodeData.id,
        type: "customNode",
        position: { x: nodeData.posX, y: nodeData.posY },
        data: {
          ...nodeData,
          handles: [...normalHandles, ...wanHandles],
          model: nodeData.model ?? existingNode?.data?.model ?? "GENERIC",
          onHandlesChange: handleHandlesChange,
          onModelChange: handleModelChange,
          onDoubleClick: openSidebar,
        },
      };
    },
    [handleHandlesChange, handleModelChange, openSidebar],
  );

  // ── makeCloudNode ─────────────────────────────────────────────────────────
  const makeCloudNode = useCallback(
    (cloudData, allClouds = []) => {
      const sorted = [...allClouds].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      );
      const idx = sorted.findIndex((c) => c.id === cloudData.id);
      return {
        id: cloudData.id,
        type: "cloudNode",
        position: { x: cloudData.posX, y: cloudData.posY },
        data: {
          ...cloudData,
          providerIndex: idx >= 0 ? idx : 0,
          onCloudUpdate: handleCloudUpdate,
        },
      };
    },
    [handleCloudUpdate],
  );

  // ── loadNetworkMap ────────────────────────────────────────────────────────
  const loadNetworkMap = async (clientId) => {
    setLoading(true);
    try {
      const [nodesRes, connsRes, cloudsRes, cloudConnsRes] = await Promise.all([
        nodesApi.getNodesByClient(clientId),
        nodesApi.getConnectionsByClient(clientId),
        cloudsApi.getByClient(clientId),
        cloudsApi.getConnectionsByClient(clientId),
      ]);
      const nodesData = nodesRes.data ?? [];
      const connsData = connsRes.data ?? [];
      const cloudsData = cloudsRes.data ?? [];
      const cloudConns = cloudConnsRes.data ?? [];

      setNodes((currentNodes) => [
        ...nodesData.map((node) => {
          const existing = currentNodes.find((n) => n.id === node.id);
          const wanHandles = buildWanHandles(
            node.id,
            cloudConns,
            cloudsData,
            node,
          );
          return makeReactFlowNode(node, existing, wanHandles);
        }),
        ...cloudsData.map((cloud) => makeCloudNode(cloud, cloudsData)),
      ]);

      setEdges((currentEdges) => [
        ...connsData.map((conn) => {
          const existing = currentEdges.find(
            (e) => e.data?.connectionId === conn.id,
          );
          return connectionToEdge(conn, existing);
        }),
        ...cloudConns.map((conn) => {
          const existing = currentEdges.find(
            (e) => e.data?.connectionId === conn.id && e.data?.isWan,
          );
          return cloudConnectionToEdge(conn, existing, cloudsData);
        }),
      ]);

      setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2 }), 100);
    } catch (e) {
      console.error("Error cargando mapa:", e);
    } finally {
      setLoading(false);
    }
  };

  // ── silentRefresh ─────────────────────────────────────────────────────────
  // Recarga los datos del mapa sin interrumpir la experiencia visual:
  //   • Sin spinner de carga
  //   • Sin fitView — el viewport no se mueve
  //   • Merge inteligente: preserva posición y handles de nodos ya renderizados
  //   • Solo actualiza datos que cambiaron (conexiones, roles, estados)
  const silentRefresh = useCallback(
    async (clientId) => {
      if (!clientId) return;
      try {
        const [nodesRes, connsRes, cloudsRes, cloudConnsRes] =
          await Promise.all([
            nodesApi.getNodesByClient(clientId),
            nodesApi.getConnectionsByClient(clientId),
            cloudsApi.getByClient(clientId),
            cloudsApi.getConnectionsByClient(clientId),
          ]);
        const nodesData = nodesRes.data ?? [];
        const connsData = connsRes.data ?? [];
        const cloudsData = cloudsRes.data ?? [];
        const cloudConns = cloudConnsRes.data ?? [];

        // Actualizar nodos — merge con estado visual actual
        // ⚠️ CRÍTICO: setNodes REEMPLAZA el estado completo.
        // Hay que incluir TANTO customNodes como cloudNodes.
        // Omitir los clouds hace que desaparezcan del mapa en cada refresh.
        setNodes((currentNodes) => [
          // ── Nodos de red (customNode) ────────────────────────────────────
          ...nodesData.map((node) => {
            const existing = currentNodes.find((n) => n.id === node.id);
            const wanHandles = buildWanHandles(
              node.id,
              cloudConns,
              cloudsData,
              node,
            );
            const built = makeReactFlowNode(node, existing, wanHandles);
            // Preservar posición visual si el nodo ya estaba en pantalla
            if (existing) built.position = existing.position;
            return built;
          }),
          // ── Nubes / proveedores (cloudNode) ──────────────────────────────
          // Sin este spread, setNodes borra todas las nubes del estado.
          ...cloudsData.map((cloud) => {
            const existing = currentNodes.find((n) => n.id === cloud.id);
            const built = makeCloudNode(cloud, cloudsData);
            // Preservar posición visual de la nube
            if (existing) built.position = existing.position;
            return built;
          }),
        ]);

        // Actualizar edges — merge preservando waypoints del estado actual
        setEdges((currentEdges) => [
          ...connsData.map((conn) => {
            const existing = currentEdges.find(
              (e) => e.data?.connectionId === conn.id,
            );
            return connectionToEdge(conn, existing);
          }),
          ...cloudConns.map((conn) => {
            const existing = currentEdges.find(
              (e) => e.data?.connectionId === conn.id && e.data?.isWan,
            );
            return cloudConnectionToEdge(conn, existing, cloudsData);
          }),
        ]);
      } catch (e) {
        console.error("silentRefresh error:", e);
      }
    },
    [
      setNodes,
      setEdges,
      buildWanHandles,
      makeReactFlowNode,
      makeCloudNode,
      buildDefaultHandles,
    ],
  );
  const onNodeDragStop = useCallback(
    async (_, node) => {
      if (!isEditMode) return;
      if (node.type === "cloudNode") {
        await cloudsApi.updatePosition(
          node.id,
          node.position.x,
          node.position.y,
        );
      } else {
        await nodesApi.updateNodePosition(
          node.id,
          node.position.x,
          node.position.y,
        );
      }
    },
    [isEditMode],
  );

  // ── onReconnect ───────────────────────────────────────────────────────────
  const onReconnect = useCallback(
    async (oldEdge, newConn) => {
      const connectionId = oldEdge.data?.connectionId;
      const isWan = oldEdge.data?.isWan;
      try {
        if (isWan) {
          if (connectionId) await cloudsApi.deleteConnection(connectionId);
          const srcNode = nodes.find((n) => n.id === newConn.source);
          const cloudId =
            srcNode?.type === "cloudNode" ? newConn.source : newConn.target;
          const nodeId =
            srcNode?.type === "cloudNode" ? newConn.target : newConn.source;
          const res = await cloudsApi.createConnection(
            cloudId,
            nodeId,
            oldEdge.data?.nodePort,
          );
          const currentClouds = nodes
            .filter((n) => n.type === "cloudNode")
            .map((n) => n.data);
          setEdges((eds) =>
            eds.map((e) =>
              e.id === oldEdge.id
                ? cloudConnectionToEdge(res.data, null, currentClouds)
                : e,
            ),
          );
        } else {
          if (connectionId) await connectionsApi.delete(connectionId);
          const res = await connectionsApi.create(
            newConn.source,
            newConn.target,
            newConn.sourceHandle,
            newConn.targetHandle,
            oldEdge.data?.waypoints ?? [],
            {
              sourceInterface: oldEdge.data?.sourceInterface,
              targetInterface: oldEdge.data?.targetInterface,
              linkType: oldEdge.data?.linkType,
              bandwidth: oldEdge.data?.bandwidth,
            },
          );
          setEdges((eds) =>
            eds.map((e) =>
              e.id === oldEdge.id ? connectionToEdge(res.data) : e,
            ),
          );
        }
      } catch {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudo reconectar",
        });
        loadNetworkMap(currentClientId);
      }
    },
    [currentClientId, setEdges, nodes],
  );

  // ── onEdgeDoubleClick ─────────────────────────────────────────────────────
  const onEdgeDoubleClick = useCallback(
    async (_, edge) => {
      if (!isEditMode) return;
      const result = await Swal.fire({
        title: "¿Eliminar conexión?",
        text: edge.data?.isWan
          ? "Se eliminará el enlace WAN con el proveedor."
          : "Se eliminará el vínculo entre estos dos equipos.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        confirmButtonText: "Sí, eliminar",
      });
      if (result.isConfirmed) {
        try {
          const connectionId = edge.data?.connectionId;
          if (connectionId) {
            if (edge.data?.isWan)
              await cloudsApi.deleteConnection(connectionId);
            else await connectionsApi.delete(connectionId);
          }

          if (edge.data?.isWan) {
            // WAN: silentRefresh inmediato — reconstruye handles naranjos del
            // nodo raíz (puede volver a placeholders si era el último proveedor)
            await silentRefresh(currentClientId);
          } else {
            // Normal: quitar edge del estado y actualizar contadores de rol
            setEdges((eds) => eds.filter((e) => e.id !== edge.id));
            updateNodeConnectionCounts(edge.source, edge.target, -1);
            setTimeout(() => silentRefresh(currentClientId), 400);
          }
        } catch {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "No se pudo eliminar la conexión",
          });
        }
      }
    },
    [isEditMode, setEdges, silentRefresh, currentClientId],
  );

  // ── onConnect ─────────────────────────────────────────────────────────────
  const onConnect = useCallback(
    async (params) => {
      if (!isEditMode) {
        Swal.fire({
          icon: "info",
          title: "Modo edición desactivado",
          text: "Activa el modo edición para conectar nodos",
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 2000,
        });
        return;
      }

      const srcNode = nodes.find((n) => n.id === params.source);
      const dstNode = nodes.find((n) => n.id === params.target);
      const srcName = srcNode?.data?.name ?? "Origen";
      const dstName = dstNode?.data?.name ?? "Destino";

      // ── Conexión WAN: uno de los dos es cloudNode ─────────────────────
      if (srcNode?.type === "cloudNode" || dstNode?.type === "cloudNode") {
        const cloudNode = srcNode?.type === "cloudNode" ? srcNode : dstNode;
        const nodeNode = srcNode?.type === "cloudNode" ? dstNode : srcNode;

        if (!nodeNode || nodeNode.type === "cloudNode") {
          Swal.fire({
            icon: "info",
            title: "Conexión no permitida",
            text: "No puedes conectar dos nubes entre sí",
            confirmButtonColor: "#3b82f6",
          });
          return;
        }

        const tHandle = params.targetHandle ?? "";
        const sHandle = params.sourceHandle ?? "";
        const isNormalHandle = (h) => h && !h.startsWith("wan-") && h !== "";
        const nodeHandle = srcNode?.type === "cloudNode" ? tHandle : sHandle;
        if (isNormalHandle(nodeHandle)) {
          Swal.fire({
            icon: "info",
            title: "Conecta al punto naranja ☁️",
            text: "Arrastra desde la nube hasta el punto naranja en la parte superior del nodo raíz.",
            confirmButtonColor: "#f97316",
          });
          return;
        }

        const dup = edges.find(
          (e) =>
            e.data?.isWan &&
            ((e.source === cloudNode.id && e.target === nodeNode.id) ||
              (e.source === nodeNode.id && e.target === cloudNode.id)),
        );
        if (dup) {
          Swal.fire({
            icon: "info",
            title: "Ya conectados",
            text: "Ya existe un enlace WAN entre este proveedor y este nodo",
            toast: true,
            position: "top-end",
            showConfirmButton: false,
            timer: 2500,
          });
          return;
        }

        const details = await askWanDetails(
          cloudNode.data.name,
          nodeNode.data.name,
        );
        if (!details) return;

        try {
          // 1. Guardar en BD
          await cloudsApi.createConnection(
            cloudNode.id,
            nodeNode.id,
            details.nodePort,
          );

          // 2. silentRefresh inmediato — reconstruye nodos + edges + handles
          //    desde la BD con datos 100% frescos. Evita cualquier problema de
          //    estado stale (handles placeholder vs handles reales, edges huérfanos).
          await silentRefresh(currentClientId);

          Swal.fire({
            icon: "success",
            title: "☁️ Enlace WAN creado",
            text: details.nodePort
              ? `Puerto: ${details.nodePort}`
              : "Conexión WAN establecida",
            toast: true,
            position: "top-end",
            showConfirmButton: false,
            timer: 2500,
          });
        } catch (error) {
          const msg =
            error.response?.data?.message ?? "No se pudo crear el enlace WAN";
          Swal.fire({ icon: "error", title: "Error", text: msg });
        }
        return;
      }

      // ── Conexión normal: nodo ↔ nodo ──────────────────────────────────
      const dup = edges.find(
        (e) =>
          e.source === params.source &&
          e.target === params.target &&
          e.sourceHandle === params.sourceHandle &&
          e.targetHandle === params.targetHandle,
      );
      if (dup) {
        Swal.fire({
          icon: "info",
          title: "Conexión existente",
          text: "Ya existe una línea entre esos puntos exactos",
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 2000,
        });
        return;
      }

      const details = await askConnectionDetails(srcName, dstName);
      if (!details) return;

      try {
        const res = await connectionsApi.create(
          params.source,
          params.target,
          params.sourceHandle,
          params.targetHandle,
          [],
          details,
        );
        setEdges((eds) => addEdge(connectionToEdge(res.data), eds));
        updateNodeConnectionCounts(params.source, params.target, +1);
        Swal.fire({
          icon: "success",
          title: "Enlace creado",
          text:
            details.sourceInterface && details.targetInterface
              ? `${details.sourceInterface} → ${details.targetInterface}`
              : "Conexión establecida",
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 2500,
        });
        // Refresh silencioso — actualiza badges de rol (raíz/intermedio/hoja)
        // sin mover el viewport ni mostrar spinner
        setTimeout(() => silentRefresh(currentClientId), 650);
      } catch (error) {
        const msg =
          error.response?.data?.message ?? "No se pudieron conectar los nodos";
        Swal.fire({ icon: "error", title: "Error", text: msg });
      }
    },
    [isEditMode, setEdges, edges, nodes, silentRefresh, currentClientId],
  );

  // ── handleNodeUpdate ──────────────────────────────────────────────────────
  const handleNodeUpdate = useCallback(
    (updatedData) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? { ...n, data: { ...n.data, ...updatedData } }
            : n,
        ),
      );
      setSelectedNode((prev) => ({
        ...prev,
        data: { ...prev.data, ...updatedData },
      }));
    },
    [selectedNode, setNodes],
  );

  // ── handleAddCloud ────────────────────────────────────────────────────────
  const handleAddCloud = async () => {
    if (!currentClientId) {
      Swal.fire({
        icon: "info",
        title: "Sin cliente",
        text: "Primero selecciona un cliente",
        confirmButtonColor: "#3b82f6",
      });
      return;
    }
    const LTYPES = [
      "Fibra",
      "Radio",
      "DOCSIS",
      "Satélite",
      "MPLS",
      "SD-WAN",
      "Otro",
    ];
    const { value } = await Swal.fire({
      title: "☁️ Agregar Proveedor",
      width: 480,
      html: `
        <p style="font-size:12px;color:#64748b;margin-bottom:14px">
          Configura los detalles del proveedor de internet
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:left">
          <div>
            <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:3px">Nombre *</label>
            <input id="cName" class="swal2-input" placeholder="Claro Fibra, CNT…" style="margin:0;width:100%">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:3px">IP pública</label>
            <input id="cIp" class="swal2-input" placeholder="8.8.8.8" style="margin:0;width:100%;font-family:monospace">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:3px">Ancho de banda</label>
            <input id="cBw" class="swal2-input" placeholder="200 Mbps" style="margin:0;width:100%">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:3px">Tipo de enlace</label>
            <select id="cLink" class="swal2-input" style="margin:0;width:100%;cursor:pointer">
              <option value="">— Seleccionar —</option>
              ${LTYPES.map((t) => `<option value="${t}">${t}</option>`).join("")}
            </select>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:3px">SLA</label>
            <input id="cSla" class="swal2-input" placeholder="99.9%" style="margin:0;width:100%">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:3px">ASN / BGP</label>
            <input id="cAsn" class="swal2-input" placeholder="AS3549" style="margin:0;width:100%;font-family:monospace">
          </div>
        </div>
        <div style="margin-top:10px;display:flex;align-items:center;gap:8px">
          <input type="checkbox" id="cPrimary" style="cursor:pointer">
          <label for="cPrimary" style="font-size:12px;color:#475569;cursor:pointer;font-weight:500">
            👑 Marcar como proveedor principal
          </label>
        </div>`,
      focusConfirm: false,
      confirmButtonColor: "#3b82f6",
      confirmButtonText: "☁️ Crear proveedor",
      showCancelButton: true,
      preConfirm: () => {
        const name = document.getElementById("cName").value.trim();
        if (!name) {
          Swal.showValidationMessage("El nombre es obligatorio");
          return false;
        }
        return {
          name,
          clientId: currentClientId,
          ip: document.getElementById("cIp").value.trim() || undefined,
          bandwidth: document.getElementById("cBw").value.trim() || undefined,
          linkType: document.getElementById("cLink").value || undefined,
          sla: document.getElementById("cSla").value.trim() || undefined,
          asn: document.getElementById("cAsn").value.trim() || undefined,
          isPrimary: document.getElementById("cPrimary").checked,
          posX: Math.random() * 400 + 200,
          posY: 60,
        };
      },
    });
    if (!value) return;
    try {
      const res = await cloudsApi.create(value);
      const currentClouds = nodes
        .filter((n) => n.type === "cloudNode")
        .map((n) => n.data);
      setNodes((nds) => [
        ...nds,
        makeCloudNode(res.data, [...currentClouds, res.data]),
      ]);
      Swal.fire({
        icon: "success",
        title: "☁️ Proveedor creado",
        text: `${value.name} agregado al mapa`,
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 2500,
      });
    } catch (error) {
      const msg =
        error.response?.data?.message ?? "Error al crear el proveedor";
      Swal.fire({ icon: "error", title: "Error", text: msg });
    }
  };

  // ── handleAddNode ─────────────────────────────────────────────────────────
  const handleAddNode = async () => {
    if (!currentClientId) {
      Swal.fire({
        icon: "info",
        title: "Sin cliente",
        text: "Primero debes crear o seleccionar un cliente",
        confirmButtonColor: "#3b82f6",
      });
      return;
    }

    // Paso 1/3: Tipo de nodo
    const { value: nodeType } = await Swal.fire({
      title: "Agregar equipo — Paso 1/3",
      html: `
        <p style="font-size:13px;color:#64748b;margin:0 0 16px">
          ¿Qué rol tendrá este equipo en la red?
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 8px">
          <label id="lbl-root" onclick="
            document.getElementById('type-root').checked=true;
            document.getElementById('lbl-root').style.borderColor='#f97316';
            document.getElementById('lbl-root').style.background='#fff7ed';
            document.getElementById('lbl-child').style.borderColor='#e2e8f0';
            document.getElementById('lbl-child').style.background='#f8fafc';
          " style="cursor:pointer;padding:16px 12px;border-radius:10px;
            border:2px solid #f97316;background:#fff7ed;text-align:center;transition:all 0.15s">
            <input type="radio" id="type-root" name="nodeType" value="root" checked style="display:none">
            <div style="font-size:22px;margin-bottom:6px">👑</div>
            <div style="font-size:13px;font-weight:700;color:#c2410c">Nodo Padre</div>
            <div style="font-size:11px;color:#9a3412;margin-top:4px;line-height:1.4">
              Raíz de la red.<br>Recibe proveedores ISP.<br>Tiene puntos naranjas ☁️
            </div>
          </label>
          <label id="lbl-child" onclick="
            document.getElementById('type-child').checked=true;
            document.getElementById('lbl-child').style.borderColor='#3b82f6';
            document.getElementById('lbl-child').style.background='#eff6ff';
            document.getElementById('lbl-root').style.borderColor='#e2e8f0';
            document.getElementById('lbl-root').style.background='#f8fafc';
          " style="cursor:pointer;padding:16px 12px;border-radius:10px;
            border:2px solid #e2e8f0;background:#f8fafc;text-align:center;transition:all 0.15s">
            <input type="radio" id="type-child" name="nodeType" value="child" style="display:none">
            <div style="font-size:22px;margin-bottom:6px">🔗</div>
            <div style="font-size:13px;font-weight:700;color:#1d4ed8">Nodo Hijo</div>
            <div style="font-size:11px;color:#1e40af;margin-top:4px;line-height:1.4">
              Intermedio, hoja o cliente.<br>Se conecta al padre.<br>Sin puntos naranjas
            </div>
          </label>
        </div>`,
      width: 460,
      focusConfirm: false,
      confirmButtonColor: "#3b82f6",
      confirmButtonText: "Siguiente →",
      showCancelButton: true,
      cancelButtonText: "Cancelar",
      preConfirm: () =>
        document.querySelector('input[name="nodeType"]:checked')?.value ??
        "child",
    });
    if (!nodeType) return;
    const isRootNode = nodeType === "root";

    // Paso 2/3: Nombre e IP
    const { value: step2 } = await Swal.fire({
      title: `Paso 2/3 — ${isRootNode ? "Nodo Padre" : "Nodo Hijo"}`,
      html: `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;
          padding:8px 12px;background:${isRootNode ? "#fff7ed" : "#eff6ff"};
          border-radius:8px;border:1px solid ${isRootNode ? "#fed7aa" : "#bfdbfe"}">
          <span style="font-size:16px">${isRootNode ? "👑" : "🔗"}</span>
          <span style="font-size:12px;font-weight:600;color:${isRootNode ? "#c2410c" : "#1d4ed8"}">
            ${isRootNode ? "Este nodo recibirá los proveedores de internet" : "Este nodo se conectará bajo el nodo padre"}
          </span>
        </div>
        <input id="nodeName" class="swal2-input" placeholder="Nombre del equipo">
        <input id="nodeIp"   class="swal2-input" placeholder="Dirección IP">`,
      focusConfirm: false,
      confirmButtonColor: "#3b82f6",
      confirmButtonText: "Siguiente →",
      showCancelButton: true,
      preConfirm: () => {
        const name = document.getElementById("nodeName").value.trim();
        const ip = document.getElementById("nodeIp").value.trim();
        if (!name || !ip) {
          Swal.showValidationMessage("Nombre e IP son obligatorios");
          return false;
        }
        return { name, ip };
      },
    });
    if (!step2) return;

    // Paso 3/3: Modelo
    const modelOpts = MIKROTIK_MODELS.map(
      (m) => `
      <label style="display:flex;flex-direction:column;align-items:center;gap:4px;
        cursor:pointer;padding:8px 6px;border-radius:8px;
        border:1.5px solid #e2e8f0;background:#f8fafc;min-width:0">
        <input type="radio" name="modelPick" value="${m}" style="display:none" ${m === "GENERIC" ? "checked" : ""}>
        <span style="font-size:11px;font-weight:700;color:#1e293b">${m}</span>
      </label>`,
    ).join("");

    const { value: selectedModel } = await Swal.fire({
      title: "Paso 3/3 — Modelo del equipo",
      html: `<p style="font-size:13px;color:#64748b;margin-bottom:12px">Selecciona el modelo MikroTik</p>
             <div id="modelGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:center">
               ${modelOpts}
             </div>
             <style>
               #modelGrid label:has(input:checked){border-color:#3b82f6;background:#eff6ff;}
               #modelGrid label:hover{border-color:#94a3b8}
             </style>`,
      width: 480,
      focusConfirm: false,
      confirmButtonColor: "#3b82f6",
      confirmButtonText: "✓ Crear equipo",
      showCancelButton: true,
      didOpen: () => {
        document.querySelectorAll("#modelGrid label").forEach((label) => {
          label.addEventListener("click", () => {
            document.querySelectorAll("#modelGrid label").forEach((l) => {
              l.style.borderColor = "#e2e8f0";
              l.style.background = "#f8fafc";
            });
            label.style.borderColor = "#3b82f6";
            label.style.background = "#eff6ff";
          });
        });
      },
      preConfirm: () =>
        document.querySelector('#modelGrid input[name="modelPick"]:checked')
          ?.value ?? "GENERIC",
    });
    if (selectedModel === undefined) return;

    // Handles según el rol
    const handles = isRootNode
      ? [...buildDefaultHandles(), ...buildWanPlaceholders()]
      : buildDefaultHandles();

    try {
      const res = await nodesApi.createNode({
        name: step2.name,
        ip: step2.ip,
        description: isRootNode
          ? "Nodo raíz — punto de entrada de proveedores"
          : "Equipo de red",
        posX: Math.random() * 800 + 100,
        posY: Math.random() * 400 + 200,
        clientId: currentClientId,
        handles,
        model: selectedModel,
        isRootNode,
      });
      // Garantizar que isRootNode esté en data aunque el backend no lo devuelva
      const nodeData = { ...res.data, isRootNode };
      setNodes((nds) => [
        ...nds,
        makeReactFlowNode(
          nodeData,
          null,
          isRootNode ? buildWanPlaceholders() : [],
        ),
      ]);
      Swal.fire({
        icon: "success",
        title: `${isRootNode ? "👑 Nodo Padre" : "🔗 Nodo Hijo"} creado`,
        text: `${step2.name} (${selectedModel}) listo en el mapa`,
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 2500,
      });
    } catch (error) {
      const raw = error.response?.data?.message;
      const msg = Array.isArray(raw)
        ? raw.join("\n")
        : (raw ?? "Error inesperado");
      Swal.fire({
        icon: "error",
        title: "No se pudo crear el equipo",
        text: msg,
        confirmButtonColor: "#3b82f6",
      });
    }
  };

  // ── Core de captura: fitView + html-to-image ──────────────────────────────
  // Estrategia 100% compatible con cualquier versión de ReactFlow:
  //   1. Guardar viewport actual.
  //   2. fitView() — encuadra todos los nodos, funciona en todas las versiones.
  //   3. Esperar repaint.
  //   4. Capturar .react-flow__renderer con html-to-image.
  //   5. Restaurar viewport original.
  //
  const _capture = useCallback(
    async (format = "png") => {
      if (!reactFlowInstance) throw new Error("ReactFlow no inicializado");

      const rfNodes =
        reactFlowInstance.getNodes?.() ??
        nodes.filter((n) => n.type !== "cloudNode" || true);
      const customNodes = rfNodes.filter((n) => n.type !== undefined);
      if (!customNodes.length) throw new Error("No hay nodos en el mapa");

      // 1. Guardar viewport
      const prevVP = reactFlowInstance.getViewport?.() ?? {
        x: 0,
        y: 0,
        zoom: 1,
      };

      // 2. fitView para encuadrar todo — funciona en todas las versiones
      await reactFlowInstance.fitView({
        padding: 0.1,
        duration: 0,
        includeHiddenNodes: false,
      });
      await new Promise((r) => setTimeout(r, 200)); // esperar repaint

      // 3. Medir el renderer
      const rendererEl = document.querySelector(".react-flow__renderer");
      if (!rendererEl)
        throw new Error("No se encontró .react-flow__renderer en el DOM");

      const rect = rendererEl.getBoundingClientRect();

      // 4. Capturar
      const { toPng, toSvg } = await import("html-to-image");
      const captureFn = format === "svg" ? toSvg : toPng;

      const dataUrl = await captureFn(rendererEl, {
        backgroundColor: "#f1f5f9",
        width: rect.width,
        height: rect.height,
        pixelRatio: format === "svg" ? 1 : 3,
        cacheBust: true,
        skipFonts: false,
        filter: (node) => {
          // Excluir elementos de UI que no deben aparecer en la imagen
          const cls = node?.classList;
          if (cls?.contains("react-flow__background")) return false;
          if (cls?.contains("react-flow__controls")) return false;
          if (cls?.contains("react-flow__minimap")) return false;
          if (node?.getAttribute?.("data-id") === "map-controls") return false;
          // Excluir botones de la barra inferior (Agregar Equipo / Proveedor)
          if (
            node?.tagName === "BUTTON" &&
            node?.closest?.(".absolute.bottom-5")
          )
            return false;
          return true;
        },
      });

      // 5. Restaurar viewport
      if (reactFlowInstance.setViewport) {
        reactFlowInstance.setViewport(prevVP, { duration: 0 });
      }

      return dataUrl;
    },
    [reactFlowInstance, nodes],
  );

  // ── exportMapAsImage (PNG) ────────────────────────────────────────────────
  const exportMapAsImage = useCallback(async () => {
    Swal.fire({
      title: "Generando imagen…",
      text: "Capturando el mapa en alta calidad (3×)",
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const dataUrl = await _capture("png");
      const date = new Date().toISOString().slice(0, 10);
      const filename = `NetworkMap_${date}.png`;
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
      Swal.close();
      Swal.fire({
        icon: "success",
        title: "✅ PNG exportado",
        html: `<span style="font-size:13px;color:#475569">
                 Guardado como <code style="font-family:monospace;color:#3b82f6">${filename}</code>
               </span>`,
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3500,
      });
    } catch (e) {
      console.error("Export PNG error:", e);
      Swal.close();
      Swal.fire({
        icon: "error",
        title: "Error al exportar PNG",
        html: `<span style="font-size:12px;color:#64748b">
                 <code style="font-family:monospace">${e?.message ?? String(e)}</code>
               </span>`,
        confirmButtonColor: "#3b82f6",
      });
    }
  }, [_capture]);

  // ── exportMapAsSvg (SVG vectorial) ────────────────────────────────────────
  const exportMapAsSvg = useCallback(async () => {
    Swal.fire({
      title: "Generando SVG…",
      text: "Exportación vectorial en curso",
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const dataUrl = await _capture("svg");
      const date = new Date().toISOString().slice(0, 10);
      const filename = `NetworkMap_${date}.svg`;
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
      Swal.close();
      Swal.fire({
        icon: "success",
        title: "✅ SVG exportado",
        html: `<span style="font-size:13px;color:#475569">Guardado como <code style="font-family:monospace;color:#9333ea">${filename}</code></span>`,
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3500,
      });
    } catch (e) {
      console.error("Export SVG error:", e);
      Swal.close();
      Swal.fire({
        icon: "error",
        title: "Error al exportar SVG",
        html: `<span style="font-size:12px;color:#64748b"><code style="font-family:monospace">${e?.message ?? String(e)}</code></span>`,
        confirmButtonColor: "#3b82f6",
      });
    }
  }, [_capture]);

  // ── Helpers de UI ─────────────────────────────────────────────────────────
  const handleClientChange = (clientId) => {
    setCurrentClientId(clientId);
    setSelectedNode(null);
    setIsSidebarOpen(false);
  };

  const handleRefreshMap = useCallback(
    () => loadNetworkMap(currentClientId),
    [currentClientId],
  );

  const toggleEditMode = () => setIsEditMode((v) => !v);

  const closeSidebar = () => {
    setIsSidebarOpen(false);
    setSelectedNode(null);
    setIsEditingSidebar(false);
  };

  const handlePaneClick = useCallback(() => {
    if (isSidebarOpen) closeSidebar();
  }, [isSidebarOpen]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-screen h-screen flex relative bg-gray-50">
      <div className="flex-1 h-full relative">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onEdgeDoubleClick={onEdgeDoubleClick}
            reconnectRadius={20}
            onNodeDragStop={onNodeDragStop}
            onPaneClick={handlePaneClick}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionLineComponent={WanConnectionLine}
            connectionLineStyle={{ stroke: "transparent" }}
            fitView
            nodesDraggable={isEditMode}
            nodesConnectable={isEditMode}
            connectionMode="loose"
            edgesFocusable
            elementsSelectable
          >
            <Background variant="dots" gap={16} size={1} color="#cbd5e1" />
            <MapControls
              onToggleEdit={toggleEditMode}
              isEditMode={isEditMode}
              onExportImage={exportMapAsImage}
              onExportSvg={exportMapAsSvg}
            />
          </ReactFlow>
        </ReactFlowProvider>

        {currentClientId && (
          <div className="absolute bottom-5 left-5 z-20 flex gap-2">
            <button
              onClick={handleAddNode}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium text-sm"
            >
              ➕ Agregar Equipo
            </button>
            <button
              onClick={handleAddCloud}
              style={{
                background: "linear-gradient(135deg,#1e3a5f,#1e293b)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 4px 12px rgba(30,58,95,0.35)",
                fontWeight: 600,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              ☁️ Agregar Proveedor
            </button>
          </div>
        )}
      </div>

      <ClientSelector
        currentClientId={currentClientId}
        onClientChange={handleClientChange}
      />
      <MapLegend />

      {isSidebarOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            zIndex: 9999,
            pointerEvents: "all",
          }}
        >
          <Sidebar
            selectedNode={selectedNode?.data}
            onNodeUpdate={handleNodeUpdate}
            onClose={closeSidebar}
            currentNodeId={selectedNode?.id}
            allNodes={nodes}
            onRefreshMap={handleRefreshMap}
            isEditing={isEditingSidebar}
            setIsEditing={setIsEditingSidebar}
          />
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-30">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
        </div>
      )}
    </div>
  );
}

export default App;
