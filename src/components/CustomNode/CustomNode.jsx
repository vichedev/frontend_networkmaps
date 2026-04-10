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
    ports: "12×SFP28 2×QSFP28",
    img: imgCCR2216,
  },
  CCR2116: {
    label: "CCR2116-12G-4S+",
    cat: "Core Router",
    color: "#185FA5",
    ports: "12×GbE 4×SFP+",
    img: imgCCR2116,
  },
  CCR1016: {
    label: "CCR1016-12G",
    cat: "Core Router",
    color: "#3C3489",
    ports: "12×GbE",
    img: imgCCR1016,
  },
  CCR1036: {
    label: "CCR1036-12G-4S",
    cat: "Core Router",
    color: "#3C3489",
    ports: "12×GbE 4×SFP",
    img: imgCCR1036,
  },
  CCR1072: {
    label: "CCR1072-1G-8S+",
    cat: "Core Router",
    color: "#26215C",
    ports: "8×SFP+ 1×GbE",
    img: imgCCR1072,
  },
  RB4011: {
    label: "RB4011iGS+RM",
    cat: "RouterBOARD",
    color: "#1e293b",
    ports: "10×GbE 1×SFP+",
    img: imgRB4011,
  },
  RB920: {
    label: "RB920",
    cat: "RouterBOARD",
    color: "#ea580c",
    ports: "3×GbE",
    img: imgRB920,
  },
  RB1100: {
    label: "RB1100AHx4",
    cat: "RouterBOARD",
    color: "#475569",
    ports: "13×GbE",
    img: imgRB1100,
  },
  RB3011: {
    label: "RB3011UiAS-RM",
    cat: "RouterBOARD",
    color: "#1e293b",
    ports: "10×GbE 1×SFP+",
    img: imgRB3011,
  },
  HEXS: {
    label: "hEX S",
    cat: "RouterBOARD",
    color: "#1a1a1a",
    ports: "5×GbE 1×SFP",
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

// ─── Handles ─────────────────────────────────────────────────────────────────

const POSITIONS = [
  Position.Top,
  Position.Bottom,
  Position.Left,
  Position.Right,
];
const POSITION_LABELS = {
  [Position.Top]: "↑ Arriba",
  [Position.Bottom]: "↓ Abajo",
  [Position.Left]: "← Izquierda",
  [Position.Right]: "→ Derecha",
};
const HANDLE_COLORS = { source: "#3b82f6", target: "#22c55e" };

// Top queda RESERVADO para handles WAN SOLO en el nodo raíz.
// Nodos normales (no raíz) pueden usar Top para handles azules/verdes normales.
const POSITIONS_NORMAL = [Position.Bottom, Position.Left, Position.Right];

export const buildDefaultHandles = () =>
  POSITIONS_NORMAL.flatMap((pos) => [
    { id: `source-${pos}-0`, type: "source", position: pos, offset: 33 },
    { id: `target-${pos}-0`, type: "target", position: pos, offset: 67 },
  ]);

// Los 2 handles WAN naranjas que aparecen en la cara superior del nodo raíz
// Solo se agregan cuando el nodo no tiene conexiones entrantes (es raíz)
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

// redistributeAllInFace — redistribuye TODOS los handles normales de una cara
// agrupando source y target juntos para evitar cualquier solapamiento
const redistributeAllInFace = (handles, position) => {
  const faceHandles = handles.filter(
    (h) => !h.isWan && h.position === position,
  );
  const total = faceHandles.length;
  if (!total) return handles;

  // Rango usable: 10% a 90% del lado — mínimo 14px de separación
  const range = 80;
  const start = 10;
  const step = total === 1 ? 0 : range / (total - 1);

  // Ordenar: primero source, luego target (para consistencia visual)
  const ordered = [
    ...faceHandles.filter((h) => h.type === "source"),
    ...faceHandles.filter((h) => h.type === "target"),
  ];

  const updated = ordered.map((h, i) => ({
    ...h,
    offset: total === 1 ? 50 : Math.round(start + step * i),
  }));

  const map = Object.fromEntries(updated.map((h) => [h.id, h]));
  return handles.map((h) => map[h.id] ?? h);
};

// redistributeOffsets — compatibilidad: redistribuye la cara del handle modificado
const redistributeOffsets = (handles, position, _type) => {
  return redistributeAllInFace(handles, position);
};

// ─── DynamicHandle ────────────────────────────────────────────────────────────
//
// CLAVE para alineación visual punto ↔ línea:
// ReactFlow posiciona el handle en el borde del nodo usando `position` (Top/Bottom/Left/Right).
// Para distribuir múltiples handles en una cara usamos:
//   - Cara horizontal (Top/Bottom): `style.left` con % — NO tocar `top`
//   - Cara vertical  (Left/Right):  `style.top`  con % — NO tocar `left`
// El tamaño (width/height) debe ser impar para que el centro coincida exactamente
// con donde ReactFlow dibuja el extremo de la línea (transform: translate(-50%,-50%))

const DynamicHandle = memo(({ handle }) => {
  const isHoriz =
    handle.position === Position.Left || handle.position === Position.Right;

  // ── Handle WAN — naranja, cara superior, solo nodo raíz ────────────────────
  if (handle.isWan) {
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
          // ReactFlow posiciona en borde Top. Solo ajustamos left para distribuir
          // múltiples handles. top queda en el valor por defecto (-4px = mitad del círculo)
          left: `${handle.offset}%`,
          top: -6, // mitad del círculo de 13px sobresale del borde
          transform: "translateX(-50%)", // centrar sobre el punto
          width: 14,
          height: 14,
          background: wanColor,
          border: "3px solid white",
          borderRadius: "50%",
          cursor: "crosshair",
          zIndex: 30,
          boxShadow: `0 0 0 3px ${wanColor}55, 0 2px 8px rgba(0,0,0,0.3)`,
          position: "absolute", // necesario para que left/top funcionen
        }}
        title={`☁️ Entrada WAN: ${handle.cloudName ?? "Proveedor"}`}
      />
    );
  }

  // ── Handle normal — azul (source) o verde (target) ─────────────────────────
  return (
    <Handle
      type={handle.type}
      position={handle.position}
      id={handle.id}
      isConnectable
      isConnectableStart
      isConnectableEnd
      style={{
        // Para cara horizontal (Top/Bottom): controlar left
        // Para cara vertical  (Left/Right):  controlar top
        // NO mezclar — no poner left en Left/Right ni top en Top/Bottom
        ...(isHoriz
          ? { top: `${handle.offset}%` } // cara lateral → ajustar vertical
          : { left: `${handle.offset}%` }), // cara Top/Bottom → ajustar horizontal
        width: 12,
        height: 12,
        background: HANDLE_COLORS[handle.type],
        border: "2px solid white",
        borderRadius: "50%",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        cursor: "crosshair",
        zIndex: 10,
      }}
    />
  );
});

