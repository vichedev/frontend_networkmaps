// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de puertos físicos por modelo Mikrotik
// Basado en fichas oficiales de mikrotik.com
//
// Cada puerto tiene:
//   id     → ID único del puerto en React Flow (también usado como sourceHandle/targetHandle)
//   name   → Nombre real en RouterOS (ether1, sfp-sfpplus1, qsfp28-1, etc.)
//   type   → Tipo físico: "GbE" | "SFP" | "SFP+" | "SFP28" | "QSFP28" | "Console"
//   speed  → Velocidad nominal en texto: "1 Gbps", "10 Gbps", "25 Gbps", "100 Gbps"
//   note   → Nota opcional (ej: "CPU directo", "PoE-out", "mgmt")
// ─────────────────────────────────────────────────────────────────────────────

// Colores por tipo de puerto — también se usan en los edges/cables automáticamente
export const PORT_TYPE_COLORS = {
  GbE: "#3b82f6", // azul — cobre RJ45
  SFP: "#8b5cf6", // violeta — fibra 1G
  "SFP+": "#6366f1", // índigo — fibra 10G
  SFP28: "#f97316", // naranja — fibra 25G
  QSFP28: "#ef4444", // rojo — fibra 100G
  Console: "#94a3b8", // gris — consola (no se conecta en el mapa)
};

// Label corto para mostrar en el chip del puerto
export const PORT_TYPE_LABELS = {
  GbE: "1G",
  SFP: "1G",
  "SFP+": "10G",
  SFP28: "25G",
  QSFP28: "100G",
  Console: "—",
};

// Mapeo PORT_TYPE → linkType usado en EditableEdge.
// Cuando se hace una conexión, el edge auto-infiere el tipo de cable a partir
// del tipo de puerto origen si el usuario no lo ha definido manualmente.
export const PORT_TYPE_TO_LINK_TYPE = {
  GbE: "UTP",
  SFP: "SFP",
  "SFP+": "SFP+",
  SFP28: "Fibra",
  QSFP28: "DAC",
  Console: "Otro",
};

// Bandwidth por tipo — usado para auto-completar velocidad al crear conexiones
export const PORT_TYPE_TO_BANDWIDTH = {
  GbE: "1 Gbps",
  SFP: "1 Gbps",
  "SFP+": "10 Gbps",
  SFP28: "25 Gbps",
  QSFP28: "100 Gbps",
  Console: null,
};

// ─── Helpers para construir arrays de puertos sin escribir 13 líneas ─────────

const gbE = (idx, note) => ({
  id: `ether${idx}`,
  name: `ether${idx}`,
  type: "GbE",
  speed: "1 Gbps",
  ...(note ? { note } : {}),
});

const sfp = (idx, note) => ({
  id: `sfp${idx}`,
  name: `sfp${idx}`,
  type: "SFP",
  speed: "1 Gbps",
  ...(note ? { note } : {}),
});

const sfpPlus = (idx, note) => ({
  id: `sfp-sfpplus${idx}`,
  name: `sfp-sfpplus${idx}`,
  type: "SFP+",
  speed: "10 Gbps",
  ...(note ? { note } : {}),
});

const sfp28 = (idx, note) => ({
  id: `sfp28-${idx}`,
  name: `sfp28-${idx}`,
  type: "SFP28",
  speed: "25 Gbps",
  ...(note ? { note } : {}),
});

const qsfp28 = (idx, note) => ({
  id: `qsfp28-${idx}`,
  name: `qsfp28-${idx}`,
  type: "QSFP28",
  speed: "100 Gbps",
  ...(note ? { note } : {}),
});

const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

// ─── Definiciones por modelo ─────────────────────────────────────────────────

