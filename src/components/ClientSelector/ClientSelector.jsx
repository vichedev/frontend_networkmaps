import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { clientsApi, nodesApi } from "../../services/api";

// ─── Colores por modelo ───────────────────────────────────────────────────────
const MODEL_COLORS = {
  CCR2216: "#185FA5",
  CCR2116: "#1d4ed8",
  CCR1016: "#3C3489",
  CCR1036: "#4338ca",
  CCR1072: "#26215C",
  RB4011: "#1e293b",
  RB920: "#ea580c",
  RB1100: "#475569",
  RB3011: "#334155",
  HEXS: "#374151",
  GENERIC: "#94a3b8",
};

const LINK_COLORS = {
  UTP: "#3b82f6",
  Fibra: "#f97316",
  SFP: "#8b5cf6",
  "SFP+": "#6366f1",
  Wireless: "#22c55e",
  DAC: "#ec4899",
  Otro: "#94a3b8",
};

// ─── Componente de barra de progreso ─────────────────────────────────────────
const Bar = ({ label, value, total, color }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          marginBottom: 3,
        }}
      >
        <span style={{ color: "#475569", fontWeight: 500 }}>{label}</span>
        <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>
          {value} ({pct}%)
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: "#f1f5f9",
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 99,
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </div>
  );
};

// ─── Stat card ────────────────────────────────────────────────────────────────
const Stat = ({ icon, label, value, color = "#3b82f6", onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: "#fff",
      borderRadius: 10,
      padding: "14px 16px",
      border: "0.5px solid #e2e8f0",
      borderLeft: `3px solid ${color}`,
      cursor: onClick ? "pointer" : "default",
      transition: "box-shadow 0.15s",
    }}
    onMouseEnter={(e) => {
      if (onClick)
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = "none";
    }}
  >
    <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
    <div
      style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}
    >
      {value}
    </div>
    <div
      style={{ fontSize: 11, color: "#64748b", marginTop: 3, fontWeight: 500 }}
    >
      {label}
    </div>
  </div>
);