// ─── Panel de handles ─────────────────────────────────────────────────────────

const HandlePanel = memo(
  ({ handles, onAdd, onRemove, onClose, isRootNode }) => {
    const [selPos, setSelPos] = useState(Position.Bottom);
    const [selType, setSelType] = useState("source");
    // Solo contar handles NO-WAN para la lógica de eliminación
    const count = (pos, type) =>
      handles.filter((h) => !h.isWan && h.position === pos && h.type === type)
        .length;
    const stop = (e) => {
      e.stopPropagation();
      e.preventDefault();
    };

    return (
      <div
        onMouseDown={stop}
        onPointerDown={stop}
        style={{
          position: "absolute",
          top: 0,
          left: "calc(100% + 12px)",
          width: 224,
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.13)",
          zIndex: 99999,
          padding: 14,
          fontSize: 12,
          userSelect: "none",
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
            ⚙ Puntos
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
              width: 24,
              height: 24,
              cursor: "pointer",
              fontSize: 13,
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
        <p
          style={{
            color: "#94a3b8",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 6,
          }}
        >
          Cara
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 4,
            marginBottom: 10,
          }}
        >
          {POSITIONS.map((pos) => {
            // Top bloqueado SOLO para nodo raíz (reservado para WAN naranjas)
            const isTopBlocked = pos === Position.Top && isRootNode;
            const isSelec = selPos === pos;
            return (
              <button
                key={pos}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isTopBlocked) setSelPos(pos);
                }}
                title={
                  isTopBlocked
                    ? "Reservado para entradas WAN (proveedores)"
                    : ""
                }
                style={{
                  padding: "5px 4px",
                  borderRadius: 6,
                  fontSize: 11,
                  cursor: isTopBlocked ? "not-allowed" : "pointer",
                  border: `1.5px solid ${isTopBlocked ? "#fed7aa" : isSelec ? "#6366f1" : "#e2e8f0"}`,
                  background: isTopBlocked
                    ? "#fff7ed"
                    : isSelec
                      ? "#eef2ff"
                      : "#f8fafc",
                  color: isTopBlocked
                    ? "#c2410c"
                    : isSelec
                      ? "#4f46e5"
                      : "#64748b",
                  fontWeight: isSelec ? 700 : 400,
                  opacity: isTopBlocked ? 0.7 : 1,
                }}
              >
                {POSITION_LABELS[pos]}
                {isTopBlocked && (
                  <span
                    style={{ fontSize: 8, display: "block", color: "#c2410c" }}
                  >
                    solo WAN
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p
          style={{
            color: "#94a3b8",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 6,
          }}
        >
          Tipo
        </p>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {["source", "target"].map((type) => (
            <button
              key={type}
              onClick={(e) => {
                e.stopPropagation();
                setSelType(type);
              }}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: 6,
                fontSize: 11,
                cursor: "pointer",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                border: `1.5px solid ${selType === type ? HANDLE_COLORS[type] : "#e2e8f0"}`,
                background:
                  selType === type
                    ? type === "source"
                      ? "#eff6ff"
                      : "#f0fdf4"
                    : "#f8fafc",
                color: selType === type ? HANDLE_COLORS[type] : "#94a3b8",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: HANDLE_COLORS[type],
                  display: "inline-block",
                }}
              />
              {type === "source" ? "Origen" : "Destino"}
            </button>
          ))}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd(selPos, selType);
          }}
          style={{
            width: "100%",
            padding: "8px 0",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 12,
            marginBottom: 14,
          }}
        >
          + Agregar punto
        </button>
        <p
          style={{
            color: "#94a3b8",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 6,
          }}
        >
          Actuales ({handles.filter((h) => !h.isWan).length})
        </p>
        <div
          style={{
            maxHeight: 150,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {handles
            .filter((h) => !h.isWan)
            .map((h) => {
              const canDelete = count(h.position, h.type) > 1;
              return (
                <div
                  key={h.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    background: "#f8fafc",
                    borderRadius: 6,
                    border: "1px solid #f1f5f9",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: HANDLE_COLORS[h.type],
                        display: "inline-block",
                      }}
                    />
                    <span style={{ color: "#475569", fontSize: 11 }}>
                      {POSITION_LABELS[h.position]} ·{" "}
                      {h.type === "source" ? "Orig" : "Dest"}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canDelete) onRemove(h.id);
                    }}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      border: "none",
                      background: canDelete ? "#fee2e2" : "#f1f5f9",
                      color: canDelete ? "#ef4444" : "#cbd5e1",
                      cursor: canDelete ? "pointer" : "not-allowed",
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          {/* Handles WAN — solo informativos, no se pueden borrar desde aquí */}
          {handles
            .filter((h) => h.isWan)
            .map((h) => (
              <div
                key={h.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 8px",
                  background: "#f0f9ff",
                  borderRadius: 6,
                  border: `1px solid ${h.color}33`,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: h.color,
                    display: "inline-block",
                    boxShadow: `0 0 0 2px ${h.color}44`,
                  }}
                />
                <span style={{ color: "#1e3a5f", fontSize: 11 }}>
                  ↑ WAN · {h.cloudName ?? "Proveedor"}
                </span>
              </div>
            ))}
        </div>
      </div>
    );
  },
);

