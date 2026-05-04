import React, { memo, useState, useCallback, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";
import { Handle, Position } from "reactflow";

// ─── Importar imágenes reales ─────────────────────────────────────────────────
import imgCCR2216 from "../../assets/mikrotik/CCR2216.png";
import imgCCR2116 from "../../assets/mikrotik/CCR2116.png";
import imgCCR1016 from "../../assets/mikrotik/CCR1016.png";
import imgCCR1036 from "../../assets/mikrotik/CCR1036.png";
import imgCCR1072 from "../../assets/mikrotik/CCR1072.png";
import imgRB4011 from "../../assets/mikrotik/RB4011.png";
import imgRB920 from "../../assets/mikrotik/RB920.png";
import imgRB1100 from "../../assets/mikrotik/RB1100.png";
import imgRB3011 from "../../assets/mikrotik/RB3011.png";
import imgHEXS from "../../assets/mikrotik/HEXS.png";

// ─── Catálogo de puertos por modelo ───────────────────────────────────────────
import {
  MODEL_PORTS,
  PORT_TYPE_COLORS,
  PORT_TYPE_LABELS,
  getPortSummary,
} from "../../config/routerModels";

// ─── Metadatos de modelos ─────────────────────────────────────────────────────

export const MIKROTIK_MODELS = [
  "CCR2216",
  "CCR2116",
  "CCR1016",
  "CCR1036",
  "CCR1072",
  "RB4011",
  "RB920",
  "RB1100",
  "RB3011",
  "HEXS",
  "GENERIC",
];

export const MODEL_META = {
  CCR2216: {
    label: "CCR2216-1G-12XS-2XQ",
    cat: "Core Router",
    color: "#185FA5",
    ports: getPortSummary("CCR2216"),
    img: imgCCR2216,
  },
  CCR2116: {
    label: "CCR2116-12G-4S+",
    cat: "Core Router",
    color: "#185FA5",
    ports: getPortSummary("CCR2116"),
    img: imgCCR2116,
  },
  CCR1016: {
    label: "CCR1016-12G",
    cat: "Core Router",
    color: "#3C3489",
    ports: getPortSummary("CCR1016"),
    img: imgCCR1016,
  },
  CCR1036: {
    label: "CCR1036-12G-4S",
    cat: "Core Router",
    color: "#3C3489",
    ports: getPortSummary("CCR1036"),
    img: imgCCR1036,
  },
  CCR1072: {
    label: "CCR1072-1G-8S+",
    cat: "Core Router",
    color: "#26215C",
    ports: getPortSummary("CCR1072"),
    img: imgCCR1072,
  },
  RB4011: {
    label: "RB4011iGS+RM",
    cat: "RouterBOARD",
    color: "#1e293b",
    ports: getPortSummary("RB4011"),
    img: imgRB4011,
  },
  RB920: {
    label: "RB920",
    cat: "RouterBOARD",
    color: "#ea580c",
    ports: getPortSummary("RB920"),
    img: imgRB920,
  },
  RB1100: {
    label: "RB1100AHx4",
    cat: "RouterBOARD",
    color: "#475569",
    ports: getPortSummary("RB1100"),
    img: imgRB1100,
  },
  RB3011: {
    label: "RB3011UiAS-RM",
    cat: "RouterBOARD",
    color: "#1e293b",
    ports: getPortSummary("RB3011"),
    img: imgRB3011,
  },
  HEXS: {
    label: "hEX S",
    cat: "RouterBOARD",
    color: "#1a1a1a",
    ports: getPortSummary("HEXS"),
    img: imgHEXS,
  },
  GENERIC: {
    label: "Dispositivo genérico",
    cat: "Red",
    color: "#64748b",
    ports: "—",
    img: null,
  },
};

// ─── Handles WAN (placeholder del nodo raíz) ─────────────────────────────────
// Son los únicos handles que NO son puertos físicos — representan la "entrada"
// de los proveedores ISP. Se mantienen arriba del nodo cuando el nodo es raíz.

export const buildWanPlaceholders = () => [
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

// COMPAT: API legacy usada por useNetworkMap / App — devolvemos array vacío
// porque ya no hay handles genéricos. Exportada por si algún consumidor la llama.
export const buildDefaultHandles = () => [];

// ─── Puertos del catálogo (para modelos conocidos) ────────────────────────────
// Para GENERIC creamos una fila sintética de 4 GbE para no dejar el nodo sin
// puntos de conexión. El usuario puede cambiarlo al elegir un modelo real.

const GENERIC_FALLBACK_PORTS = [
  { id: "port1", name: "port1", type: "GbE", speed: "1 Gbps" },
  { id: "port2", name: "port2", type: "GbE", speed: "1 Gbps" },
  { id: "port3", name: "port3", type: "GbE", speed: "1 Gbps" },
  { id: "port4", name: "port4", type: "GbE", speed: "1 Gbps" },
];

const getPortsForModel = (model) => {
  const ports = MODEL_PORTS[model];
  if (ports && ports.length > 0) return ports;
  return GENERIC_FALLBACK_PORTS;
};

// ─── Lightbox ─────────────────────────────────────────────────────────────────

const Lightbox = memo(({ src, modelId, meta, onClose }) => {
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,10,20,0.94)",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(6px)",
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          background: "#ef4444",
          border: "none",
          borderRadius: "50%",
          width: 36,
          height: 36,
          fontSize: 18,
          cursor: "pointer",
          zIndex: 1000001,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 900,
          boxShadow: "0 2px 12px rgba(239,68,68,0.5)",
          transition: "transform 0.1s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        ✕
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#111827",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.7)",
          padding: "24px 32px",
          maxWidth: "85vw",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: "100%",
            height: 3,
            borderRadius: 2,
            background: meta.color,
          }}
        />
        <img
          src={src}
          alt={meta.label}
          style={{
            maxWidth: "75vw",
            maxHeight: "65vh",
            objectFit: "contain",
            borderRadius: 8,
            filter: "drop-shadow(0 4px 24px rgba(0,0,0,0.5))",
          }}
        />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>
            {modelId}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            {meta.label}
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              justifyContent: "center",
              marginTop: 8,
            }}
          >
            <span
              style={{
                fontSize: 10,
                background: meta.color + "22",
                color: meta.color,
                border: `1px solid ${meta.color}44`,
                borderRadius: 20,
                padding: "2px 10px",
                fontWeight: 700,
              }}
            >
              {meta.cat}
            </span>
            <span
              style={{
                fontSize: 10,
                background: "rgba(255,255,255,0.05)",
                color: "#94a3b8",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20,
                padding: "2px 10px",
                fontFamily: "monospace",
              }}
            >
              {meta.ports}
            </span>
          </div>
        </div>
        <p
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.25)",
            marginTop: -4,
          }}
        >
          Presiona Esc o clic fuera para cerrar
        </p>
      </div>
    </div>,
    document.body,
  );
});