// ─── Dashboard Modal ──────────────────────────────────────────────────────────
const Dashboard = ({ clients, onClose, onSelectClient }) => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("global");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const results = await Promise.all(
          clients.map(async (client) => {
            const [nr, cr] = await Promise.all([
              nodesApi.getNodesByClient(client.id),
              nodesApi.getConnectionsByClient(client.id),
            ]);
            const nodes = nr.data ?? [];
            const conns = cr.data ?? [];

            const modelCount = {};
            nodes.forEach((n) => {
              const m = n.model || "GENERIC";
              modelCount[m] = (modelCount[m] || 0) + 1;
            });

            const linkCount = {};
            conns.forEach((c) => {
              const l = c.linkType || "Sin tipo";
              linkCount[l] = (linkCount[l] || 0) + 1;
            });

            const ifaceUsage = {};
            conns.forEach((c) => {
              if (c.sourceInterface)
                ifaceUsage[c.sourceInterface] =
                  (ifaceUsage[c.sourceInterface] || 0) + 1;
              if (c.targetInterface)
                ifaceUsage[c.targetInterface] =
                  (ifaceUsage[c.targetInterface] || 0) + 1;
            });

            return {
              id: client.id,
              name: client.name,
              createdAt: client.createdAt,
              total: nodes.length,
              online: nodes.filter((n) => n.status === "online").length,
              offline: nodes.filter((n) => n.status !== "online").length,
              conns: conns.length,
              modelCount,
              linkCount,
              ifaceUsage,
            };
          }),
        );

        const map = {};
        results.forEach((r) => {
          map[r.id] = r;
        });
        setStats(map);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const all = Object.values(stats);
  const gTotal = all.reduce((a, s) => a + s.total, 0);
  const gOnline = all.reduce((a, s) => a + s.online, 0);
  const gOffline = all.reduce((a, s) => a + s.offline, 0);
  const gConns = all.reduce((a, s) => a + s.conns, 0);

  // Top modelos globales
  const gModels = {};
  all.forEach((s) =>
    Object.entries(s.modelCount || {}).forEach(([m, c]) => {
      gModels[m] = (gModels[m] || 0) + c;
    }),
  );
  const topModels = Object.entries(gModels)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Top links globales
  const gLinks = {};
  all.forEach((s) =>
    Object.entries(s.linkCount || {}).forEach(([l, c]) => {
      gLinks[l] = (gLinks[l] || 0) + c;
    }),
  );
  const topLinks = Object.entries(gLinks).sort((a, b) => b[1] - a[1]);

  const current = tab !== "global" ? stats[tab] : null;

  const tabBtn = (id, label) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: "9px 18px",
        border: "none",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
        background: tab === id ? "#fff" : "transparent",
        color: tab === id ? "#1e293b" : "#94a3b8",
        borderBottom:
          tab === id ? "3px solid #3b82f6" : "3px solid transparent",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(10,15,30,0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#f8fafc",
          borderRadius: 20,
          width: "min(920px,96vw)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 40px 100px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",
            padding: "20px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#f1f5f9",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 24 }}>📊</span> Dashboard de Red
            </h1>
            <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
              {clients.length} cliente{clients.length !== 1 ? "s" : ""} ·{" "}
              {gTotal} equipos · {gConns} conexiones
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#ef4444",
              border: "none",
              borderRadius: "50%",
              width: 34,
              height: 34,
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 900,
              boxShadow: "0 2px 10px rgba(239,68,68,0.5)",
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

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            background: "#1e293b",
            overflowX: "auto",
            flexShrink: 0,
            borderBottom: "1px solid #334155",
          }}
        >
          {tabBtn("global", "🌐 Vista global")}
          {clients.map((c) => tabBtn(c.id, `📡 ${c.name}`))}
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {loading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 220,
                gap: 14,
                color: "#64748b",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  border: "3px solid #e2e8f0",
                  borderTopColor: "#3b82f6",
                  borderRadius: "50%",
                  animation: "dashSpin 0.7s linear infinite",
                }}
              />
              <span style={{ fontSize: 13 }}>
                Cargando estadísticas de todos los clientes…
              </span>
              <style>{`@keyframes dashSpin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : tab === "global" ? (
            // ── VISTA GLOBAL ──────────────────────────────────────────────────
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Stats globales */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: 12,
                }}
              >
                <Stat
                  icon="🏢"
                  label="Clientes totales"
                  value={clients.length}
                  color="#6366f1"
                />
                <Stat
                  icon="🖧"
                  label="Equipos totales"
                  value={gTotal}
                  color="#3b82f6"
                />
                <Stat
                  icon="🟢"
                  label="Equipos online"
                  value={gOnline}
                  color="#22c55e"
                />
                <Stat
                  icon="🔗"
                  label="Conexiones totales"
                  value={gConns}
                  color="#f97316"
                />
              </div>

              {/* Estado de red */}
              {gTotal > 0 && (
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    padding: 20,
                    border: "0.5px solid #e2e8f0",
                  }}
                >
                  <h3
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#1e293b",
                      marginBottom: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>📡</span> Estado de red global
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 16,
                    }}
                  >
                    <div>
                      <Bar
                        label="Online"
                        value={gOnline}
                        total={gTotal}
                        color="#22c55e"
                      />
                      <Bar
                        label="Offline"
                        value={gOffline}
                        total={gTotal}
                        color="#ef4444"
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {/* Donut visual */}
                      <div
                        style={{ position: "relative", width: 90, height: 90 }}
                      >
                        <svg
                          viewBox="0 0 36 36"
                          style={{
                            transform: "rotate(-90deg)",
                            width: 90,
                            height: 90,
                          }}
                        >
                          <circle
                            cx="18"
                            cy="18"
                            r="15.9"
                            fill="none"
                            stroke="#f1f5f9"
                            strokeWidth="3.5"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="15.9"
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth="3.5"
                            strokeDasharray={`${gTotal > 0 ? (gOnline / gTotal) * 100 : 0} 100`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 18,
                              fontWeight: 800,
                              color: "#0f172a",
                              lineHeight: 1,
                            }}
                          >
                            {gTotal > 0
                              ? Math.round((gOnline / gTotal) * 100)
                              : 0}
                            %
                          </div>
                          <div style={{ fontSize: 9, color: "#94a3b8" }}>
                            online
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                {/* Top modelos */}
                {topModels.length > 0 && (
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: 12,
                      padding: 20,
                      border: "0.5px solid #e2e8f0",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1e293b",
                        marginBottom: 14,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>⚙️</span> Modelos más usados
                    </h3>
                    {topModels.map(([model, count]) => (
                      <Bar
                        key={model}
                        label={model}
                        value={count}
                        total={gTotal}
                        color={MODEL_COLORS[model] ?? "#94a3b8"}
                      />
                    ))}
                  </div>
                )}

                {/* Top enlaces */}
                {topLinks.length > 0 && (
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: 12,
                      padding: 20,
                      border: "0.5px solid #e2e8f0",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1e293b",
                        marginBottom: 14,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>🔗</span> Tipos de enlace
                    </h3>
                    {topLinks.map(([link, count]) => (
                      <Bar
                        key={link}
                        label={link}
                        value={count}
                        total={gConns}
                        color={LINK_COLORS[link] ?? "#94a3b8"}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Tabla resumen por cliente */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  border: "0.5px solid #e2e8f0",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <h3
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#1e293b",
                      margin: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>📋</span> Resumen por cliente
                  </h3>
                </div>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {[
                        "Cliente",
                        "Equipos",
                        "Online",
                        "Offline",
                        "Conexiones",
                        "Creado",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "8px 16px",
                            textAlign: "left",
                            color: "#64748b",
                            fontWeight: 600,
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                      <th style={{ padding: "8px 16px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c, i) => {
                      const s = stats[c.id];
                      if (!s) return null;
                      return (
                        <tr
                          key={c.id}
                          style={{
                            borderTop: "1px solid #f1f5f9",
                            background: i % 2 === 0 ? "#fff" : "#fafafa",
                          }}
                        >
                          <td
                            style={{
                              padding: "10px 16px",
                              fontWeight: 700,
                              color: "#1e293b",
                            }}
                          >
                            {c.name}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              color: "#3b82f6",
                              fontWeight: 600,
                            }}
                          >
                            {s.total}
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            <span
                              style={{
                                color: "#16a34a",
                                fontWeight: 600,
                                background: "#f0fdf4",
                                padding: "2px 8px",
                                borderRadius: 20,
                                fontSize: 11,
                              }}
                            >
                              🟢 {s.online}
                            </span>
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            <span
                              style={{
                                color: "#dc2626",
                                fontWeight: 600,
                                background: "#fef2f2",
                                padding: "2px 8px",
                                borderRadius: 20,
                                fontSize: 11,
                              }}
                            >
                              🔴 {s.offline}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              color: "#f97316",
                              fontWeight: 600,
                            }}
                          >
                            {s.conns}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              color: "#94a3b8",
                              fontSize: 11,
                            }}
                          >
                            {new Date(c.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            <button
                              onClick={() => {
                                onSelectClient(c.id);
                                onClose();
                              }}
                              style={{
                                background: "#3b82f6",
                                color: "#fff",
                                border: "none",
                                borderRadius: 7,
                                padding: "5px 12px",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Ver mapa →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : current ? (
            // ── VISTA POR CLIENTE ─────────────────────────────────────────────
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#0f172a",
                    margin: 0,
                  }}
                >
                  📡 {current.name}
                </h2>
                <button
                  onClick={() => {
                    onSelectClient(current.id);
                    onClose();
                  }}
                  style={{
                    background: "#3b82f6",
                    color: "#fff",
                    border: "none",
                    borderRadius: 9,
                    padding: "8px 18px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Abrir mapa →
                </button>
              </div>

              {/* Stats del cliente */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: 12,
                }}
              >
                <Stat
                  icon="🖧"
                  label="Equipos"
                  value={current.total}
                  color="#3b82f6"
                />
                <Stat
                  icon="🟢"
                  label="Online"
                  value={current.online}
                  color="#22c55e"
                />
                <Stat
                  icon="🔴"
                  label="Offline"
                  value={current.offline}
                  color="#ef4444"
                />
                <Stat
                  icon="🔗"
                  label="Conexiones"
                  value={current.conns}
                  color="#f97316"
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                {/* Modelos del cliente */}
                {Object.keys(current.modelCount).length > 0 && (
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: 12,
                      padding: 20,
                      border: "0.5px solid #e2e8f0",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1e293b",
                        marginBottom: 14,
                      }}
                    >
                      ⚙️ Equipos por modelo
                    </h3>
                    {Object.entries(current.modelCount)
                      .sort((a, b) => b[1] - a[1])
                      .map(([model, count]) => (
                        <Bar
                          key={model}
                          label={model}
                          value={count}
                          total={current.total}
                          color={MODEL_COLORS[model] ?? "#94a3b8"}
                        />
                      ))}
                  </div>
                )}

                {/* Tipos de enlace del cliente */}
                {Object.keys(current.linkCount).length > 0 && (
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: 12,
                      padding: 20,
                      border: "0.5px solid #e2e8f0",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1e293b",
                        marginBottom: 14,
                      }}
                    >
                      🔗 Tipos de enlace
                    </h3>
                    {Object.entries(current.linkCount)
                      .sort((a, b) => b[1] - a[1])
                      .map(([link, count]) => (
                        <Bar
                          key={link}
                          label={link}
                          value={count}
                          total={current.conns}
                          color={LINK_COLORS[link] ?? "#94a3b8"}
                        />
                      ))}
                  </div>
                )}
              </div>

              {/* Interfaces más usadas */}
              {Object.keys(current.ifaceUsage).length > 0 && (
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    padding: 20,
                    border: "0.5px solid #e2e8f0",
                  }}
                >
                  <h3
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#1e293b",
                      marginBottom: 14,
                    }}
                  >
                    🔌 Interfaces más utilizadas
                  </h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {Object.entries(current.ifaceUsage)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 20)
                      .map(([iface, count]) => (
                        <div
                          key={iface}
                          style={{
                            background: "#f1f5f9",
                            borderRadius: 8,
                            padding: "5px 12px",
                            fontSize: 11,
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            fontFamily: "monospace",
                          }}
                        >
                          <span style={{ color: "#3b82f6", fontWeight: 700 }}>
                            {iface}
                          </span>
                          <span
                            style={{
                              background: "#3b82f6",
                              color: "#fff",
                              borderRadius: 10,
                              padding: "0px 5px",
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            {count}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Info del cliente */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: 20,
                  border: "0.5px solid #e2e8f0",
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                <p>
                  📅 Cliente creado:{" "}
                  <strong style={{ color: "#1e293b" }}>
                    {new Date(current.createdAt).toLocaleString()}
                  </strong>
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─── ClientSelector principal ─────────────────────────────────────────────────

const ClientSelector = ({ currentClientId, onClientChange }) => {
  const [clients, setClients] = useState([]);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [loading, setLoading] = useState(false);

  const loadClients = useCallback(async () => {
    try {
      const response = await clientsApi.getAll();
      const data = Array.isArray(response.data) ? response.data : [];
      setClients(data);
      if (data.length > 0 && !currentClientId) {
        onClientChange(data[0].id);
      }
    } catch (error) {
      console.error("❌ Error:", error);
    }
  }, [currentClientId, onClientChange]);

  useEffect(() => {
    loadClients();
  }, []);

  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    setLoading(true);
    try {
      const response = await clientsApi.create({ name: newClientName });
      const newClient = response.data;
      setClients((prev) => [...prev, newClient]);
      onClientChange(newClient.id);
      setShowModal(false);
      setNewClientName("");
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentClient = clients.find((c) => c.id === currentClientId);

  return (
    <>
      <div className="absolute top-5 left-5 z-20 flex gap-2 items-center">
        {/* Selector de cliente */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex items-center overflow-hidden">
          {/* Botón Dashboard */}
          <button
            onClick={() => setShowDashboard(true)}
            style={{
              padding: "9px 16px",
              background: "linear-gradient(135deg,#1e293b,#1e3a5f)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 7,
              borderRight: "1px solid #334155",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            title="Abrir Dashboard"
          >
            <span style={{ fontSize: 15 }}>📊</span>
            Dashboard
          </button>

          {/* Selector */}
          <div className="px-3 py-2 border-r border-gray-200 flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Cliente:</span>
            <select
              value={currentClientId || ""}
              onChange={(e) => onClientChange(e.target.value)}
              className="text-sm font-semibold text-gray-700 bg-transparent focus:outline-none"
            >
              <option value="">— Seleccionar —</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          {/* Nuevo cliente */}
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Nuevo Cliente
          </button>
        </div>

        {/* Badge cliente activo */}
        {currentClient && (
          <div
            style={{
              background: "#f0fdf4",
              color: "#16a34a",
              border: "1px solid #bbf7d0",
              padding: "7px 14px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span style={{ fontSize: 10 }}>✓</span>
            {currentClient.name}
          </div>
        )}
      </div>

      {/* Dashboard */}
      {showDashboard && (
        <Dashboard
          clients={clients}
          onClose={() => setShowDashboard(false)}
          onSelectClient={(id) => {
            onClientChange(id);
          }}
        />
      )}

      {/* Modal nuevo cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-96 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Crear Nuevo Cliente</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: "#ef4444",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateClient}>
              <input
                type="text"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Nombre del cliente"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
                autoFocus
                disabled={loading}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
                >
                  {loading ? "Creando..." : "Crear"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ClientSelector;
