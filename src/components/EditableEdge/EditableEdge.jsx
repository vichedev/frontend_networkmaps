import React, { useState, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
} from "reactflow";
import { connectionsApi } from "../../services/api";

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

const BANDWIDTHS = [
  "100 Mbps",
  "1 Gbps",
  "2.5 Gbps",
  "10 Gbps",
  "25 Gbps",
  "40 Gbps",
  "100 Gbps",
];

// Velocidad de animación según ancho de banda
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
// Se inyectan una sola vez en <head>
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
  `;
  document.head.appendChild(style);
};
injectAnimStyles();

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
        await connectionsApi.update(data.connectionId, form);
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
  const { setEdges } = useReactFlow();
  const [isDragging, setIsDragging] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const waypoint = data?.waypoints?.[0] ?? null;
  let edgePath, labelX, labelY;
  if (waypoint) {
    edgePath = `M ${sourceX},${sourceY} Q ${waypoint.x},${waypoint.y} ${targetX},${targetY}`;
    labelX = waypoint.x;
    labelY = waypoint.y;
  } else {
    [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
  }
  const controlX = waypoint ? waypoint.x : labelX;
  const controlY = waypoint ? waypoint.y : labelY;

  const onControlMouseDown = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);
      const sx = e.clientX,
        sy = e.clientY,
        swx = controlX,
        swy = controlY;
      const onMove = (mv) =>
        setEdges((eds) =>
          eds.map((edge) =>
            edge.id !== id
              ? edge
              : {
                  ...edge,
                  data: {
                    ...edge.data,
                    waypoints: [
                      { x: swx + mv.clientX - sx, y: swy + mv.clientY - sy },
                    ],
                  },
                },
          ),
        );
      const onUp = () => {
        setIsDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [id, controlX, controlY, setEdges],
  );

  const onControlDoubleClick = useCallback(
    (e) => {
      e.stopPropagation();
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === id
            ? { ...edge, data: { ...edge.data, waypoints: [] } }
            : edge,
        ),
      );
    },
    [id, setEdges],
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

  // ── Colores y animación ───────────────────────────────────────────────────

  const linkType = data.linkType ?? null;
  const linkColor = linkType
    ? (LINK_COLORS[linkType] ?? "#94a3b8")
    : (style?.stroke ?? "#3b82f6");
  const strokeColor = selected ? "#f97316" : linkColor;
  const strokeWidth = selected ? 2.5 : (style?.strokeWidth ?? 2);

  // Velocidad de animación según bandwidth configurado
  const animDuration = ANIM_SPEED[data.bandwidth] ?? "1.2s";

  // Clase de animación según tipo
  const isWireless = linkType === "Wireless";
  const flowClass = isWireless ? "edge-flow-wireless" : "edge-flow-line";

  const si = data.sourceInterface;
  const ti = data.targetInterface;
  const shortLabel = si && ti ? `${si} → ${ti}` : si || ti || null;

  return (
    <>
      {panelOpen && (
        <ConnectionPanel
          key={id}
          edgeId={id}
          edgeData={data}
          onClose={() => setPanelOpen(false)}
          onSave={handlePanelSave}
        />
      )}

      {/* Área invisible para clic */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
        style={{ cursor: "pointer" }}
        onClick={() => setPanelOpen(true)}
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

      <EdgeLabelRenderer>
        {/* Etiqueta de interfaces — centrada en el bezier real */}
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

        {/* Botón "Ver detalles" — SOLO visible cuando el edge está seleccionado */}
        {(selected || panelOpen) && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY + 22}px)`,
              pointerEvents: "all",
              zIndex: 1001,
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
          </div>
        )}

        {/* Punto de control waypoint */}
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%,-50%) translate(${controlX}px,${controlY}px)`,
            pointerEvents: "all",
            zIndex: 999,
          }}
          className="nodrag nopan"
        >
          <div
            onMouseDown={onControlMouseDown}
            onDoubleClick={onControlDoubleClick}
            title="Arrastra para curvar · Doble clic para resetear"
            style={{
              width: selected || isDragging ? 14 : 8,
              height: selected || isDragging ? 14 : 8,
              borderRadius: "50%",
              background: isDragging
                ? "#f97316"
                : selected
                  ? strokeColor
                  : "#fff",
              border: `2px solid ${strokeColor}`,
              cursor: isDragging ? "grabbing" : "grab",
              opacity: selected || isDragging ? 1 : 0,
              transition: "all 0.15s",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          />
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default EditableEdge;