// ─── Galería de selección de modelo ──────────────────────────────────────────

const ModelGallery = memo(({ current, onSelect, onClose }) => (
  <div
    onMouseDown={(e) => e.stopPropagation()}
    onPointerDown={(e) => e.stopPropagation()}
    style={{
      position: "absolute",
      top: 0,
      left: "calc(100% + 12px)",
      width: 380,
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: 14,
      boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
      zIndex: 99999,
      padding: 14,
      userSelect: "none",
      maxHeight: "90vh",
      overflowY: "auto",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>
        Seleccionar modelo
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          background: "#ef4444",
          border: "none",
          borderRadius: "50%",
          width: 26,
          height: 26,
          cursor: "pointer",
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 900,
        }}
      >
        ✕
      </button>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {MIKROTIK_MODELS.map((modelId) => {
        const meta = MODEL_META[modelId];
        const isSel = current === modelId;
        return (
          <button
            key={modelId}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(modelId);
              onClose();
            }}
            style={{
              background: isSel ? "#eff6ff" : "#f8fafc",
              border: `2px solid ${isSel ? "#3b82f6" : "#e2e8f0"}`,
              borderRadius: 10,
              padding: "8px 6px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              transition: "all 0.12s",
            }}
            onMouseEnter={(e) => {
              if (!isSel) e.currentTarget.style.borderColor = "#94a3b8";
            }}
            onMouseLeave={(e) => {
              if (!isSel) e.currentTarget.style.borderColor = "#e2e8f0";
            }}
          >
            <div
              style={{
                width: "100%",
                height: 56,
                borderRadius: 6,
                overflow: "hidden",
                background: "#1e293b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {meta.img ? (
                <img
                  src={meta.img}
                  alt={modelId}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    padding: 4,
                  }}
                />
              ) : (
                <div style={{ fontSize: 24, opacity: 0.35 }}>🖧</div>
              )}
            </div>
            <div style={{ textAlign: "center", width: "100%" }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isSel ? "#1d4ed8" : "#1e293b",
                }}
              >
                {modelId}
              </div>
              <div style={{ fontSize: 9.5, color: "#64748b", marginTop: 1 }}>
                {meta.cat}
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "#94a3b8",
                  marginTop: 1,
                  fontFamily: "monospace",
                }}
              >
                {meta.ports}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  </div>
));

