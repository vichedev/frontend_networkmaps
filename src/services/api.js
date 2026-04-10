import axios from "axios";
import { config } from "../config";

const api = axios.create({
  baseURL: config.apiUrl,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((r) => {
  console.log("📤", r.method.toUpperCase(), r.url);
  return r;
});
api.interceptors.response.use(
  (r) => r,
  (e) => {
    console.error("❌ API Error:", e.response?.data || e.message);
    return Promise.reject(e);
  },
);

// ── Nodos ──────────────────────────────────────────────────────────────────

export const nodesApi = {
  getNodesByClient: (clientId) => api.get(`/nodes/client/${clientId}`),
  getConnectionsByClient: (clientId) =>
    api.get(`/nodes/client/${clientId}/connections`),
  getNode: (id) => api.get(`/nodes/${id}`),
  createNode: (data) => api.post("/nodes", data),
  updateNodePosition: (id, posX, posY) =>
    api.patch(`/nodes/${id}/position`, { posX, posY }),
  updateNode: (id, data) => api.patch(`/nodes/${id}`, data),
  updateHandles: (nodeId, handles) =>
    api.patch(`/nodes/${nodeId}/handles`, { handles }),
  deleteNode: (id) => api.delete(`/nodes/${id}`),
};

// ── Imágenes (galería por nodo) ────────────────────────────────────────────

export const imagesApi = {
  upload: (nodeId, file, label = "") => {
    const fd = new FormData();
    fd.append("image", file);
    if (label) fd.append("label", label);
    return api.post(`/uploads/node/${nodeId}`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getByNode: (nodeId) => api.get(`/uploads/node/${nodeId}`),
  updateLabel: (imageId, label) =>
    api.patch(`/uploads/image/${imageId}/label`, { label }),
  delete: (imageId) => api.delete(`/uploads/image/${imageId}`),
  reorder: (nodeId, orderedIds) =>
    api.patch(`/uploads/node/${nodeId}/reorder`, { orderedIds }),
};

// ── Conexiones ─────────────────────────────────────────────────────────────

export const connectionsApi = {
  /**
   * Crear conexión entre dos nodos.
   * @param {string}  sourceId
   * @param {string}  targetId
   * @param {string}  sourceHandle   ID del handle origen
   * @param {string}  targetHandle   ID del handle destino
   * @param {Array}   waypoints      Puntos de control de la curva [{x,y}]
   * @param {object}  details        Detalles del enlace:
   *   { sourceInterface, targetInterface, linkType, bandwidth, vlan, notes }
   */
  create: (
    sourceId,
    targetId,
    sourceHandle = null,
    targetHandle = null,
    waypoints = [],
    details = {},
  ) =>
    api.post("/nodes/connections", {
      sourceId,
      targetId,
      sourceHandle,
      targetHandle,
      waypoints,
      sourceInterface: details.sourceInterface ?? null,
      targetInterface: details.targetInterface ?? null,
      linkType: details.linkType ?? null,
      bandwidth: details.bandwidth ?? null,
      vlan: details.vlan ?? null,
      notes: details.notes ?? null,
    }),

  /**
   * Actualizar detalles de una conexión existente.
   * Acepta cualquier subconjunto de los campos:
   * { waypoints, sourceHandle, targetHandle, sourceInterface,
   *   targetInterface, linkType, bandwidth, vlan, notes }
   */
  update: (connectionId, data) =>
    api.patch(`/nodes/connections/${connectionId}`, data),

  /** Eliminar conexión */
  delete: (connectionId) => api.delete(`/nodes/connections/${connectionId}`),
};

// ── Clientes ───────────────────────────────────────────────────────────────

export const clientsApi = {
  getAll: () => api.get("/clients"),
  getById: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post("/clients", data),
  update: (id, data) => api.patch(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`),
};

// ── Proveedores de nube / ISP ──────────────────────────────────────────────

export const cloudsApi = {
  getByClient: (clientId) => api.get(`/clouds/client/${clientId}`),
  getConnectionsByClient: (clientId) =>
    api.get(`/clouds/client/${clientId}/connections`),
  getOne: (id) => api.get(`/clouds/${id}`),
  create: (data) => api.post("/clouds", data),
  update: (id, data) => api.patch(`/clouds/${id}`, data),
  updatePosition: (id, x, y) =>
    api.patch(`/clouds/${id}/position`, { posX: x, posY: y }),
  delete: (id) => api.delete(`/clouds/${id}`),
  ping: (id) => api.post(`/clouds/${id}/ping`),

  // Conexiones nube ↔ nodo (CloudConnection)
  createConnection: (cloudId, nodeId, nodePort) =>
    api.post("/clouds/connections", {
      cloudId,
      nodeId,
      nodePort: nodePort || null,
    }),
  updateConnection: (id, data) => api.patch(`/clouds/connections/${id}`, data),
  deleteConnection: (id) => api.delete(`/clouds/connections/${id}`),
};
