import React, { useState, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  useReactFlow,
} from "reactflow";
import { connectionsApi } from "../../services/api";
import {
  PORT_TYPE_TO_LINK_TYPE,
  PORT_TYPE_TO_BANDWIDTH,
  PORT_TYPE_LABELS,
  findPortByHandleId,
} from "../../config/routerModels";

// ── Constantes ────────────────────────────────────────────────────────────────

const LINK_TYPES = ["UTP", "Fibra", "SFP", "SFP+", "Wireless", "DAC", "Otro"];

const LINK_COLORS = {
  UTP: "#3b82f6",
  Fibra: "#f97316",
  SFP: "#8b5cf6",
  "SFP+": "#6366f1",
  Wireless: "#22c55e",
  DAC: "#ec4899",
  Otro: "#94a3b8",
};

const LINK_ICONS = {
  UTP: "🔵",
  Fibra: "🟠",
  SFP: "🟣",
  "SFP+": "🟤",
  Wireless: "📶",
  DAC: "🔗",
  Otro: "➖",
};

// Grosor dinámico del cable por tipo — los tipos de mayor velocidad se ven más gruesos
const LINK_THICKNESS = {
  UTP: 2,
  Fibra: 2.5,
  SFP: 2,
  "SFP+": 2.8,
  Wireless: 1.8,
  DAC: 3.2,
  Otro: 2,
};

const BANDWIDTHS = [
  "100 Mbps",
  "1 Gbps",
  "2.5 Gbps",
  "10 Gbps",
  "25 Gbps",
  "40 Gbps",
  "100 Gbps",
];

const ANIM_SPEED = {
  "100 Mbps": "1.8s",
  "1 Gbps": "1.2s",
  "2.5 Gbps": "0.9s",
  "10 Gbps": "0.6s",
  "25 Gbps": "0.45s",
  "40 Gbps": "0.35s",
  "100 Gbps": "0.25s",
};

