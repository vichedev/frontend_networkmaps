import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_API_URL?.replace("/api", "") ?? "http://localhost:3000";

class SocketService {
  socket = null;

  connect() {
    if (this.socket?.connected) return;

    console.log("Connecting to WebSocket...");
    this.socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    this.socket.on("connect", () => {
      console.log("✅ Socket connected successfully");
    });

    this.socket.on("disconnect", (reason) => {
      console.warn("⚠️ Socket disconnected:", reason);
    });

    this.socket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  // ── Nodos ─────────────────────────────────────────────────────────────────

  /**
   * Escucha actualizaciones de estado de nodos:
   * { nodeId, status, latencyMs?, method?, ip?, timestamp }
   */
  onNodeStatusUpdate(callback) {
    this.socket?.on("nodeStatusUpdate", (data) => {
      console.log(
        `📡 Node status: ${data.nodeId} → ${data.status}` +
          (data.latencyMs ? ` (${data.latencyMs}ms via ${data.method})` : ""),
      );
      callback(data);
    });
  }

  offNodeStatusUpdate() {
    this.socket?.off("nodeStatusUpdate");
  }

  // ── Nubes / Proveedores ────────────────────────────────────────────────────

  /**
   * Escucha actualizaciones de estado de proveedores:
   * { cloudId, status, latencyMs?, method?, ip?, timestamp }
   */
  onCloudStatusUpdate(callback) {
    this.socket?.on("cloudStatusUpdate", (data) => {
      console.log(
        `☁️ Cloud status: ${data.cloudId} → ${data.status}` +
          (data.latencyMs ? ` (${data.latencyMs}ms via ${data.method})` : ""),
      );
      callback(data);
    });
  }

  offCloudStatusUpdate() {
    this.socket?.off("cloudStatusUpdate");
  }
}

export const socketService = new SocketService();