// ─── Icono por tipo de puerto ─────────────────────────────────────────────────
// Glifo visual que diferencia puertos de un vistazo (RJ45 vs SFP vs QSFP).

const PortIcon = ({ type, color, size = 14 }) => {
  // GbE y Console → RJ45 (rectángulo con muescas)
  if (type === "GbE" || type === "Console") {
    return (
      <svg width={size} height={size * 0.75} viewBox="0 0 16 12">
        <rect
          x="1"
          y="2"
          width="14"
          height="8"
          rx="1"
          fill={color}
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="0.5"
        />
        <rect x="5" y="0" width="6" height="3" rx="0.5" fill={color} />
        <line
          x1="3"
          y1="4.5"
          x2="3"
          y2="8"
          stroke="#fff"
          strokeWidth="0.6"
          opacity="0.6"
        />
        <line
          x1="5"
          y1="4.5"
          x2="5"
          y2="8"
          stroke="#fff"
          strokeWidth="0.6"
          opacity="0.6"
        />
        <line
          x1="7"
          y1="4.5"
          x2="7"
          y2="8"
          stroke="#fff"
          strokeWidth="0.6"
          opacity="0.6"
        />
        <line
          x1="9"
          y1="4.5"
          x2="9"
          y2="8"
          stroke="#fff"
          strokeWidth="0.6"
          opacity="0.6"
        />
        <line
          x1="11"
          y1="4.5"
          x2="11"
          y2="8"
          stroke="#fff"
          strokeWidth="0.6"
          opacity="0.6"
        />
        <line
          x1="13"
          y1="4.5"
          x2="13"
          y2="8"
          stroke="#fff"
          strokeWidth="0.6"
          opacity="0.6"
        />
      </svg>
    );
  }
  // QSFP28 → cage ancha con dos slots
  if (type === "QSFP28") {
    return (
      <svg width={size * 1.2} height={size * 0.6} viewBox="0 0 18 9">
        <rect
          x="0.5"
          y="0.5"
          width="17"
          height="8"
          rx="1.5"
          fill={color}
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="0.5"
        />
        <rect x="3" y="3" width="5" height="3" fill="#000" opacity="0.55" />
        <rect x="10" y="3" width="5" height="3" fill="#000" opacity="0.55" />
      </svg>
    );
  }
  // SFP / SFP+ / SFP28 → cage rectangular con slot central
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 16 10">
      <rect
        x="0.5"
        y="0.5"
        width="15"
        height="9"
        rx="1.2"
        fill={color}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.5"
      />
      <rect x="3" y="3.5" width="10" height="3" fill="#000" opacity="0.55" />
    </svg>
  );
};

// ─── PortTooltip ──────────────────────────────────────────────────────────────
// Popover detallado al hover: muestra TODO sobre el puerto (nombre, tipo,
// velocidad, nota especial, estado, y si está conectado, a qué equipo + puerto).