// ─── CustomNode principal ─────────────────────────────────────────────────────

const CustomNode = ({ data, selected, id }) => {
  const [panel, setPanel] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handles = useMemo(
    () => (data.handles?.length ? data.handles : buildDefaultHandles()),
    [data.handles],
  );
  const model = data.model ?? "GENERIC";
  const meta = MODEL_META[model] ?? MODEL_META.GENERIC;
  const isOnline = data.status === "online";
  const isOffline = data.status === "offline";
  const ping = data.ping != null ? `${data.ping}ms` : null;

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
    roleTooltip = `Nodo raíz — punto de entrada de proveedores.\n\n• Recibe conexiones de proveedores ISP (puntos naranjas).\n• Distribuye hacia ${srcCount} equipo${srcCount !== 1 ? "s" : ""} de la red.`;
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
    roleTooltip = `Nodo aislado — sin conexiones.\n\n• Para integrarlo, conéctalo a otro equipo\n  arrastrando desde un punto de origen.`;
  }

  // Handles WAN para mostrar indicador visual arriba
  const wanHandles = handles.filter((h) => h.isWan);

  const handleAdd = useCallback(
    (position, type) => {
      // Top bloqueado SOLO para nodo raíz (reservado para handles WAN naranjos)
      if (position === Position.Top && isRootNode) return;
      const newH = {
        id: `${type}-${position}-${Date.now()}`,
        type,
        position,
        offset: 50,
      };
      // redistributeOffsets redistribuye TODA la cara — sin solapamiento
      data.onHandlesChange?.(
        id,
        redistributeOffsets([...handles, newH], position, type),
      );
    },
    [handles, id, data, isRootNode],
  );

  const handleRemove = useCallback(
    (handleId) => {
      const h = handles.find((x) => x.id === handleId);
      if (!h || h.isWan) return;
      data.onHandlesChange?.(
        id,
        redistributeOffsets(
          handles.filter((x) => x.id !== handleId),
          h.position,
          h.type,
        ),
      );
    },
    [handles, id, data],
  );

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

      {/* Todos los handles */}
      {handles.map((h) => (
        <DynamicHandle key={h.id} handle={h} />
      ))}

      {panel === "handles" && (
        <HandlePanel
          handles={handles}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onClose={() => setPanel(null)}
          isRootNode={isRootNode}
        />
      )}
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
          minWidth: 200,
          maxWidth: 220,
          overflow: "visible",
          transition: "border-color 0.15s, box-shadow 0.15s",
          borderTop: `3px solid ${meta.color}`,
          cursor: "default",
        }}
      >
        {/* Indicadores WAN arriba de la tarjeta */}
        {wanHandles.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: -22,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              gap: 5,
              pointerEvents: "none",
            }}
          >
            {wanHandles.map((wh) => (
              <div
                key={wh.id}
                title={wh.cloudName}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: wh.color,
                  border: "1.5px solid white",
                  boxShadow: `0 0 0 2px ${wh.color}55`,
                }}
              />
            ))}
          </div>
        )}

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 8px 4px",
            borderBottom: "0.5px solid #f1f5f9",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: isOnline ? "#22c55e" : "#ef4444",
                display: "inline-block",
                boxShadow: isOnline ? "0 0 0 2px rgba(34,197,94,0.25)" : "none",
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: isOnline ? "#16a34a" : "#dc2626",
              }}
            >
              {isOnline ? "Online" : "Offline"}
            </span>
            {ping && (
              <span
                style={{
                  fontSize: 9,
                  background: "#f0fdf4",
                  color: "#15803d",
                  border: "0.5px solid #bbf7d0",
                  borderRadius: 4,
                  padding: "1px 4px",
                  fontFamily: "monospace",
                }}
              >
                {ping}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
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
            <button
              onClick={togglePanel("handles")}
              title="Gestionar puntos"
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                padding: 0,
                border: `1.5px solid ${panel === "handles" ? "#6366f1" : "#e2e8f0"}`,
                background: panel === "handles" ? "#eef2ff" : "#f8fafc",
                color: panel === "handles" ? "#4f46e5" : "#94a3b8",
                cursor: "pointer",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ⚙
            </button>
          </div>
        </div>

        {/* Imagen — clic = lightbox */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (meta.img) setLightboxOpen(true);
          }}
          title={meta.img ? "Clic para ver en detalle" : ""}
          style={{
            background: "#2d3748",
            padding: "8px 10px",
            borderBottom: "0.5px solid #1a202c",
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

        {/* Info */}
        <div style={{ padding: "8px 10px 6px" }}>
          {/* Badge de rol */}
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

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginBottom: 5,
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
          </div>

          <div
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              color: "#475569",
              background: "#f8fafc",
              borderRadius: 5,
              padding: "3px 7px",
              display: "inline-block",
              border: "0.5px solid #e2e8f0",
            }}
          >
            {data.ip || "—"}
          </div>

          <div
            style={{
              fontSize: 9,
              color: "#cbd5e1",
              marginTop: 5,
              textAlign: "center",
            }}
          >
            doble clic para detalles
          </div>
        </div>

        {/* Leyenda handles */}
        <div
          style={{
            borderTop: "0.5px solid #f1f5f9",
            padding: "4px 10px",
            display: "flex",
            gap: 10,
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#3b82f6",
                display: "inline-block",
              }}
            />
            Orig (
            {handles.filter((h) => !h.isWan && h.type === "source").length})
          </span>
          <span
            style={{
              fontSize: 10,
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#22c55e",
                display: "inline-block",
              }}
            />
            Dest (
            {handles.filter((h) => !h.isWan && h.type === "target").length})
          </span>
          {wanHandles.length > 0 && (
            <span
              style={{
                fontSize: 10,
                color: "#64748b",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: wanHandles[0].color,
                  display: "inline-block",
                }}
              />
              WAN ({wanHandles.length})
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(CustomNode);
