import React, { useState, useCallback, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { EdgeLabelRenderer, getBezierPath, useReactFlow } from "reactflow";
import { cloudsApi } from "../../services/api";
import { WAN_COLORS } from "../../constants";

// ── Animaciones CSS ────────────────────────────────────────────────────────────
let injected = false;
const inject = () => {
  if (injected) return;
  injected = true;
  const s = document.createElement("style");
  s.textContent = `
    /* Flujo de datos hacia el proveedor (upload) */
    @keyframes wanUp {
      from { stroke-dashoffset: 24; }
      to   { stroke-dashoffset: 0; }
    }
    /* Flujo de datos desde el proveedor (download) */
    @keyframes wanDown {
      from { stroke-dashoffset: 0; }
      to   { stroke-dashoffset: 24; }
    }
    /* Pulso del glow al seleccionar */
    @keyframes wanGlow {
      0%,100% { opacity: 0.4; }
      50%      { opacity: 1; }
    }
    /* Partícula de datos corriendo por la línea */
    @keyframes wanParticle {
      from { stroke-dashoffset: 200; }
      to   { stroke-dashoffset: 0; }
    }
    .wan-upload   {
      stroke-dasharray: 10 6;
      animation: wanUp linear infinite;
    }
    .wan-download {
      stroke-dasharray: 10 6;
      animation: wanDown linear infinite;
    }
    .wan-particle {
      stroke-dasharray: 14 186;
      animation: wanParticle linear infinite;
      stroke-linecap: round;
    }
    .wan-glow {
      animation: wanGlow 1.4s ease-in-out infinite;
    }
  `;
  document.head.appendChild(s);
};
inject();

// ── Velocidad de animación según bandwidth ────────────────────────────────────
const BW_SPEED = {
  "100 Mbps": "1.8s",
  "200 Mbps": "1.5s",
  "500 Mbps": "1.2s",
  "1 Gbps": "0.9s",
  "2.5 Gbps": "0.7s",
  "10 Gbps": "0.5s",
  "25 Gbps": "0.35s",
  "100 Gbps": "0.2s",
};
const getSpeed = (bw) => BW_SPEED[bw] ?? "1.1s";

// ── Panel de detalles WAN ─────────────────────────────────────────────────────
const WanPanel = ({
  connectionId,
  nodePort,
  bandwidth,
  providerName,
  providerColor,
  onClose,
  onSave,
}) => {
  const [port, setPort] = useState(nodePort ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const color = providerColor ?? "#f97316";

  const handleSave = async () => {
    setSaving(true);
    try {
      if (connectionId)
        await cloudsApi.updateConnection(connectionId, { nodePort: port });
      onSave({ nodePort: port });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        height: "100vh",
        width: 320,
        background: "#fff",
        borderLeft: "1px solid #e2e8f0",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui,sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #f1f5f9",
          background: `linear-gradient(135deg, ${color}22, #fff)`,
          borderTop: `4px solid ${color}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#1e293b",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>☁️</span>
            Enlace WAN
          </h2>
          <p
            style={{
              fontSize: 11,
              color: color,
              margin: "3px 0 0",
              fontWeight: 600,
            }}
          >
            {providerName ?? "Proveedor"} ↔ Nodo raíz
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
            boxShadow: "0 2px 8px rgba(239,68,68,0.4)",
            transition: "transform 0.1s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.transform = "scale(1.12)")
          }
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          ✕
        </button>
      </div>

      {/* Leyenda visual con el color del proveedor */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid #f1f5f9",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* Upload */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="52" height="14">
            <line
              x1="0"
              y1="7"
              x2="52"
              y2="7"
              stroke={color}
              strokeWidth="2"
              strokeOpacity="0.3"
            />
            <line
              x1="0"
              y1="7"
              x2="52"
              y2="7"
              stroke={color}
              strokeWidth="2.5"
              strokeDasharray="10 6"
              strokeDashoffset="0"
            />
            <polygon points="46,3 52,7 46,11" fill={color} />
          </svg>
          <span style={{ fontSize: 11, color, fontWeight: 700 }}>
            ↑ Upload — hacia el proveedor
          </span>
        </div>
        {/* Download */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="52" height="14">
            <line
              x1="0"
              y1="7"
              x2="52"
              y2="7"
              stroke={color}
              strokeWidth="2"
              strokeOpacity="0.15"
            />
            <line
              x1="0"
              y1="7"
              x2="52"
              y2="7"
              stroke={color}
              strokeWidth="2.5"
              strokeOpacity="0.6"
              strokeDasharray="10 6"
              strokeDashoffset="8"
            />
            <polygon points="6,3 0,7 6,11" fill={color} opacity="0.6" />
          </svg>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
            ↓ Download — desde el proveedor
          </span>
        </div>
        {bandwidth && (
          <div
            style={{
              marginTop: 4,
              padding: "5px 10px",
              background: `${color}11`,
              border: `1px solid ${color}33`,
              borderRadius: 8,
              fontSize: 11,
              color: "#475569",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontWeight: 700, color }}>⚡</span>
            Capacidad: <strong style={{ color: "#1e293b" }}>{bandwidth}</strong>
          </div>
        )}
      </div>

      {/* Formulario */}
      <div style={{ flex: 1, padding: "20px" }}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            display: "block",
            marginBottom: 8,
          }}
        >
          Puerto del nodo padre
        </label>
        <input
          value={port}
          onChange={(e) => setPort(e.target.value)}
          placeholder="ether1, sfp-sfpplus1, wan1…"
          style={{
            width: "100%",
            padding: "9px 12px",
            fontSize: 13,
            border: `1.5px solid ${color}44`,
            borderRadius: 8,
            fontFamily: "monospace",
            outline: "none",
            boxSizing: "border-box",
            background: `${color}08`,
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.target.style.borderColor = color)}
          onBlur={(e) => (e.target.style.borderColor = `${color}44`)}
        />
        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
          Puerto físico del router donde se conecta el cable del proveedor.
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "14px 20px",
          borderTop: "1px solid #f1f5f9",
          display: "flex",
          gap: 8,
        }}
      >
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1,
            padding: "10px 0",
            background: saved ? "#22c55e" : saving ? `${color}88` : color,
            color: "#fff",
            border: "none",
            borderRadius: 9,
            cursor: saving ? "not-allowed" : "pointer",
            fontWeight: 700,
            fontSize: 13,
            transition: "background 0.2s",
            boxShadow: `0 4px 12px ${color}44`,
          }}
        >
          {saved ? "✓ Guardado" : saving ? "Guardando…" : "💾 Guardar"}
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

// ── WanEdge principal ─────────────────────────────────────────────────────────
const WanEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data = {},
  selected,
}) => {
  const { setEdges } = useReactFlow();
  const [isDragging, setIsDragging] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Color del proveedor — viene de data.providerColor (WAN_COLORS naranja)
  const providerColor =
    data.providerColor ?? WAN_COLORS[data.providerIndex ?? 0] ?? "#f97316";
  const speed = getSpeed(data.bandwidth);

  // ── Geometría ──────────────────────────────────────────────────────────────
  const waypoint = data?.waypoints?.[0] ?? null;
  let basePath, labelX, labelY;

  if (waypoint) {
    basePath = `M ${sourceX},${sourceY} Q ${waypoint.x},${waypoint.y} ${targetX},${targetY}`;
    labelX = waypoint.x;
    labelY = waypoint.y;
  } else {
    [basePath, labelX, labelY] = getBezierPath({
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

  // Offset perpendicular para las dos líneas paralelas (upload / download)
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const off = 4; // separación en px entre las dos líneas

  const pathOffset = (ox, oy) =>
    waypoint
      ? `M ${sourceX + nx * ox},${sourceY + ny * oy} Q ${waypoint.x + nx * ox},${waypoint.y + ny * oy} ${targetX + nx * ox},${targetY + ny * oy}`
      : getBezierPath({
          sourceX: sourceX + nx * ox,
          sourceY: sourceY + ny * oy,
          sourcePosition,
          targetX: targetX + nx * ox,
          targetY: targetY + ny * oy,
          targetPosition,
        })[0];

  const uploadPath = pathOffset(off, off);
  const downloadPath = pathOffset(-off, -off);

  // ── Waypoint drag ──────────────────────────────────────────────────────────
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
    (updated) => {
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === id
            ? { ...edge, data: { ...edge.data, ...updated } }
            : edge,
        ),
      );
    },
    [id, setEdges],
  );

  // ── Estilos dinámicos ──────────────────────────────────────────────────────
  const isActive = selected || hovered;
  const glowFilter = isActive
    ? `drop-shadow(0 0 6px ${providerColor}99)`
    : `drop-shadow(0 0 2px ${providerColor}44)`;
  const baseOpacity = isActive ? 0.3 : 0.15;
  const lineWidth = isActive ? 2.8 : 2.2;

  return (
    <>
      {panelOpen && (
        <WanPanel
          key={id}
          connectionId={data.connectionId}
          nodePort={data.nodePort}
          bandwidth={data.bandwidth}
          providerName={data.providerName}
          providerColor={providerColor}
          onClose={() => setPanelOpen(false)}
          onSave={handlePanelSave}
        />
      )}

      {/* Área invisible para hover y clic */}
      <path
        d={basePath}
        fill="none"
        stroke="transparent"
        strokeWidth={28}
        className="react-flow__edge-interaction"
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setPanelOpen((v) => !v)}
      />

      {/* ── Glow base — halo de color del proveedor ── */}
      <path
        d={basePath}
        fill="none"
        stroke={providerColor}
        strokeWidth={isActive ? 12 : 6}
        strokeOpacity={isActive ? 0.12 : 0.07}
        className={isActive ? "wan-glow" : ""}
        style={{ pointerEvents: "none" }}
      />

      {/* ── Upload: línea sólida base ── */}
      <path
        d={uploadPath}
        fill="none"
        stroke={providerColor}
        strokeWidth={lineWidth + 0.5}
        strokeOpacity={baseOpacity}
        style={{ pointerEvents: "none" }}
      />
      {/* Upload: partículas animadas */}
      <path
        d={uploadPath}
        fill="none"
        stroke={providerColor}
        strokeWidth={lineWidth}
        strokeLinecap="round"
        className="wan-upload"
        style={{
          animationDuration: speed,
          pointerEvents: "none",
          filter: glowFilter,
        }}
      />
      {/* Upload: partícula rápida destacada */}
      <path
        d={uploadPath}
        fill="none"
        stroke="#fff"
        strokeWidth={lineWidth - 0.5}
        strokeLinecap="round"
        className="wan-particle"
        style={{
          animationDuration: `${parseFloat(speed) * 1.8}s`,
          pointerEvents: "none",
          opacity: isActive ? 0.9 : 0.5,
        }}
      />

      {/* ── Download: línea sólida base (más tenue — el proveedor envía) ── */}
      <path
        d={downloadPath}
        fill="none"
        stroke={providerColor}
        strokeWidth={lineWidth + 0.5}
        strokeOpacity={baseOpacity * 0.6}
        style={{ pointerEvents: "none" }}
      />
      {/* Download: partículas animadas (dirección opuesta) */}
      <path
        d={downloadPath}
        fill="none"
        stroke={providerColor}
        strokeWidth={lineWidth - 0.3}
        strokeOpacity={0.7}
        strokeLinecap="round"
        className="wan-download"
        style={{
          animationDuration: `${parseFloat(speed) * 1.3}s`,
          pointerEvents: "none",
          filter: glowFilter,
        }}
      />

      <EdgeLabelRenderer>
        {/* ── Badge del proveedor ── */}
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%,-50%) translate(${labelX}px,${labelY - 22}px)`,
            pointerEvents: "none",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: isActive ? providerColor : "#fff",
              border: `1.5px solid ${providerColor}`,
              borderRadius: 20,
              padding: "3px 11px",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 5,
              boxShadow: isActive
                ? `0 3px 12px ${providerColor}55`
                : `0 2px 6px rgba(0,0,0,0.1)`,
              whiteSpace: "nowrap",
              transition: "all 0.2s",
            }}
          >
            <span
              style={{ color: isActive ? "#fff" : providerColor, fontSize: 11 }}
            >
              ☁️
            </span>
            <span style={{ color: isActive ? "#fff" : providerColor }}>
              {data.providerName ?? "WAN"}
            </span>
            {data.nodePort && (
              <span
                style={{
                  color: isActive ? "rgba(255,255,255,0.8)" : "#64748b",
                  fontFamily: "monospace",
                  fontSize: 9,
                  borderLeft: `1px solid ${isActive ? "rgba(255,255,255,0.3)" : "#e2e8f0"}`,
                  paddingLeft: 6,
                }}
              >
                {data.nodePort}
              </span>
            )}
            {data.bandwidth && (
              <span
                style={{
                  color: isActive ? "rgba(255,255,255,0.7)" : "#94a3b8",
                  fontFamily: "monospace",
                  fontSize: 9,
                  borderLeft: `1px solid ${isActive ? "rgba(255,255,255,0.3)" : "#e2e8f0"}`,
                  paddingLeft: 6,
                }}
              >
                {data.bandwidth}
              </span>
            )}
          </div>
        </div>

        {/* ── Botón "Ver detalles" al seleccionar/hover ── */}
        {(isActive || panelOpen) && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY + 14}px)`,
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
                background: panelOpen ? providerColor : "#fff",
                color: panelOpen ? "#fff" : providerColor,
                border: `1.5px solid ${providerColor}`,
                borderRadius: 20,
                padding: "3px 12px",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: `0 2px 8px ${providerColor}44`,
                transition: "all 0.12s",
              }}
            >
              {panelOpen ? "✓ Abierto" : "☁️ Detalles WAN"}
            </button>
          </div>
        )}

        {/* ── Punto de control waypoint ── */}
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
                ? "#fff"
                : selected
                  ? providerColor
                  : "#fff",
              border: `2px solid ${providerColor}`,
              cursor: isDragging ? "grabbing" : "grab",
              opacity: selected || isDragging ? 1 : 0,
              transition: "all 0.15s",
              boxShadow: `0 2px 8px ${providerColor}55`,
            }}
          />
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default WanEdge;