const PortTooltip = memo(({ port, connection, visible, anchorRect }) => {
  if (!visible || !anchorRect) return null;
  const color = PORT_TYPE_COLORS[port.type] ?? "#94a3b8";

  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        left: anchorRect.left + anchorRect.width / 2,
        top: anchorRect.top - 10,
        transform: "translate(-50%, -100%)",
        background: "linear-gradient(180deg, #1f2937 0%, #111827 100%)",
        color: "#f8fafc",
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${color}55`,
        boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px ${color}22`,
        fontSize: 11,
        minWidth: 200,
        maxWidth: 280,
        pointerEvents: "none",
        zIndex: 999998,
        fontFamily: "system-ui, sans-serif",
        animation: "portTooltipIn 0.12s ease-out",
      }}
    >
      {/* Encabezado: ícono + nombre + tipo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
          paddingBottom: 6,
          borderBottom: `1px solid ${color}33`,
        }}
      >
        <div
          style={{
            background: color + "22",
            padding: 4,
            borderRadius: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PortIcon type={port.type} color={color} size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "monospace",
              fontWeight: 800,
              fontSize: 13,
              color: "#fff",
            }}
          >
            {port.name}
          </div>
          <div style={{ fontSize: 10, color: color, fontWeight: 600 }}>
            {port.type} · {port.speed}
          </div>
        </div>
      </div>

      {/* Detalles */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {port.note && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span style={{ color: "#94a3b8" }}>Función</span>
            <span style={{ color: "#fde68a", fontWeight: 600 }}>
              {port.note}
            </span>
          </div>
        )}
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 8 }}
        >
          <span style={{ color: "#94a3b8" }}>Velocidad máx.</span>
          <span style={{ color: "#fff", fontFamily: "monospace" }}>
            {port.speed}
          </span>
        </div>
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 8 }}
        >
          <span style={{ color: "#94a3b8" }}>Conector</span>
          <span style={{ color: "#fff" }}>
            {port.type === "GbE"
              ? "RJ45 (cobre)"
              : port.type === "QSFP28"
                ? "QSFP28 (fibra/DAC)"
                : port.type + " (fibra)"}
          </span>
        </div>
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 8 }}
        >
          <span style={{ color: "#94a3b8" }}>Estado</span>
          <span
            style={{
              color: connection ? "#22c55e" : "#64748b",
              fontWeight: 700,
            }}
          >
            {connection ? "● Conectado" : "○ Libre"}
          </span>
        </div>

        {connection && (
          <div
            style={{
              marginTop: 6,
              paddingTop: 6,
              borderTop: `1px solid ${color}22`,
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: "#94a3b8",
                marginBottom: 3,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Conectado a
            </div>
            <div
              style={{
                fontFamily: "monospace",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {connection.remoteName}
            </div>
            <div
              style={{
                fontFamily: "monospace",
                color: color,
                fontSize: 10,
                marginTop: 1,
              }}
            >
              ↔ {connection.remotePort || "?"}
            </div>
            {connection.linkType && (
              <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 2 }}>
                {connection.linkType}
                {connection.bandwidth ? ` · ${connection.bandwidth}` : ""}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Flecha apuntando hacia el puerto */}
      <div
        style={{
          position: "absolute",
          bottom: -6,
          left: "50%",
          transform: "translateX(-50%) rotate(45deg)",
          width: 10,
          height: 10,
          background: "#111827",
          borderRight: `1px solid ${color}55`,
          borderBottom: `1px solid ${color}55`,
        }}
      />
    </div>,
    document.body,
  );
});

// ─── Inyectar animación del tooltip (una sola vez) ────────────────────────────
let tooltipStylesInjected = false;
const injectTooltipStyles = () => {
  if (tooltipStylesInjected) return;
  tooltipStylesInjected = true;
  const s = document.createElement("style");
  s.textContent = `
    @keyframes portTooltipIn {
      from { opacity: 0; transform: translate(-50%, -95%) scale(0.96); }
      to   { opacity: 1; transform: translate(-50%, -100%) scale(1); }
    }
  `;
  document.head.appendChild(s);
};
injectTooltipStyles();

// ─── Port (una celda del panel frontal) ───────────────────────────────────────

const Port = memo(({ port, isConnected, connection }) => {
  const [hovered, setHovered] = useState(false);
  const [rect, setRect] = useState(null);
  const color = PORT_TYPE_COLORS[port.type] ?? "#94a3b8";
  const label = PORT_TYPE_LABELS[port.type] ?? "—";
  const numLabel = port.name.replace(/^[a-z-]+/i, "") || port.name;

  const onEnter = (e) => {
    setHovered(true);
    setRect(e.currentTarget.getBoundingClientRect());
  };
  const onLeave = () => {
    setHovered(false);
    setRect(null);
  };

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        position: "relative",
      }}
    >
      <PortTooltip
        port={port}
        connection={connection}
        visible={hovered}
        anchorRect={rect}
      />

      {/* Cage del puerto (visual tipo placa frontal) */}
      <div
        style={{
          background: isConnected
            ? `linear-gradient(180deg, ${color} 0%, ${color}dd 60%, ${color}99 100%)`
            : `linear-gradient(180deg, ${color}22 0%, ${color}11 100%)`,
          border: `1px solid ${isConnected ? color : color + "55"}`,
          borderRadius: 4,
          padding: "4px 2px 5px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          minHeight: 50,
          boxShadow: isConnected
            ? `0 0 6px ${color}88, inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 2px rgba(0,0,0,0.3)`
            : `inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 2px rgba(0,0,0,0.25)`,
          cursor: "crosshair",
          position: "relative",
          transition: "all 0.15s",
        }}
      >
        {/* LED + etiquetas PoE/MGMT */}
        <div
          style={{
            display: "flex",
            gap: 2,
            alignItems: "center",
            justifyContent: "center",
            minHeight: 6,
          }}
        >
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: isConnected ? "#4ade80" : "#475569",
              boxShadow: isConnected
                ? "0 0 4px #4ade80, 0 0 2px #fff inset"
                : "inset 0 0 2px rgba(0,0,0,0.5)",
            }}
          />
          {port.note === "PoE-out" && (
            <div
              title="PoE output"
              style={{
                fontSize: 6.5,
                fontWeight: 900,
                color: isConnected ? "#fef3c7" : "#f59e0b",
                letterSpacing: "-0.5px",
              }}
            >
              PoE
            </div>
          )}
          {(port.note === "mgmt" || port.note === "mgmt/CPU") && (
            <div
              title="Management / CPU directo"
              style={{
                fontSize: 6.5,
                fontWeight: 900,
                color: isConnected ? "#e0e7ff" : "#a78bfa",
                letterSpacing: "-0.3px",
              }}
            >
              MGMT
            </div>
          )}
        </div>

        {/* Ícono del conector */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1px 0",
          }}
        >
          <PortIcon
            type={port.type}
            color={isConnected ? "#0f172a" : color}
            size={18}
          />
        </div>

        {/* Número del puerto */}
        <div
          style={{
            fontSize: 8,
            fontFamily: "ui-monospace, monospace",
            fontWeight: 800,
            color: isConnected ? "#fff" : color,
            lineHeight: 1,
            letterSpacing: "-0.3px",
          }}
        >
          {numLabel}
        </div>

        {/* Velocidad */}
        <div
          style={{
            fontSize: 7,
            fontWeight: 800,
            color: isConnected ? "rgba(255,255,255,0.85)" : color + "bb",
            lineHeight: 1,
            letterSpacing: "0.5px",
          }}
        >
          {label}
        </div>
      </div>

      {/* Handle de React Flow — invisible, cubre todo el chip.
          Position.Top hace que los cables nazcan del borde SUPERIOR del chip
          y suban por encima del card hacia los otros nodos. */}
      <Handle
        type="source"
        position={Position.Top}
        id={port.id}
        isConnectable
        isConnectableStart
        isConnectableEnd
        style={{
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
          background: "transparent",
          border: "none",
          borderRadius: 4,
          transform: "none",
          position: "absolute",
          cursor: "crosshair",
          zIndex: 5,
          pointerEvents: "all",
        }}
      />

      {/* Punto de anclaje visible — de aquí sale el cable (ahora arriba) */}
      <div
        style={{
          position: "absolute",
          top: -4,
          left: "50%",
          transform: "translateX(-50%)",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: isConnected ? color : "#334155",
          border: `1.5px solid ${isConnected ? "#fff" : color + "66"}`,
          boxShadow: isConnected
            ? `0 0 0 2px ${color}44, 0 0 6px ${color}`
            : "none",
          pointerEvents: "none",
          zIndex: 6,
          transition: "all 0.15s",
        }}
      />
    </div>
  );
});