// ── Estilos de animación globales ─────────────────────────────────────────────
let animStyleInjected = false;
const injectAnimStyles = () => {
  if (animStyleInjected) return;
  animStyleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes flowDash {
      from { stroke-dashoffset: 24; }
      to   { stroke-dashoffset: 0;  }
    }
    @keyframes flowDashWireless {
      from { stroke-dashoffset: 32; }
      to   { stroke-dashoffset: 0;  }
    }
    .edge-flow-line {
      stroke-dasharray: 8 4;
      animation: flowDash linear infinite;
    }
    .edge-flow-wireless {
      stroke-dasharray: 12 8;
      animation: flowDashWireless linear infinite;
    }

    /* ── Edges POR ENCIMA de los nodos ──
       Por defecto React Flow pinta los edges con z-index menor que los nodos,
       así que los cables pasan "detrás" de los cards. Subimos los edges para
       que se vean cruzando por encima de los routers.
       - El viewport de React Flow se sitúa dentro de .react-flow__viewport
       - Los edges viven en .react-flow__edges (svg)
       - Los nodos viven en .react-flow__node (div)
       Le ponemos z-index explícito a ambos. */
    .react-flow__edges {
      z-index: 1000 !important;
    }
    .react-flow__edge {
      z-index: 1000 !important;
    }
    /* Los elementos dentro de EdgeLabelRenderer (badges, waypoints) deben
       quedar por encima de los propios cables */
    .react-flow__edge-labels {
      z-index: 1001 !important;
    }
  `;
  document.head.appendChild(style);
};
injectAnimStyles();

// ── Helper: resolver interfaz/tipo desde handle + nodo ────────────────────────
//
// Dado un handleId y el nodo al que pertenece (source o target), retorna:
//   { interfaceName, portType, portSpeed } si el handle corresponde a un
//   puerto del catálogo; null si no.
//
// Se usa para:
//   1. Mostrar en la etiqueta del edge el nombre real del puerto (ether3 → sfp1)
//      aunque el usuario no haya escrito nada en sourceInterface/targetInterface.
//   2. Auto-inferir el color del cable cuando linkType está vacío.
const resolvePort = (node, handleId) => {
  if (!node || !handleId) return null;
  const model = node.data?.model;
  if (!model) return null;
  return findPortByHandleId(model, handleId);
};

// ── Panel de detalles ─────────────────────────────────────────────────────────

const ConnectionPanel = ({ edgeId, edgeData, onClose, onSave }) => {
  const data = edgeData ?? {};
  const [form, setForm] = useState({
    sourceInterface: data.sourceInterface ?? "",
    targetInterface: data.targetInterface ?? "",
    linkType: data.linkType ?? "",
    bandwidth: data.bandwidth ?? "",
    vlan: data.vlan ?? "",
    notes: data.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k, v) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (data.connectionId) {
        // `routing` se guarda localmente (en el edge data) pero también podemos
        // persistirlo en `notes` o crear un campo propio. Por ahora lo metemos
        // como campo extra — tu backend actual lo ignorará sin errores porque
        // UpdateConnectionDto solo valida campos conocidos.
        await connectionsApi.update(data.connectionId, {
          sourceInterface: form.sourceInterface,
          targetInterface: form.targetInterface,
          linkType: form.linkType,
          bandwidth: form.bandwidth,
          vlan: form.vlan,
          notes: form.notes,
        });
      }
      onSave({ ...data, ...form });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Error guardando conexión:", e);
    } finally {
      setSaving(false);
    }
  };

  const linkColor = LINK_COLORS[form.linkType] ?? "#94a3b8";

  const inp = (extra = {}) => ({
    width: "100%",
    padding: "7px 10px",
    fontSize: 12,
    border: "1px solid #e2e8f0",
    borderRadius: 7,
    outline: "none",
    boxSizing: "border-box",
    background: "#fafafa",
    ...extra,
  });

  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        height: "100vh",
        width: 340,
        background: "#fff",
        borderLeft: "1px solid #e2e8f0",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.1)",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #f1f5f9",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          background: "#fafafa",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#1e293b",
              margin: 0,
            }}
          >
            🔗 Detalles del enlace
          </h2>
          <p style={{ fontSize: 11, margin: "4px 0 0" }}>
            {form.sourceInterface || form.targetInterface ? (
              <span
                style={{
                  fontFamily: "monospace",
                  color: "#3b82f6",
                  fontWeight: 600,
                }}
              >
                {form.sourceInterface || "?"} → {form.targetInterface || "?"}
              </span>
            ) : (
              <span style={{ color: "#94a3b8" }}>Sin interfaz configurada</span>
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "#ef4444",
            border: "none",
            borderRadius: "50%",
            width: 30,
            height: 30,
            cursor: "pointer",
            fontSize: 15,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 900,
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(239,68,68,0.4)",
            transition: "transform 0.1s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.12)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          ✕
        </button>
      </div>

      {/* Resumen visual */}
      {(form.linkType || form.bandwidth || form.vlan) && (
        <div
          style={{
            margin: "12px 20px 0",
            padding: "10px 14px",
            background: linkColor + "11",
            border: `1px solid ${linkColor}33`,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 22 }}>
            {LINK_ICONS[form.linkType] ?? "🔗"}
          </span>
          <div style={{ flex: 1 }}>
            {form.linkType && (
              <div style={{ fontSize: 13, fontWeight: 700, color: linkColor }}>
                {form.linkType}
              </div>
            )}
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 2,
              }}
            >
              {form.bandwidth && (
                <span
                  style={{
                    fontSize: 11,
                    color: "#475569",
                    fontFamily: "monospace",
                  }}
                >
                  {form.bandwidth}
                </span>
              )}
              {form.vlan && (
                <span style={{ fontSize: 11, color: "#475569" }}>
                  VLAN: {form.vlan}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Formulario */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Interfaces */}
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 10,
            border: "1px solid #f1f5f9",
            padding: "12px 14px",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: "0 0 10px",
            }}
          >
            Interfaces físicas
          </p>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <div>
              <label
                style={{
                  fontSize: 11,
                  color: "#3b82f6",
                  fontWeight: 700,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                🔵 Origen
              </label>
              <input
                value={form.sourceInterface}
                onChange={(e) => set("sourceInterface", e.target.value)}
                placeholder="ether2, sfp1…"
                style={inp({
                  fontFamily: "monospace",
                  background: "#eff6ff",
                  borderColor: "#bfdbfe",
                })}
                onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.target.style.borderColor = "#bfdbfe")}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 11,
                  color: "#22c55e",
                  fontWeight: 700,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                🟢 Destino
              </label>
              <input
                value={form.targetInterface}
                onChange={(e) => set("targetInterface", e.target.value)}
                placeholder="ether3, sfp2…"
                style={inp({
                  fontFamily: "monospace",
                  background: "#f0fdf4",
                  borderColor: "#bbf7d0",
                })}
                onFocus={(e) => (e.target.style.borderColor = "#22c55e")}
                onBlur={(e) => (e.target.style.borderColor = "#bbf7d0")}
              />
            </div>
          </div>
          <p
            style={{
              fontSize: 10,
              color: "#94a3b8",
              margin: "6px 0 0",
              fontStyle: "italic",
            }}
          >
            Si conectaste desde un puerto del catálogo, el nombre se
            autocompleta.
          </p>
        </div>

        {/* Tipo de enlace */}
        <div>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#64748b",
              display: "block",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Tipo de enlace
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {LINK_TYPES.map((type) => {
              const active = form.linkType === type;
              const color = LINK_COLORS[type];
              return (
                <button
                  key={type}
                  onClick={() => set("linkType", active ? "" : type)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                    border: `1.5px solid ${active ? color : "#e2e8f0"}`,
                    background: active ? color + "18" : "#f8fafc",
                    color: active ? color : "#64748b",
                    transition: "all 0.12s",
                  }}
                >
                  {LINK_ICONS[type]} {type}
                </button>
              );
            })}
          </div>
        </div>

        {/* Velocidad */}
        <div>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#64748b",
              display: "block",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Velocidad / Ancho de banda
          </label>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 5,
              marginBottom: 8,
            }}
          >
            {BANDWIDTHS.map((bw) => {
              const active = form.bandwidth === bw;
              return (
                <button
                  key={bw}
                  onClick={() => set("bandwidth", active ? "" : bw)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: 11,
                    cursor: "pointer",
                    border: `1.5px solid ${active ? "#6366f1" : "#e2e8f0"}`,
                    background: active ? "#eef2ff" : "#f8fafc",
                    color: active ? "#4f46e5" : "#64748b",
                    fontWeight: active ? 700 : 400,
                    transition: "all 0.1s",
                  }}
                >
                  {bw}
                </button>
              );
            })}
          </div>
          <input
            value={form.bandwidth}
            onChange={(e) => set("bandwidth", e.target.value)}
            placeholder="O escribe un valor personalizado…"
            style={inp()}
            onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
            onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
          />
        </div>

        {/* VLAN */}
        <div>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#64748b",
              display: "block",
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            VLAN / Segmento
          </label>
          <input
            value={form.vlan}
            onChange={(e) => set("vlan", e.target.value)}
            placeholder="Ej: 100, MGMT, WAN…"
            style={inp({ fontFamily: "monospace" })}
            onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
            onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
          />
        </div>

        {/* Notas */}
        <div>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#64748b",
              display: "block",
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Notas técnicas
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Observaciones del enlace…"
            rows={3}
            style={{ ...inp(), resize: "vertical", fontFamily: "inherit" }}
            onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
            onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
          />
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "14px 20px",
          borderTop: "1px solid #f1f5f9",
          display: "flex",
          gap: 8,
          background: "#fafafa",
        }}
      >
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1,
            padding: "10px 0",
            background: saved ? "#22c55e" : saving ? "#93c5fd" : "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: 9,
            cursor: saving ? "not-allowed" : "pointer",
            fontWeight: 700,
            fontSize: 13,
            transition: "background 0.2s",
          }}
        >
          {saved ? "✓ Guardado" : saving ? "Guardando…" : "💾 Guardar cambios"}
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: "10px 0",
            background: "#f1f5f9",
            color: "#64748b",
            border: "none",
            borderRadius: 9,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Cerrar
        </button>
      </div>
    </div>,
    document.body,
  );
};

// ── EditableEdge ──────────────────────────────────────────────────────────────

const EditableEdge = ({
  id,
  source,
  target,
  sourceHandleId,
  targetHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data = {},
  selected,
  markerEnd,
  style = {},
}) => {
  const { setEdges, getNode } = useReactFlow();
  const [panelOpen, setPanelOpen] = useState(false);

  // ── Resolver puertos de origen y destino desde el catálogo ────────────────
  // Cuando el handle es un puerto (ether3, sfp+1, qsfp28-1…) podemos mostrar
  // su nombre y usar su tipo para pintar el cable con el color correcto.
  const sourceNode = getNode(source);
  const targetNode = getNode(target);
  const sourcePort = resolvePort(sourceNode, sourceHandleId);
  const targetPort = resolvePort(targetNode, targetHandleId);

  // ─── ROUTING ORTOGONAL (Manhattan) ─────────────────────────────────────────
  // El cable SIEMPRE va en ángulos rectos. En lugar de guardar puntos libres
  // en el canvas (que obligarían a calcular curvas), guardamos "offsets" de
  // los segmentos intermedios:
  //
  //   data.waypoints: [{ axis: 'x'|'y', value: number }, ...]
  //
  // Donde `axis:'y', value:300` significa "hay un segmento horizontal a
  // altura Y=300". Esto garantiza que al arrastrar, el cable sigue siendo
  // ortogonal pase lo que pase.
  //
  // Cuando no hay waypoints guardados, calculamos una ruta por defecto
  // que sube desde el source, va horizontal hasta la columna del target,
  // y baja al target (patrón "U invertida" que se ve como la referencia).
  //
  // Tolerancia para tratar un handle como "arriba" u "otros"
  const DIR_UP = "up",
    DIR_DOWN = "down",
    DIR_LEFT = "left",
    DIR_RIGHT = "right";

  const dirOf = (pos) => {
    // sourcePosition / targetPosition son strings: "top"|"bottom"|"left"|"right"
    if (pos === "top") return DIR_UP;
    if (pos === "bottom") return DIR_DOWN;
    if (pos === "left") return DIR_LEFT;
    if (pos === "right") return DIR_RIGHT;
    return DIR_UP; // default sensato para nuestro layout (puertos arriba)
  };
  const srcDir = dirOf(sourcePosition);
  const tgtDir = dirOf(targetPosition);

  // "Stub" — distancia mínima que el cable sale perpendicular del nodo antes
  // de girar. Esto es lo que hace que el cable "nazca" limpio del puerto.
  const STUB = 24;

  // Raw waypoints guardados (sistema ortogonal). Cada uno es un segmento
  // intermedio con su eje y valor. Si está vacío → usamos una ruta por defecto.
  const rawWaypoints = Array.isArray(data?.waypoints) ? data.waypoints : [];

  // Los waypoints del sistema viejo (con {x, y} libre) los ignoramos para
  // recalcular la ruta desde cero — así no se rompe visualmente si existían.
  const waypointsOrtho = rawWaypoints.filter(
    (w) => w && typeof w === "object" && (w.axis === "x" || w.axis === "y"),
  );

  // Ruta por defecto: desde source, salir STUB en srcDir, bajar/subir hasta
  // el punto medio, girar hacia el nodo target, y entrar por tgtDir con STUB.
  // Esto genera 4 segmentos (3 esquinas) en el caso general.
  const buildDefaultOrthoPath = (sx, sy, sd, tx, ty, td) => {
    // Paso 1: punto donde termina el stub de origen
    const aX = sd === DIR_LEFT ? sx - STUB : sd === DIR_RIGHT ? sx + STUB : sx;
    const aY = sd === DIR_UP ? sy - STUB : sd === DIR_DOWN ? sy + STUB : sy;
    // Paso final: punto donde empieza el stub de destino
    const bX = td === DIR_LEFT ? tx - STUB : td === DIR_RIGHT ? tx + STUB : tx;
    const bY = td === DIR_UP ? ty - STUB : td === DIR_DOWN ? ty + STUB : ty;

    // Entre a y b, necesitamos segmentos ortogonales. Estrategia:
    // - Si los stubs son verticales (ambos source y target up/down), el "punto
    //   medio" es una altura intermedia entre aY y bY, y hacemos:
    //     a → (aX, midY) → (bX, midY) → b
    // - Si son horizontales, análogo con midX.
    // - Si están mezclados (uno up/down, otro left/right), usamos una L:
    //     a → (bX, aY) → b   (vertical primero del lado largo)
    const srcVertical = sd === DIR_UP || sd === DIR_DOWN;
    const tgtVertical = td === DIR_UP || td === DIR_DOWN;

    const points = [{ x: sx, y: sy }];
    points.push({ x: aX, y: aY }); // fin del stub origen

    if (srcVertical && tgtVertical) {
      // Ruta "U" o "Z" — pasa por una altura intermedia
      const midY = (aY + bY) / 2;
      points.push({ x: aX, y: midY });
      points.push({ x: bX, y: midY });
    } else if (!srcVertical && !tgtVertical) {
      // Ambos horizontales — pasa por una columna intermedia
      const midX = (aX + bX) / 2;
      points.push({ x: midX, y: aY });
      points.push({ x: midX, y: bY });
    } else if (srcVertical && !tgtVertical) {
      // Source arriba/abajo, target izquierda/derecha → L
      points.push({ x: bX, y: aY });
    } else {
      // Source izquierda/derecha, target arriba/abajo → L
      points.push({ x: aX, y: bY });
    }

    points.push({ x: bX, y: bY }); // inicio del stub destino
    points.push({ x: tx, y: ty });
    return points;
  };

  // Si hay waypoints guardados, los usamos para DERIVAR los puntos del path.
  // Cada waypoint con {axis:'y', value:Y} introduce un segmento horizontal
  // a altura Y. El algoritmo va alternando ejes.
  const buildCustomOrthoPath = (sx, sy, sd, tx, ty, td, wps) => {
    const pts = [{ x: sx, y: sy }];
    let cursorX = sx,
      cursorY = sy;

    // Primer stub desde el source
    if (sd === DIR_UP || sd === DIR_DOWN) {
      cursorY = sd === DIR_UP ? sy - STUB : sy + STUB;
    } else {
      cursorX = sd === DIR_LEFT ? sx - STUB : sx + STUB;
    }
    pts.push({ x: cursorX, y: cursorY });

    // Aplicamos cada waypoint — si es axis=y, movemos Y hasta value y luego
    // un giro horizontal hacia la dirección del siguiente punto; análogo x.
    wps.forEach((wp) => {
      if (wp.axis === "y") {
        // Giro que nos deja a altura wp.value
        cursorY = wp.value;
        pts.push({ x: cursorX, y: cursorY });
      } else if (wp.axis === "x") {
        cursorX = wp.value;
        pts.push({ x: cursorX, y: cursorY });
      }
    });

    // Último stub antes del target
    const tStubX =
      td === DIR_LEFT ? tx - STUB : td === DIR_RIGHT ? tx + STUB : tx;
    const tStubY = td === DIR_UP ? ty - STUB : td === DIR_DOWN ? ty + STUB : ty;

    // Ajuste: desde cursor hasta (tStubX, tStubY) puede requerir 1 o 2 giros
    // más para mantener ortogonalidad. Los añadimos según el eje dominante.
    if (cursorX !== tStubX && cursorY !== tStubY) {
      // Dos ejes distintos → necesitamos un segmento intermedio.
      // Elegimos según la dirección del target para que el último tramo
      // termine alineado con el stub del destino.
      if (td === DIR_UP || td === DIR_DOWN) {
        // El stub final es vertical → el penúltimo debe ser horizontal
        pts.push({ x: tStubX, y: cursorY });
      } else {
        // El stub final es horizontal → el penúltimo debe ser vertical
        pts.push({ x: cursorX, y: tStubY });
      }
    }
    pts.push({ x: tStubX, y: tStubY });
    pts.push({ x: tx, y: ty });
    return pts;
  };

  // Calcular los puntos del path (con o sin waypoints)
  const pathPoints =
    waypointsOrtho.length > 0
      ? buildCustomOrthoPath(
          sourceX,
          sourceY,
          srcDir,
          targetX,
          targetY,
          tgtDir,
          waypointsOrtho,
        )
      : buildDefaultOrthoPath(
          sourceX,
          sourceY,
          srcDir,
          targetX,
          targetY,
          tgtDir,
        );

  // Construir el atributo `d` del SVG con esquinas sutilmente redondeadas.
  // Usamos pequeños arcos en cada esquina para suavizar los cambios de 90°.
  const CORNER_RADIUS = 6;
  const buildSvgPath = (pts) => {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const next = pts[i + 1];
      // Distancia hasta la esquina por cada lado
      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;
      const len1 = Math.hypot(dx1, dy1);
      const len2 = Math.hypot(dx2, dy2);
      const r = Math.min(CORNER_RADIUS, len1 / 2, len2 / 2);
      if (r < 1) {
        // Segmento muy corto — sin curva, línea recta
        d += ` L ${curr.x},${curr.y}`;
        continue;
      }
      // Punto donde empieza la curva (acercándose a curr desde prev)
      const startX = curr.x - (dx1 / len1) * r;
      const startY = curr.y - (dy1 / len1) * r;
      // Punto donde termina la curva (alejándose de curr hacia next)
      const endX = curr.x + (dx2 / len2) * r;
      const endY = curr.y + (dy2 / len2) * r;
      d += ` L ${startX},${startY}`;
      d += ` Q ${curr.x},${curr.y} ${endX},${endY}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${last.x},${last.y}`;
    return d;
  };

  const edgePath = buildSvgPath(pathPoints);

  // Etiqueta central: en el punto medio del path (segmento más largo)
  let labelX, labelY;
  {
    let longestLen = 0;
    let midX = (sourceX + targetX) / 2;
    let midY = (sourceY + targetY) / 2;
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const a = pathPoints[i];
      const b = pathPoints[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len > longestLen) {
        longestLen = len;
        midX = (a.x + b.x) / 2;
        midY = (a.y + b.y) / 2;
      }
    }
    labelX = midX;
    labelY = midY;
  }

  // ── Esquinas arrastrables ─────────────────────────────────────────────────
  // Son los puntos INTERMEDIOS "reales" del path. Excluimos:
  //   - pathPoints[0]       → el puerto de origen (no se mueve)
  //   - pathPoints[1]       → el fin del stub de origen (pegado al puerto)
  //   - pathPoints[len-2]   → el inicio del stub de destino (pegado al puerto)
  //   - pathPoints[len-1]   → el puerto de destino (no se mueve)
  // Los stubs tienen que quedar FIJOS para que el cable siempre "nazca" recto
  // del puerto en perpendicular al card. Si el usuario pudiese arrastrarlos,
  // rompería la alineación visual.
  const cornerPoints = pathPoints.length >= 4 ? pathPoints.slice(2, -2) : [];

  // ── Handlers para agregar / mover / eliminar waypoints ────────────────────
  const [draggingIdx, setDraggingIdx] = useState(null);
  const { screenToFlowPosition } = useReactFlow();

  // Reemplazar los waypoints del edge en el estado (utility)
  const updateWaypoints = useCallback(
    (newWps) => {
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === id
            ? { ...edge, data: { ...edge.data, waypoints: newWps } }
            : edge,
        ),
      );
    },
    [id, setEdges],
  );

  // Al arrastrar una esquina, detectamos qué eje(s) la definen y actualizamos
  // los waypoints para reflejar el cambio. La esquina en cornerPoints[idx]
  // corresponde al waypoint en waypointsOrtho (con índice calculado abajo).
  //
  // Regla: las esquinas generadas por la ruta POR DEFECTO se "materializan"
  // como waypoints reales al primer arrastre — así el usuario las puede mover.
  const startDragCorner = useCallback(
    (cornerIdx, e) => {
      e.stopPropagation();
      e.preventDefault();
      setDraggingIdx(cornerIdx);

      // Posicion actual de la esquina
      const currentCorner = cornerPoints[cornerIdx];
      // Los vecinos son los stubs cuando la esquina es la primera/última, o
      // la esquina adyacente en cornerPoints en caso contrario.
      const prevCorner =
        cornerIdx > 0 ? cornerPoints[cornerIdx - 1] : pathPoints[1];
      const nextCorner =
        cornerIdx < cornerPoints.length - 1
          ? cornerPoints[cornerIdx + 1]
          : pathPoints[pathPoints.length - 2];

      // Determinar ejes arrastrables según segmentos vecinos
      const incomingHoriz = Math.abs(currentCorner.y - prevCorner.y) < 0.5;
      const outgoingHoriz = Math.abs(currentCorner.y - nextCorner.y) < 0.5;

      // Si la esquina tiene un segmento horizontal entrando y uno vertical
      // saliendo (o viceversa), es un giro en L: solo se puede mover la
      // intersección, lo que mueve AMBOS segmentos.
      const initialFlow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const startCornerPos = { x: currentCorner.x, y: currentCorner.y };

      const onMove = (mv) => {
        const currentFlow = screenToFlowPosition({
          x: mv.clientX,
          y: mv.clientY,
        });
        const dx = currentFlow.x - initialFlow.x;
        const dy = currentFlow.y - initialFlow.y;

        // Nueva posición deseada de la esquina
        const newX = startCornerPos.x + dx;
        const newY = startCornerPos.y + dy;

        // Construimos waypoints ortogonales a partir de TODOS los cornerPoints
        // actualizando solo el que se está arrastrando. Cada tramo entre dos
        // esquinas adyacentes nos dice el eje del segmento compartido.
        const newCorners = cornerPoints.map((c, i) =>
          i === cornerIdx ? { x: newX, y: newY } : c,
        );

        // Reconstruir el path completo: source + stub_origen + corners + stub_destino + target
        // pathPoints[0] = source, pathPoints[1] = fin stub origen
        // pathPoints[len-2] = inicio stub destino, pathPoints[len-1] = target
        const stubOrigen = pathPoints[1];
        const stubDestino = pathPoints[pathPoints.length - 2];
        const fullPts = [
          pathPoints[0],
          stubOrigen,
          ...newCorners,
          stubDestino,
          pathPoints[pathPoints.length - 1],
        ];

        // Generar waypoints SOLO de los segmentos intermedios reales
        // (entre stub_origen y stub_destino). Los stubs mismos no se guardan.
        const newWps = [];
        for (let i = 1; i < fullPts.length - 2; i++) {
          const a = fullPts[i];
          const b = fullPts[i + 1];
          const isHoriz = Math.abs(a.y - b.y) < 0.5;
          if (isHoriz) newWps.push({ axis: "y", value: a.y });
          else newWps.push({ axis: "x", value: a.x });
        }

        updateWaypoints(newWps);
      };
      const onUp = () => {
        setDraggingIdx(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [cornerPoints, pathPoints, screenToFlowPosition, updateWaypoints],
  );

  // Doble-clic en una esquina → eliminarla (el cable se recalcula sin ella,
  // volviendo a una ruta más simple).
  const removeCorner = useCallback(
    (cornerIdx) => {
      const newCorners = cornerPoints.filter((_, i) => i !== cornerIdx);
      // Reconstruir fullPts incluyendo los stubs fijos
      const stubOrigen = pathPoints[1];
      const stubDestino = pathPoints[pathPoints.length - 2];
      const fullPts = [
        pathPoints[0],
        stubOrigen,
        ...newCorners,
        stubDestino,
        pathPoints[pathPoints.length - 1],
      ];
      const newWps = [];
      for (let i = 1; i < fullPts.length - 2; i++) {
        const a = fullPts[i];
        const b = fullPts[i + 1];
        const isHoriz = Math.abs(a.y - b.y) < 0.5;
        if (isHoriz) newWps.push({ axis: "y", value: a.y });
        else newWps.push({ axis: "x", value: a.x });
      }
      updateWaypoints(newWps);
    },
    [cornerPoints, pathPoints, updateWaypoints],
  );

  // Click en el medio de un segmento del cable → agregar una nueva esquina
  // ahí. Esto permite "doblar" el cable donde quieras. Solo es necesario si
  // el usuario quiere una ruta más retorcida que la por defecto.
  const addCornerAt = useCallback(
    (flowX, flowY) => {
      // Encontrar el segmento más cercano al click dentro de los segmentos
      // INTERMEDIOS (no los stubs, que son fijos).
      // pathPoints = [source, stubOrigen, ...corners, stubDestino, target]
      // Los segmentos "editables" son: stubOrigen→corner1, corner1→corner2,
      // ..., cornerN→stubDestino. Sus índices en pathPoints van de 1 a len-3.
      let bestI = 1;
      let bestDist = Infinity;
      for (let i = 1; i < pathPoints.length - 2; i++) {
        const a = pathPoints[i];
        const b = pathPoints[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.max(
          0,
          Math.min(1, ((flowX - a.x) * dx + (flowY - a.y) * dy) / len2),
        );
        const px = a.x + t * dx;
        const py = a.y + t * dy;
        const d2 = (flowX - px) ** 2 + (flowY - py) ** 2;
        if (d2 < bestDist) {
          bestDist = d2;
          bestI = i;
        }
      }
      // Insertar una nueva esquina en la posición del click, proyectada para
      // mantener ortogonalidad con el segmento vecino.
      const a = pathPoints[bestI];
      const b = pathPoints[bestI + 1];
      const isHoriz = Math.abs(a.y - b.y) < 0.5;
      const newCorner = isHoriz ? { x: flowX, y: a.y } : { x: a.x, y: flowY };

      // Convertir bestI (índice en pathPoints) a índice en cornerPoints.
      // pathPoints[1] = stubOrigen → insertar en cornerPoints[0] (bestI=1)
      // pathPoints[2] = cornerPoints[0] → insertar en cornerPoints[1] (bestI=2)
      // Regla general: insertIdx = bestI - 1 (restar los puntos anteriores: source + stubOrigen - 1)
      // Pero hay que acotar: si bestI apunta al último segmento (hacia stubDestino),
      // insertIdx = cornerPoints.length (append).
      const insertIdx = Math.max(0, Math.min(cornerPoints.length, bestI - 1));
      const newCorners = [...cornerPoints];
      newCorners.splice(insertIdx, 0, newCorner);

      // Reconstruir fullPts con stubs fijos + nuevas esquinas
      const stubOrigen = pathPoints[1];
      const stubDestino = pathPoints[pathPoints.length - 2];
      const fullPts = [
        pathPoints[0],
        stubOrigen,
        ...newCorners,
        stubDestino,
        pathPoints[pathPoints.length - 1],
      ];
      const newWps = [];
      for (let i = 1; i < fullPts.length - 2; i++) {
        const segA = fullPts[i];
        const segB = fullPts[i + 1];
        const h = Math.abs(segA.y - segB.y) < 0.5;
        if (h) newWps.push({ axis: "y", value: segA.y });
        else newWps.push({ axis: "x", value: segA.x });
      }
      updateWaypoints(newWps);
    },
    [cornerPoints, pathPoints, updateWaypoints],
  );

  // Click izquierdo sobre el cable (no sobre una esquina) → agregar nueva
  // esquina ahí y abrir el panel solo si ya estaba seleccionado.
  const onPathClick = useCallback(
    (e) => {
      if (!selected) {
        // Primer clic: solo seleccionar (abrir panel). El flujo estándar.
        setPanelOpen(true);
        return;
      }
      // Segundo clic (con edge ya seleccionado): agregar esquina en ese punto
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addCornerAt(pos.x, pos.y);
    },
    [selected, screenToFlowPosition, addCornerAt],
  );

  const handlePanelSave = useCallback(
    (updatedData) => {
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === id
            ? { ...edge, data: { ...edge.data, ...updatedData } }
            : edge,
        ),
      );
    },
    [id, setEdges],
  );

  // ── Colores, grosores y animación ─────────────────────────────────────────
  //
  // Prioridad de linkType para determinar el COLOR del cable:
  //   1. data.linkType explícito (configurado por el usuario)
  //   2. tipo inferido del puerto de origen (si es puerto del catálogo)
  //   3. style.stroke (fallback legacy)
  //
  const inferredLinkType = sourcePort
    ? PORT_TYPE_TO_LINK_TYPE[sourcePort.type]
    : null;
  const linkType = data.linkType || inferredLinkType || null;
  const linkColor = linkType
    ? (LINK_COLORS[linkType] ?? "#94a3b8")
    : (style?.stroke ?? "#3b82f6");
  const strokeColor = selected ? "#f97316" : linkColor;

  // Grosor: si el usuario configuró linkType usa LINK_THICKNESS;
  // si solo viene inferido del puerto usa el grosor del tipo inferido;
  // si no, fallback a 2.
  const baseThickness = LINK_THICKNESS[linkType] ?? style?.strokeWidth ?? 2;
  const strokeWidth = selected ? baseThickness + 0.8 : baseThickness;

  // Bandwidth inferido si no está definido
  const inferredBandwidth = sourcePort
    ? PORT_TYPE_TO_BANDWIDTH[sourcePort.type]
    : null;
  const effectiveBandwidth = data.bandwidth || inferredBandwidth;
  const animDuration = ANIM_SPEED[effectiveBandwidth] ?? "1.2s";

  const isWireless = linkType === "Wireless";
  const flowClass = isWireless ? "edge-flow-wireless" : "edge-flow-line";

  // ── Etiqueta del edge: interfaces origen → destino ─────────────────────────
  // Prioridad: configurada manualmente > nombre del puerto del catálogo
  const si = data.sourceInterface || sourcePort?.name;
  const ti = data.targetInterface || targetPort?.name;
  const shortLabel = si && ti ? `${si} → ${ti}` : si || ti || null;

  return (
    <>
      {panelOpen && (
        <ConnectionPanel
          key={id}
          edgeId={id}
          edgeData={{
            ...data,
            // Pasar los valores inferidos como default si el usuario no ha
            // configurado nada — así el panel se abre "pre-llenado".
            sourceInterface: data.sourceInterface || sourcePort?.name || "",
            targetInterface: data.targetInterface || targetPort?.name || "",
            linkType: data.linkType || inferredLinkType || "",
            bandwidth: data.bandwidth || inferredBandwidth || "",
          }}
          onClose={() => setPanelOpen(false)}
          onSave={handlePanelSave}
        />
      )}

      {/* Área invisible para clic. Primer click selecciona + abre panel;
          segundo click (con edge ya seleccionado) agrega una esquina de
          quiebre en ese punto, para poder darle forma al cable. */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
        style={{ cursor: selected ? "copy" : "pointer" }}
        onClick={onPathClick}
      />

      {/* ── Línea base (fija, semitransparente) ── */}
      <path
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={0.35}
        style={{ pointerEvents: "none" }}
      />

      {/* ── Línea animada de flujo (origen → destino) ── */}
      <path
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth + 0.5}
        strokeLinecap="round"
        className={flowClass}
        style={{
          animationDuration: animDuration,
          pointerEvents: "none",
          filter: selected ? `drop-shadow(0 0 3px ${strokeColor})` : "none",
        }}
      />

      {/* Marcador de flecha al final */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: "transparent",
          strokeWidth: 0,
          pointerEvents: "none",
        }}
      />

      {/* ── Handles visuales de RECONEXIÓN en ambos extremos ──
          Visibles solo cuando el edge está seleccionado. El usuario arrastra
          estos círculos sobre otro puerto para mover la conexión ahí mismo.
          El drag real lo maneja React Flow automáticamente porque marcamos
          el edge como `updatable` (se configura en defaultEdgeOptions o en el
          edge data). El círculo aquí es la pista visual. */}
      {selected && (
        <>
          {/* Extremo de ORIGEN (arrastra este para cambiar el puerto origen) */}
          <circle
            cx={sourceX}
            cy={sourceY}
            r={6}
            fill="#fff"
            stroke={strokeColor}
            strokeWidth={2}
            style={{
              cursor: "grab",
              filter: `drop-shadow(0 0 4px ${strokeColor}88)`,
              pointerEvents: "none", // React Flow agrega su propio dragger encima
            }}
          />
          {/* Extremo de DESTINO (arrastra este para cambiar el puerto destino) */}
          <circle
            cx={targetX}
            cy={targetY}
            r={6}
            fill={strokeColor}
            stroke="#fff"
            strokeWidth={2}
            style={{
              cursor: "grab",
              filter: `drop-shadow(0 0 4px ${strokeColor}88)`,
              pointerEvents: "none",
            }}
          />
        </>
      )}

      <EdgeLabelRenderer>
        {/* Etiqueta de interfaces — centrada en el path real */}
        {shortLabel && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY - 16}px)`,
              pointerEvents: "none",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: strokeColor,
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                fontFamily: "monospace",
                padding: "2px 9px",
                borderRadius: 20,
                whiteSpace: "nowrap",
                boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
              }}
            >
              {shortLabel}
            </div>
          </div>
        )}

        {/* Badge tipo de enlace (cuando no hay interfaces) */}
        {linkType && !shortLabel && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY - 16}px)`,
              pointerEvents: "none",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: linkColor + "22",
                color: linkColor,
                border: `1px solid ${linkColor}55`,
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 9px",
                borderRadius: 20,
                whiteSpace: "nowrap",
              }}
            >
              {LINK_ICONS[linkType]} {linkType}
            </div>
          </div>
        )}

        {/* Botón "Ver detalles" — solo cuando seleccionado.
            Ya no hay toggle Bezier/Ortogonal: el sistema es 100% ortogonal. */}
        {(selected || panelOpen) && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY + 22}px)`,
              pointerEvents: "all",
              zIndex: 1001,
              display: "flex",
              gap: 4,
            }}
            className="nodrag nopan"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPanelOpen((v) => !v);
              }}
              style={{
                background: panelOpen ? "#1d4ed8" : "#fff",
                color: panelOpen ? "#fff" : "#3b82f6",
                border: `1.5px solid ${panelOpen ? "#1d4ed8" : "#3b82f6"}`,
                borderRadius: 20,
                padding: "4px 12px",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
                transition: "all 0.12s",
              }}
            >
              {panelOpen ? "✓ Abierto" : "📋 Ver detalles"}
            </button>
            {/* Botón resetear ruta — solo si hay waypoints guardados */}
            {waypointsOrtho.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateWaypoints([]);
                }}
                title="Volver al trazado automático"
                style={{
                  background: "#fff",
                  color: "#94a3b8",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 20,
                  padding: "4px 10px",
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                }}
              >
                ↺ Auto
              </button>
            )}
          </div>
        )}

        {/* ── Badge ORIGEN — flotando MÁS ARRIBA del puerto con leader line ──
            Se aleja del card para no chocar con el PortPanel. Una línea fina
            desde el puerto hasta el badge hace la conexión visual. */}
        {(sourcePort || data.sourceInterface) &&
          (() => {
            const BADGE_OFFSET = 38; // px de distancia desde el puerto
            // Dirección de salida del cable desde el source (para saber en qué
            // lado poner el badge). Si el puerto está arriba (top), el badge
            // va sobre el card → offset negativo en Y.
            const dy =
              srcDir === DIR_UP
                ? -BADGE_OFFSET
                : srcDir === DIR_DOWN
                  ? BADGE_OFFSET
                  : 0;
            const dx =
              srcDir === DIR_LEFT
                ? -BADGE_OFFSET
                : srcDir === DIR_RIGHT
                  ? BADGE_OFFSET
                  : 0;
            const bx = sourceX + dx;
            const by = sourceY + dy;
            return (
              <>
                {/* Leader line — línea fina que conecta puerto ↔ badge */}
                <svg
                  style={{
                    position: "absolute",
                    left: Math.min(sourceX, bx) - 2,
                    top: Math.min(sourceY, by) - 2,
                    width: Math.abs(bx - sourceX) + 4,
                    height: Math.abs(by - sourceY) + 4,
                    pointerEvents: "none",
                    overflow: "visible",
                    zIndex: 1001,
                  }}
                >
                  <line
                    x1={sourceX - (Math.min(sourceX, bx) - 2)}
                    y1={sourceY - (Math.min(sourceY, by) - 2)}
                    x2={bx - (Math.min(sourceX, bx) - 2)}
                    y2={by - (Math.min(sourceY, by) - 2)}
                    stroke={strokeColor}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    opacity={0.55}
                  />
                </svg>
                <div
                  style={{
                    position: "absolute",
                    transform: `translate(-50%,-50%) translate(${bx}px,${by}px)`,
                    pointerEvents: "none",
                    zIndex: 1002,
                  }}
                >
                  <div
                    style={{
                      background: "#fff",
                      color: strokeColor,
                      border: `1.5px solid ${strokeColor}`,
                      fontSize: 9.5,
                      fontWeight: 700,
                      fontFamily: "ui-monospace, monospace",
                      padding: "3px 9px",
                      borderRadius: 10,
                      whiteSpace: "nowrap",
                      boxShadow: `0 3px 10px ${strokeColor}44, 0 1px 3px rgba(0,0,0,0.15)`,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <span style={{ fontWeight: 800 }}>
                      {data.sourceInterface || sourcePort?.name}
                    </span>
                    {sourcePort && (
                      <>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span style={{ fontSize: 8.5, opacity: 0.75 }}>
                          {sourcePort.type}
                        </span>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span style={{ fontSize: 8.5, fontWeight: 800 }}>
                          {PORT_TYPE_LABELS[sourcePort.type] ??
                            sourcePort.speed}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </>
            );
          })()}

        {/* ── Badge DESTINO — misma lógica pero del lado target ── */}
        {(targetPort || data.targetInterface) &&
          (() => {
            const BADGE_OFFSET = 38;
            const dy =
              tgtDir === DIR_UP
                ? -BADGE_OFFSET
                : tgtDir === DIR_DOWN
                  ? BADGE_OFFSET
                  : 0;
            const dx =
              tgtDir === DIR_LEFT
                ? -BADGE_OFFSET
                : tgtDir === DIR_RIGHT
                  ? BADGE_OFFSET
                  : 0;
            const bx = targetX + dx;
            const by = targetY + dy;
            return (
              <>
                <svg
                  style={{
                    position: "absolute",
                    left: Math.min(targetX, bx) - 2,
                    top: Math.min(targetY, by) - 2,
                    width: Math.abs(bx - targetX) + 4,
                    height: Math.abs(by - targetY) + 4,
                    pointerEvents: "none",
                    overflow: "visible",
                    zIndex: 1001,
                  }}
                >
                  <line
                    x1={targetX - (Math.min(targetX, bx) - 2)}
                    y1={targetY - (Math.min(targetY, by) - 2)}
                    x2={bx - (Math.min(targetX, bx) - 2)}
                    y2={by - (Math.min(targetY, by) - 2)}
                    stroke={strokeColor}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    opacity={0.75}
                  />
                </svg>
                <div
                  style={{
                    position: "absolute",
                    transform: `translate(-50%,-50%) translate(${bx}px,${by}px)`,
                    pointerEvents: "none",
                    zIndex: 1002,
                  }}
                >
                  <div
                    style={{
                      background: strokeColor,
                      color: "#fff",
                      border: `1.5px solid ${strokeColor}`,
                      fontSize: 9.5,
                      fontWeight: 700,
                      fontFamily: "ui-monospace, monospace",
                      padding: "3px 9px",
                      borderRadius: 10,
                      whiteSpace: "nowrap",
                      boxShadow: `0 3px 10px ${strokeColor}66, 0 1px 3px rgba(0,0,0,0.2)`,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <span style={{ fontWeight: 800 }}>
                      {data.targetInterface || targetPort?.name}
                    </span>
                    {targetPort && (
                      <>
                        <span style={{ opacity: 0.6 }}>·</span>
                        <span style={{ fontSize: 8.5, opacity: 0.85 }}>
                          {targetPort.type}
                        </span>
                        <span style={{ opacity: 0.6 }}>·</span>
                        <span style={{ fontSize: 8.5, fontWeight: 800 }}>
                          {PORT_TYPE_LABELS[targetPort.type] ??
                            targetPort.speed}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </>
            );
          })()}

        {/* ── Esquinas arrastrables del cable ─────────────────────────
            Cada esquina del path ortogonal se renderiza como un círculo
            arrastrable cuando el edge está seleccionado. Arrastrarla mueve
            el segmento; doble-clic la elimina (el cable vuelve a una ruta
            más simple). Las esquinas de los stubs (primera y última) no se
            muestran porque están muy cerca del puerto. */}
        {selected &&
          cornerPoints.map((corner, idx) => {
            const isThisDragging = draggingIdx === idx;
            // Determinar dirección del arrastre según los segmentos vecinos.
            // Los vecinos son: el stub de origen (si es la primera esquina),
            // el stub de destino (si es la última), o la esquina adyacente.
            const prev = idx === 0 ? pathPoints[1] : cornerPoints[idx - 1];
            const next =
              idx === cornerPoints.length - 1
                ? pathPoints[pathPoints.length - 2]
                : cornerPoints[idx + 1];
            const incomingHoriz = Math.abs(corner.y - prev.y) < 0.5;
            const outgoingHoriz = Math.abs(corner.y - next.y) < 0.5;
            // Tip contextual
            let hint = "Arrastra para mover";
            if (incomingHoriz && outgoingHoriz) hint = "⇕ Mover altura";
            else if (!incomingHoriz && !outgoingHoriz) hint = "⇔ Mover columna";
            else hint = "⇲ Mover esquina";
            return (
              <div
                key={`corner-${idx}`}
                style={{
                  position: "absolute",
                  transform: `translate(-50%,-50%) translate(${corner.x}px,${corner.y}px)`,
                  pointerEvents: "all",
                  zIndex: 1003,
                }}
                className="nodrag nopan"
              >
                <div
                  onMouseDown={(e) => startDragCorner(idx, e)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    removeCorner(idx);
                  }}
                  title={`${hint} · Doble clic para eliminar`}
                  style={{
                    width: isThisDragging ? 16 : 11,
                    height: isThisDragging ? 16 : 11,
                    borderRadius: 3,
                    background: isThisDragging ? "#f97316" : "#fff",
                    border: `2px solid ${strokeColor}`,
                    cursor: isThisDragging
                      ? "grabbing"
                      : incomingHoriz && outgoingHoriz
                        ? "ns-resize"
                        : !incomingHoriz && !outgoingHoriz
                          ? "ew-resize"
                          : "move",
                    transition: "all 0.1s",
                    boxShadow: isThisDragging
                      ? `0 0 0 3px ${strokeColor}33, 0 2px 10px rgba(0,0,0,0.25)`
                      : "0 2px 6px rgba(0,0,0,0.2)",
                  }}
                />
              </div>
            );
          })}

        {/* Hint de uso cuando el cable está recién seleccionado */}
        {selected && waypointsOrtho.length === 0 && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY + 48}px)`,
              pointerEvents: "none",
              zIndex: 998,
            }}
          >
            <div
              style={{
                background: "#1e293b",
                color: "#cbd5e1",
                fontSize: 9,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 6,
                whiteSpace: "nowrap",
                opacity: 0.85,
              }}
            >
              🖱️ Arrastra las esquinas · clic en el cable para agregar
            </div>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
};

export default EditableEdge;