export const MODEL_PORTS = {
  // Flagship — 1x GbE + 12x SFP28 25G + 2x QSFP28 100G
  CCR2216: [
    gbE(1, "mgmt/CPU"),
    ...range(12).map((i) => sfp28(i)),
    ...range(2).map((i) => qsfp28(i)),
  ],

  // 13x GbE (ether1 directo al CPU) + 4x SFP+ 10G
  CCR2116: [
    gbE(1, "mgmt/CPU"),
    ...range(12).map((i) => gbE(i + 1)),
    ...range(4).map((i) => sfpPlus(i)),
  ],

  // 1x GbE mgmt + 8x SFP+ 10G
  CCR1072: [gbE(1, "mgmt"), ...range(8).map((i) => sfpPlus(i))],

  // 12x GbE + 4x SFP 1G
  CCR1036: [...range(12).map((i) => gbE(i)), ...range(4).map((i) => sfp(i))],

  // 12x GbE
  CCR1016: range(12).map((i) => gbE(i)),

  // 10x GbE (ether10 PoE-out) + 1x SFP+ 10G
  RB4011: [...range(9).map((i) => gbE(i)), gbE(10, "PoE-out"), sfpPlus(1)],

  // 10x GbE (ether10 PoE-out) + 1x SFP 1G
  RB3011: [...range(9).map((i) => gbE(i)), gbE(10, "PoE-out"), sfp(1)],

  // 13x GbE
  RB1100: range(13).map((i) => gbE(i)),

  // 3x GbE (respetando la descripción actual de tu MODEL_META)
  RB920: range(3).map((i) => gbE(i)),

  // 5x GbE (ether5 PoE-out) + 1x SFP 1G
  HEXS: [...range(4).map((i) => gbE(i)), gbE(5, "PoE-out"), sfp(1)],

  // Sin puertos predefinidos — cae al sistema de handles genéricos
  GENERIC: [],
};

// ─── Utilidades ──────────────────────────────────────────────────────────────

/**
 * Convierte un puerto del catálogo en un handle de React Flow.
 *
 * Los puertos se montan TODOS en la cara inferior del nodo (Position.Bottom),
 * distribuidos uniformemente en % del ancho, a modo de "fila compacta" bajo la
 * imagen. Cada handle es bidireccional (source Y target a la vez) — React Flow
 * permite esto con type="source" + isConnectableEnd=true.
 *
 * Nota: el handle NO lleva `position` aquí — eso lo define el CustomNode al
 * renderizarlo. Esta función solo devuelve la metadata del handle.
 */
export const portToHandle = (port, index, total) => {
  // Distribución uniforme con márgenes — primer puerto en ~8%, último en ~92%
  const start = 8;
  const end = 92;
  const offset =
    total === 1
      ? 50
      : Math.round(start + ((end - start) * index) / (total - 1));

  return {
    id: port.id,
    type: "source", // tipo base — se convierte en bidireccional vía props en el Handle
    position: "bottom", // Position.Bottom — el CustomNode usa Position real
    offset,
    isPort: true, // marca diferenciadora vs handles genéricos
    portName: port.name,
    portType: port.type,
    portSpeed: port.speed,
    portNote: port.note ?? null,
    color: PORT_TYPE_COLORS[port.type] ?? "#94a3b8",
  };
};

/**
 * Dado un modelo, devuelve el array de handles listos para usar en React Flow.
 * Si el modelo no existe o es GENERIC, devuelve null (el CustomNode entonces
 * caerá a `buildDefaultHandles()` — el sistema legacy).
 */
export const buildPortHandles = (model) => {
  const ports = MODEL_PORTS[model];
  if (!ports || ports.length === 0) return null;
  return ports.map((p, i) => portToHandle(p, i, ports.length));
};

/**
 * Busca un puerto por su ID dentro de un modelo. Útil para el EditableEdge
 * cuando quiere saber el tipo del puerto de origen/destino y pintar el cable.
 */
export const findPortByHandleId = (model, handleId) => {
  const ports = MODEL_PORTS[model];
  if (!ports) return null;
  return ports.find((p) => p.id === handleId) ?? null;
};

/**
 * Dado un sourceHandle + model, devuelve la combinación {linkType, bandwidth}
 * sugerida para auto-completar al crear una conexión.
 */
export const suggestLinkFromPort = (model, handleId) => {
  const port = findPortByHandleId(model, handleId);
  if (!port) return { linkType: null, bandwidth: null };
  return {
    linkType: PORT_TYPE_TO_LINK_TYPE[port.type] ?? null,
    bandwidth: PORT_TYPE_TO_BANDWIDTH[port.type] ?? null,
  };
};

/**
 * Resumen textual para la card (ej: "12×SFP28 2×QSFP28")
 * Se puede seguir usando el campo `ports` del MODEL_META existente,
 * pero este helper garantiza consistencia con el catálogo real.
 */
export const getPortSummary = (model) => {
  const ports = MODEL_PORTS[model];
  if (!ports || ports.length === 0) return "—";
  const counts = {};
  ports.forEach((p) => {
    counts[p.type] = (counts[p.type] ?? 0) + 1;
  });
  return Object.entries(counts)
    .map(([type, n]) => `${n}×${type}`)
    .join(" ");
};