// ─── PortPanel — panel frontal completo con todos los puertos ─────────────────

const PortPanel = memo(({ model, portsUsage, lastBlock = false }) => {
  const ports = getPortsForModel(model);
  if (ports.length === 0) return null;

  // Agrupar visualmente por tipo (como en un router real: bloque RJ45 + SFP + QSFP).
  const groups = [];
  let currentGroup = null;
  ports.forEach((p) => {
    if (!currentGroup || currentGroup.type !== p.type) {
      currentGroup = { type: p.type, ports: [p] };
      groups.push(currentGroup);
    } else {
      currentGroup.ports.push(p);
    }
  });

  const usedCount = ports.filter((p) => portsUsage?.has(p.id)).length;

  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, #111827 0%, #0b1220 50%, #111827 100%)",
        borderTop: "1px solid #000",
        // Si es el último bloque del card, no ponemos borde inferior extra
        // y redondeamos las esquinas para que encaje con el borderRadius
        // del card contenedor.
        borderBottom: lastBlock ? "none" : "1px solid #000",
        borderRadius: lastBlock ? "0 0 10px 10px" : 0,
        padding: "8px 8px 10px",
        position: "relative",
      }}
    >
      {/* Tornillos decorativos — detalle de realismo */}
      {[
        { top: 3, left: 3 },
        { top: 3, right: 3 },
        { bottom: 3, left: 3 },
        { bottom: 3, right: 3 },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            ...pos,
            width: 4,
            height: 4,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, #64748b 0%, #334155 60%, #1e293b 100%)",
            boxShadow: "inset 0 0 1px rgba(0,0,0,0.6), 0 0 1px rgba(0,0,0,0.8)",
          }}
        />
      ))}

      {/* Etiqueta del panel */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 5,
          padding: "0 4px",
        }}
      >
        <span
          style={{
            fontSize: 8,
            fontWeight: 800,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
          }}
        >
          Panel frontal · {ports.length} puertos
        </span>
        <span
          style={{
            fontSize: 8,
            fontFamily: "monospace",
            fontWeight: 700,
            color: usedCount > 0 ? "#4ade80" : "#475569",
          }}
        >
          {usedCount}/{ports.length} en uso
        </span>
      </div>

      {/* Fila de puertos, agrupados por tipo con separador sutil */}
      <div
        style={{
          display: "flex",
          gap: 2,
          alignItems: "stretch",
        }}
      >
        {groups.map((g, gi) => (
          <React.Fragment key={g.type + gi}>
            <div
              style={{
                display: "flex",
                gap: 2,
                flex: g.ports.length,
                minWidth: 0,
              }}
            >
              {g.ports.map((p) => {
                const connection = portsUsage?.get?.(p.id) ?? null;
                return (
                  <Port
                    key={p.id}
                    port={p}
                    isConnected={!!connection}
                    connection={connection}
                  />
                );
              })}
            </div>
            {gi < groups.length - 1 && (
              <div
                style={{
                  width: 1,
                  alignSelf: "stretch",
                  margin: "2px 2px",
                  background:
                    "linear-gradient(180deg, transparent 0%, #475569 50%, transparent 100%)",
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Leyenda: resumen de tipos */}
      <div
        style={{
          display: "flex",
          gap: 6,
          justifyContent: "center",
          marginTop: 7,
          flexWrap: "wrap",
        }}
      >
        {Array.from(new Set(ports.map((p) => p.type))).map((type) => {
          const c = PORT_TYPE_COLORS[type];
          const count = ports.filter((p) => p.type === type).length;
          const label = PORT_TYPE_LABELS[type];
          return (
            <div
              key={type}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                fontSize: 8.5,
                color: "#94a3b8",
                fontWeight: 600,
                background: "rgba(255,255,255,0.03)",
                padding: "1px 6px",
                borderRadius: 10,
                border: `0.5px solid ${c}44`,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 1.5,
                  background: c,
                  display: "inline-block",
                  boxShadow: `0 0 3px ${c}99`,
                }}
              />
              <span style={{ color: "#e2e8f0" }}>{count}×</span>
              <span style={{ color: c, fontWeight: 700 }}>{type}</span>
              <span style={{ color: "#64748b" }}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ─── Handle WAN (arriba, naranja, solo nodo raíz) ────────────────────────────

const WanHandle = memo(({ handle }) => {
  const wanColor = handle.color ?? "#f97316";
  return (
    <Handle
      type="target"
      position={Position.Top}
      id={handle.id}
      isConnectable
      isConnectableStart
      isConnectableEnd
      style={{
        left: `${handle.offset}%`,
        top: -6,
        transform: "translateX(-50%)",
        width: 14,
        height: 14,
        background: wanColor,
        border: "3px solid white",
        borderRadius: "50%",
        cursor: "crosshair",
        zIndex: 30,
        boxShadow: `0 0 0 3px ${wanColor}55, 0 2px 8px rgba(0,0,0,0.3)`,
        position: "absolute",
      }}
      title={`☁️ Entrada WAN: ${handle.cloudName ?? "Proveedor"}`}
    />
  );
});

// ─── CustomNode ───────────────────────────────────────────────────────────────

const CustomNode = ({ id, data, selected }) => {
  const [panel, setPanel] = useState(null); // null | "model"
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const model = data.model ?? "GENERIC";
  const meta = MODEL_META[model] ?? MODEL_META.GENERIC;
  const ports = getPortsForModel(model);
  const portCount = ports.length;

  const isOnline = data.status === "online";
  const isOffline = data.status === "offline";

  // ── Rol inteligente ───────────────────────────────────────────────────────
  const srcCount = data.connectionsAsSource?.length ?? 0;
  const tgtCount = data.connectionsAsTarget?.length ?? 0;
  const isRootNode = !!data.isRootNode;

  let roleIcon, roleLabel, roleBg, roleColor, roleTooltip;
  if (isRootNode) {
    roleIcon = "👑";
    roleLabel = "Nodo raíz";
    roleBg = "#f3f0ff";
    roleColor = "#7c3aed";
    roleTooltip = `Nodo raíz — punto de entrada de proveedores.\n\n• Recibe conexiones de proveedores ISP (puntos naranjas arriba).\n• Distribuye hacia ${srcCount} equipo${srcCount !== 1 ? "s" : ""} de la red.`;
  } else if (srcCount > 0 && tgtCount > 0) {
    roleIcon = "🔄";
    roleLabel = "Intermedio";
    roleBg = "#eff6ff";
    roleColor = "#1d4ed8";
    roleTooltip = `Nodo intermedio — distribución.\n\n• Recibe desde ${tgtCount} equipo${tgtCount !== 1 ? "s" : ""} de nivel superior.\n• Distribuye hacia ${srcCount} equipo${srcCount !== 1 ? "s" : ""} de nivel inferior.`;
  } else if (srcCount === 0 && tgtCount > 0) {
    roleIcon = "🍃";
    roleLabel = "Nodo hoja";
    roleBg = "#f0fdf4";
    roleColor = "#15803d";
    roleTooltip = `Nodo hoja — extremo final.\n\n• Recibe desde ${tgtCount} equipo${tgtCount !== 1 ? "s" : ""} de nivel superior.\n• No distribuye hacia ningún otro equipo.`;
  } else if (srcCount > 0 && tgtCount === 0) {
    roleIcon = "🔄";
    roleLabel = "Intermedio";
    roleBg = "#eff6ff";
    roleColor = "#1d4ed8";
    roleTooltip = `Nodo intermedio — distribución.\n\n• Tiene ${srcCount} conexión${srcCount !== 1 ? "es" : ""} de salida.`;
  } else {
    roleIcon = "📍";
    roleLabel = "Aislado";
    roleBg = "#f8fafc";
    roleColor = "#64748b";
    roleTooltip = `Nodo aislado — sin conexiones.\n\n• Para integrarlo, arrastra desde un puerto\n  de este equipo a un puerto de otro.`;
  }

  // ── Mapa de puertos usados ↔ información de conexión ──────────────────────
  // Para cada puerto físico, si tiene conexión, guardamos remoteName/remotePort/
  // linkType/bandwidth. Alimenta el tooltip y el estado iluminado del chip.
  const portsUsage = useMemo(() => {
    const map = new Map();
    (data.connectionsAsSource ?? []).forEach((c) => {
      if (c.sourceHandle) {
        map.set(c.sourceHandle, {
          remoteName: c.target?.name ?? "?",
          remotePort: c.targetHandle || c.targetInterface || null,
          linkType: c.linkType,
          bandwidth: c.bandwidth,
          direction: "out",
        });
      }
    });
    (data.connectionsAsTarget ?? []).forEach((c) => {
      if (c.targetHandle) {
        map.set(c.targetHandle, {
          remoteName: c.source?.name ?? "?",
          remotePort: c.sourceHandle || c.sourceInterface || null,
          linkType: c.linkType,
          bandwidth: c.bandwidth,
          direction: "in",
        });
      }
    });
    return map;
  }, [data.connectionsAsSource, data.connectionsAsTarget]);

  // ── Handles WAN (solo nodo raíz) ──────────────────────────────────────────
  const wanHandles = useMemo(() => {
    const fromData = (data.handles ?? []).filter((h) => h.isWan);
    if (fromData.length > 0) return fromData;
    return isRootNode ? buildWanPlaceholders() : [];
  }, [data.handles, isRootNode]);

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleModelSelect = useCallback(
    (newModel) => {
      data.onModelChange?.(id, newModel);
      setPanel(null);
    },
    [id, data],
  );

  const togglePanel = useCallback(
    (name) => (e) => {
      e.stopPropagation();
      setPanel((prev) => (prev === name ? null : name));
    },
    [],
  );

  const handleDoubleClick = useCallback(
    (e) => {
      e.stopPropagation();
      data.onDoubleClick?.(id);
    },
    [id, data],
  );

  const borderColor = selected
    ? "#3b82f6"
    : isOnline
      ? "#22c55e55"
      : isOffline
        ? "#ef444422"
        : "#e2e8f0";

  // Ancho dinámico: más puertos → card más ancho.
  // ~22px por puerto + 40px de márgenes/padding laterales.
  const minWidth = Math.max(220, portCount * 22 + 40);
  const maxWidth = Math.max(280, portCount * 28 + 60);

  return (
    <div style={{ position: "relative" }}>
      {lightboxOpen && meta.img && (
        <Lightbox
          src={meta.img}
          modelId={model}
          meta={meta}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* WAN handles (solo nodo raíz) */}
      {wanHandles.map((h) => (
        <WanHandle key={h.id} handle={h} />
      ))}

      {panel === "model" && (
        <ModelGallery
          current={model}
          onSelect={handleModelSelect}
          onClose={() => setPanel(null)}
        />
      )}

      {/* ── Tarjeta ── */}
      <div
        onDoubleClick={handleDoubleClick}
        style={{
          background: "#fff",
          border: `2px solid ${borderColor}`,
          borderRadius: 12,
          boxShadow: selected
            ? "0 0 0 3px rgba(59,130,246,0.15), 0 4px 16px rgba(0,0,0,0.1)"
            : "0 2px 10px rgba(0,0,0,0.07)",
          minWidth,
          maxWidth,
          overflow: "visible", // tooltip puede salirse
          transition: "all 0.15s",
        }}
      >
        {/* Toolbar: solo botón de cambio de modelo (ya no hay gear de handles) */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 4,
            padding: "4px 6px 0",
          }}
        >
          <button
            onClick={togglePanel("model")}
            title="Cambiar modelo"
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              padding: 0,
              fontWeight: 700,
              fontSize: 11,
              border: `1.5px solid ${panel === "model" ? meta.color : "#e2e8f0"}`,
              background: panel === "model" ? "#f0f9ff" : "#f8fafc",
              color: panel === "model" ? meta.color : "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ⬡
          </button>
        </div>

        {/* ── 1. IMAGEN DEL ROUTER (arriba) ────────────────────────────── */}
        {/*
            Orden vertical del card:
              Toolbar (botón de modelo)
              → Imagen del router
              → Info: rol + nombre + modelo + IP
              → PortPanel (panel frontal con puertos) — AL FINAL
            Los cables nacen del BORDE SUPERIOR de cada puerto (Position.Top)
            y suben cruzando por encima del card hacia los otros nodos.
        */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (meta.img) setLightboxOpen(true);
          }}
          title={meta.img ? "Clic para ver en detalle" : ""}
          style={{
            background: "#2d3748",
            padding: "8px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 64,
            cursor: meta.img ? "zoom-in" : "default",
            position: "relative",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            if (meta.img) e.currentTarget.style.background = "#374151";
          }}
          onMouseLeave={(e) => {
            if (meta.img) e.currentTarget.style.background = "#2d3748";
          }}
        >
          {meta.img ? (
            <>
              <img
                src={meta.img}
                alt={model}
                style={{ width: "100%", maxHeight: 64, objectFit: "contain" }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 4,
                  right: 5,
                  fontSize: 9,
                  color: "rgba(255,255,255,0.4)",
                  pointerEvents: "none",
                }}
              >
                🔍 ver
              </div>
            </>
          ) : (
            <div style={{ fontSize: 32, opacity: 0.25, color: "#fff" }}>🖧</div>
          )}
        </div>

        {/* ── 2. INFO / DETALLES (medio) ──────────────────────────────── */}
        <div style={{ padding: "8px 10px 6px" }}>
          {/* Rol + contadores */}
          <div
            title={roleTooltip}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: roleBg,
              border: `1px solid ${roleColor}33`,
              borderRadius: 20,
              padding: "3px 9px",
              marginBottom: 6,
              cursor: "help",
              transition: "box-shadow 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.boxShadow = `0 0 0 2px ${roleColor}33`)
            }
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
          >
            <span style={{ fontSize: 11 }}>{roleIcon}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: roleColor }}>
              {roleLabel}
            </span>
            {(srcCount > 0 || tgtCount > 0) && (
              <span
                style={{
                  fontSize: 9,
                  color: roleColor + "aa",
                  fontFamily: "monospace",
                  borderLeft: `1px solid ${roleColor}33`,
                  paddingLeft: 5,
                }}
              >
                {tgtCount > 0 ? `↓${tgtCount}` : ""}
                {tgtCount > 0 && srcCount > 0 ? " " : ""}
                {srcCount > 0 ? `↑${srcCount}` : ""}
              </span>
            )}
          </div>

          {/* Nombre */}
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#0f172a",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginBottom: 3,
            }}
          >
            {data.name || "Sin nombre"}
          </div>

          {/* Modelo + categoría + IP en una fila compacta */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                background: meta.color + "18",
                color: meta.color,
                border: `0.5px solid ${meta.color}44`,
                borderRadius: 4,
                padding: "1px 6px",
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              {model}
            </span>
            <span style={{ fontSize: 9.5, color: "#94a3b8" }}>{meta.cat}</span>
            <span
              style={{
                fontSize: 10.5,
                fontFamily: "monospace",
                color: "#475569",
                background: "#f8fafc",
                borderRadius: 4,
                padding: "1px 6px",
                border: "0.5px solid #e2e8f0",
                marginLeft: "auto",
              }}
            >
              {data.ip || "—"}
            </span>
          </div>
        </div>

        {/* ── 3. PANEL FRONTAL (AL FINAL, con puertos físicos) ────────── */}
        {/* Los puertos tienen Position.Top → los cables nacen del borde
            superior de cada chip y suben por encima del card. */}
        <PortPanel model={model} portsUsage={portsUsage} lastBlock />
      </div>
    </div>
  );
};

export default memo(CustomNode);
