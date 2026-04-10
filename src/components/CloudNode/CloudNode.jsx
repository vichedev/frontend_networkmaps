import React, { memo, useState, useCallback, useEffect } from "react";
import ReactDOM from "react-dom";
import { Handle, Position } from "reactflow";
import { cloudsApi } from "../../services/api";

// ── Animaciones ───────────────────────────────────────────────────────────────
let injected = false;
const injectStyles = () => {
  if (injected) return;
  injected = true;
  const s = document.createElement("style");
  s.textContent = `
    @keyframes cloudFloat  { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-4px)} }
    @keyframes cloudPulse  { 0%,100%{opacity:0.6} 50%{opacity:1} }
    @keyframes cloudOffline{ 0%,100%{opacity:0.3} 50%{opacity:0.6} }
    .cloud-float  { animation:cloudFloat   3s ease-in-out infinite; }
    .cloud-pulse  { animation:cloudPulse   2s ease-in-out infinite; }
    .cloud-offline{ animation:cloudOffline 1.5s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
};
injectStyles();

// Importar colores desde constants compartido
import { PROVIDER_COLORS, PROVIDER_LABELS } from "../../constants";

// ── SVG de nube con color dinámico ────────────────────────────────────────────
const CloudSVG = ({ status, color, isPrimary }) => {
  const isOnline = status === "online";
  const isOffline = status === "offline";
  const glowColor = isOnline ? "#22c55e" : isOffline ? "#ef4444" : "#94a3b8";

  return (
    <svg
      width="110"
      height="68"
      viewBox="0 0 120 72"
      className={isOffline ? "cloud-offline" : "cloud-float"}
      style={{ display: "block", filter: `drop-shadow(0 4px 12px ${color}44)` }}
    >
      <ellipse cx="60" cy="66" rx="38" ry="5" fill={color} opacity="0.12" />
      <path
        d="M 28,48 A 16,16 0 0,1 28,18 A 12,12 0 0,1 44,10 A 18,18 0 0,1 80,12 A 14,14 0 0,1 96,26 A 16,16 0 0,1 92,48 Z"
        fill={color}
        opacity={isOffline ? 0.35 : 0.9}
      />
      <path
        d="M 38,24 A 10,10 0 0,1 52,16 A 14,14 0 0,1 74,18"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* LED estado */}
      <circle
        cx="60"
        cy="34"
        r="5"
        fill={glowColor}
        className={isOnline ? "cloud-pulse" : ""}
      />
      <circle cx="60" cy="34" r="3" fill="white" opacity="0.7" />
      {/* Corona si es primario */}
      {isPrimary && (
        <polygon
          points="85,18 88,11 91,18 94,11 97,18"
          fill="#f59e0b"
          stroke="#d97706"
          strokeWidth="0.8"
        />
      )}
    </svg>
  );
};

// ── Panel de detalles ─────────────────────────────────────────────────────────
const CloudPanel = ({ cloud, onClose, onUpdate }) => {
  const [form, setForm] = useState({ ...cloud });
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState(null);
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await cloudsApi.update(cloud.id, {
        name: form.name,
        isPrimary: form.isPrimary,
        ip: form.ip,
        bandwidth: form.bandwidth,
        sla: form.sla,
        linkType: form.linkType,
        contactName: form.contactName,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        latency: form.latency,
        asn: form.asn,
        notes: form.notes,
      });
      onUpdate(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handlePing = async () => {
    setPinging(true);
    setPingResult(null);
    try {
      const res = await cloudsApi.ping(cloud.id);
      setPingResult(res.data);
      onUpdate({ ...cloud, status: res.data.status });
    } catch {
      setPingResult({ status: "offline", latencyMs: null });
    } finally {
      setPinging(false);
    }
  };

  const LINK_TYPES = [
    "Fibra",
    "Radio",
    "DOCSIS",
    "Satélite",
    "MPLS",
    "SD-WAN",
    "Otro",
  ];
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

  // Color del proveedor según su índice
  const providerColor = cloud.providerColor ?? PROVIDER_COLORS[0];

  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        height: "100vh",
        width: 360,
        background: "#fff",
        borderLeft: "1px solid #e2e8f0",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.1)",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui,sans-serif",
      }}
    >
      {/* Header con color del proveedor */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #f1f5f9",
          background: `linear-gradient(135deg,${providerColor}22,#fff)`,
          borderTop: `4px solid ${providerColor}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>☁️</span>
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#1e293b",
                  margin: 0,
                }}
              >
                {cloud.name}
              </h2>
              {cloud.isPrimary && (
                <span
                  style={{
                    background: "#f59e0b",
                    color: "#78350f",
                    fontSize: 9,
                    fontWeight: 800,
                    padding: "2px 7px",
                    borderRadius: 20,
                  }}
                >
                  👑 PRINCIPAL
                </span>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 5,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background:
                    cloud.status === "online"
                      ? "#22c55e"
                      : cloud.status === "offline"
                        ? "#ef4444"
                        : "#94a3b8",
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: 11, color: "#64748b" }}>
                {cloud.status === "online"
                  ? "En línea"
                  : cloud.status === "offline"
                    ? "Fuera de línea"
                    : "Estado desconocido"}
              </span>
              {cloud.ip && (
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: "#94a3b8",
                  }}
                >
                  {cloud.ip}
                </span>
              )}
            </div>
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

        {/* Ping */}
        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <button
            onClick={handlePing}
            disabled={pinging || !cloud.ip}
            style={{
              background: pinging ? "#93c5fd" : providerColor,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: !cloud.ip || pinging ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {pinging ? (
              <>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    border: "2px solid #fff",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "dashSpin 0.7s linear infinite",
                  }}
                />
                Ping…
              </>
            ) : (
              "🔔 Hacer ping"
            )}
          </button>
          {pingResult && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 20,
                background:
                  pingResult.status === "online" ? "#f0fdf4" : "#fef2f2",
                color: pingResult.status === "online" ? "#16a34a" : "#dc2626",
                border: `1px solid ${pingResult.status === "online" ? "#bbf7d0" : "#fecaca"}`,
              }}
            >
              {pingResult.status === "online"
                ? `✓ Online${pingResult.latencyMs ? ` · ${pingResult.latencyMs}ms` : ""}`
                : "✗ Sin respuesta"}
            </span>
          )}
        </div>
      </div>

      {/* Formulario */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 20px" }}>
        {/* Rol del proveedor */}
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            margin: "12px 0 8px",
          }}
        >
          Rol en la red
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => set("isPrimary", true)}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: 8,
              cursor: "pointer",
              border: `2px solid ${form.isPrimary ? "#f59e0b" : "#e2e8f0"}`,
              background: form.isPrimary ? "#fffbeb" : "#f8fafc",
              color: form.isPrimary ? "#92400e" : "#64748b",
              fontWeight: form.isPrimary ? 700 : 400,
              fontSize: 12,
            }}
          >
            👑 Principal
          </button>
          <button
            onClick={() => set("isPrimary", false)}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: 8,
              cursor: "pointer",
              border: `2px solid ${!form.isPrimary ? "#6366f1" : "#e2e8f0"}`,
              background: !form.isPrimary ? "#eef2ff" : "#f8fafc",
              color: !form.isPrimary ? "#4338ca" : "#64748b",
              fontWeight: !form.isPrimary ? 700 : 400,
              fontSize: 12,
            }}
          >
            🔄 Secundario / Failover
          </button>
        </div>

        {/* Identificación */}
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            margin: "14px 0 8px",
          }}
        >
          Identificación
        </p>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <label
              style={{
                fontSize: 11,
                color: "#64748b",
                fontWeight: 600,
                display: "block",
                marginBottom: 3,
              }}
            >
              Nombre *
            </label>
            <input
              value={form.name || ""}
              onChange={(e) => set("name", e.target.value)}
              style={inp()}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: 11,
                color: "#64748b",
                fontWeight: 600,
                display: "block",
                marginBottom: 3,
              }}
            >
              IP pública
            </label>
            <input
              value={form.ip || ""}
              onChange={(e) => set("ip", e.target.value)}
              placeholder="8.8.8.8"
              style={inp({ fontFamily: "monospace" })}
            />
          </div>
        </div>

        {/* Enlace */}
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            margin: "14px 0 8px",
          }}
        >
          Enlace y capacidad
        </p>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <label
              style={{
                fontSize: 11,
                color: "#64748b",
                fontWeight: 600,
                display: "block",
                marginBottom: 3,
              }}
            >
              Ancho de banda
            </label>
            <input
              value={form.bandwidth || ""}
              onChange={(e) => set("bandwidth", e.target.value)}
              placeholder="200 Mbps"
              style={inp()}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: 11,
                color: "#64748b",
                fontWeight: 600,
                display: "block",
                marginBottom: 3,
              }}
            >
              Tipo
            </label>
            <select
              value={form.linkType || ""}
              onChange={(e) => set("linkType", e.target.value)}
              style={{ ...inp(), cursor: "pointer" }}
            >
              <option value="">— Seleccionar —</option>
              {LINK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{
                fontSize: 11,
                color: "#64748b",
                fontWeight: 600,
                display: "block",
                marginBottom: 3,
              }}
            >
              SLA
            </label>
            <input
              value={form.sla || ""}
              onChange={(e) => set("sla", e.target.value)}
              placeholder="99.9%"
              style={inp()}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: 11,
                color: "#64748b",
                fontWeight: 600,
                display: "block",
                marginBottom: 3,
              }}
            >
              Latencia esperada
            </label>
            <input
              value={form.latency || ""}
              onChange={(e) => set("latency", e.target.value)}
              placeholder="5ms"
              style={inp({ fontFamily: "monospace" })}
            />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label
              style={{
                fontSize: 11,
                color: "#64748b",
                fontWeight: 600,
                display: "block",
                marginBottom: 3,
              }}
            >
              ASN / BGP
            </label>
            <input
              value={form.asn || ""}
              onChange={(e) => set("asn", e.target.value)}
              placeholder="AS3549"
              style={inp({ fontFamily: "monospace" })}
            />
          </div>
        </div>

        {/* Contacto */}
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            margin: "14px 0 8px",
          }}
        >
          Contacto técnico
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            value={form.contactName || ""}
            onChange={(e) => set("contactName", e.target.value)}
            placeholder="Nombre del técnico"
            style={inp()}
          />
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <input
              value={form.contactPhone || ""}
              onChange={(e) => set("contactPhone", e.target.value)}
              placeholder="Teléfono"
              style={inp()}
            />
            <input
              value={form.contactEmail || ""}
              onChange={(e) => set("contactEmail", e.target.value)}
              placeholder="Email"
              style={inp()}
            />
          </div>
        </div>

        {/* Notas */}
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            margin: "14px 0 8px",
          }}
        >
          Notas
        </p>
        <textarea
          value={form.notes || ""}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          placeholder="Observaciones del proveedor…"
          style={{ ...inp(), resize: "vertical", fontFamily: "inherit" }}
        />
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
            background: saved ? "#22c55e" : saving ? "#93c5fd" : providerColor,
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
      <style>{`@keyframes dashSpin{to{transform:rotate(360deg)}}`}</style>
    </div>,
    document.body,
  );
};

// ── CloudNode principal ───────────────────────────────────────────────────────

const CloudNode = ({ data, selected, id }) => {
  const [panelOpen, setPanelOpen] = useState(false);
  const [cloudData, setCloudData] = useState(data);

  useEffect(() => {
    setCloudData(data);
  }, [data]);

  const handleUpdate = useCallback(
    (updated) => {
      setCloudData((prev) => ({ ...prev, ...updated }));
      data.onCloudUpdate?.(id, updated);
    },
    [id, data],
  );

  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    setPanelOpen(true);
  }, []);

  const isOnline = cloudData.status === "online";
  const isOffline = cloudData.status === "offline";

  // Color del proveedor según su índice entre los del mismo cliente
  const providerIndex = cloudData.providerIndex ?? 0;
  const providerColor = PROVIDER_COLORS[providerIndex] ?? PROVIDER_COLORS[0];
  const providerLabel =
    PROVIDER_LABELS[providerIndex] ?? `Proveedor ${providerIndex + 1}`;

  const borderColor = selected
    ? "#3b82f6"
    : isOnline
      ? "#22c55e"
      : isOffline
        ? "#ef4444"
        : "#e2e8f0";

  return (
    <div style={{ position: "relative" }}>
      {panelOpen && (
        <CloudPanel
          key={id}
          cloud={{ id, ...cloudData, providerColor }}
          onClose={() => setPanelOpen(false)}
          onUpdate={handleUpdate}
        />
      )}

      {/* UN solo handle de salida abajo — para conectar con el nodo raíz/padre */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="wan-out"
        isConnectable
        isConnectableStart
        isConnectableEnd
        style={{
          left: "50%",
          bottom: -7,
          width: 13,
          height: 13,
          background: providerColor,
          border: "2.5px solid white",
          borderRadius: "50%",
          cursor: "crosshair",
          zIndex: 10,
          boxShadow: `0 0 0 3px ${providerColor}44`,
          transform: "translateX(-50%)",
        }}
      />

      <div
        onDoubleClick={handleDoubleClick}
        style={{
          background: "#fff",
          border: `2px solid ${borderColor}`,
          borderRadius: 16,
          borderTop: `4px solid ${providerColor}`,
          boxShadow: selected
            ? "0 0 0 3px rgba(59,130,246,0.15), 0 4px 20px rgba(0,0,0,0.1)"
            : isOnline
              ? `0 2px 16px ${providerColor}22`
              : isOffline
                ? "0 2px 16px rgba(239,68,68,0.12)"
                : "0 2px 10px rgba(0,0,0,0.06)",
          minWidth: 160,
          maxWidth: 185,
          cursor: "default",
          transition: "border-color 0.2s, box-shadow 0.2s",
          overflow: "visible",
        }}
      >
        {/* Badge único arriba — muestra P1/P2 y corona si es principal */}
        <div
          style={{
            position: "absolute",
            top: -11,
            left: "50%",
            transform: "translateX(-50%)",
            background: cloudData.isPrimary ? "#f59e0b" : providerColor,
            color: cloudData.isPrimary ? "#78350f" : "#fff",
            fontSize: 9,
            fontWeight: 800,
            padding: "2px 10px",
            borderRadius: 20,
            whiteSpace: "nowrap",
            border: cloudData.isPrimary ? "1px solid #d97706" : "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {cloudData.isPrimary && <span>👑</span>}
          <span>{providerLabel.replace("Proveedor ", "P")}</span>
        </div>

        {/* SVG nube */}
        <div
          style={{
            padding: "14px 12px 4px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <CloudSVG
            status={cloudData.status}
            color={providerColor}
            isPrimary={cloudData.isPrimary}
          />
        </div>

        {/* Info */}
        <div style={{ padding: "0 12px 10px", textAlign: "center" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#0f172a",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {cloudData.name || "Proveedor"}
          </div>

          {cloudData.ip && (
            <div
              style={{
                fontSize: 10,
                fontFamily: "monospace",
                color: "#64748b",
                marginTop: 2,
              }}
            >
              {cloudData.ip}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 4,
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: 5,
            }}
          >
            {cloudData.bandwidth && (
              <span
                style={{
                  fontSize: 9,
                  background: providerColor + "18",
                  color: providerColor,
                  border: `0.5px solid ${providerColor}44`,
                  borderRadius: 10,
                  padding: "1px 6px",
                  fontWeight: 600,
                }}
              >
                {cloudData.bandwidth}
              </span>
            )}
            {cloudData.linkType && (
              <span
                style={{
                  fontSize: 9,
                  background: "#f8fafc",
                  color: "#475569",
                  border: "0.5px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "1px 6px",
                }}
              >
                {cloudData.linkType}
              </span>
            )}
            {cloudData.sla && (
              <span
                style={{
                  fontSize: 9,
                  background: "#f0fdf4",
                  color: "#15803d",
                  border: "0.5px solid #bbf7d0",
                  borderRadius: 10,
                  padding: "1px 6px",
                  fontWeight: 600,
                }}
              >
                SLA {cloudData.sla}
              </span>
            )}
          </div>

          {/* Estado */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              marginTop: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: isOnline
                  ? "#22c55e"
                  : isOffline
                    ? "#ef4444"
                    : "#94a3b8",
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontSize: 9,
                color: isOnline ? "#16a34a" : isOffline ? "#dc2626" : "#94a3b8",
                fontWeight: 600,
              }}
            >
              {isOnline ? "Online" : isOffline ? "Offline" : "Desconocido"}
            </span>
          </div>

          <div style={{ fontSize: 9, color: "#cbd5e1", marginTop: 4 }}>
            doble clic para detalles
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(CloudNode);
