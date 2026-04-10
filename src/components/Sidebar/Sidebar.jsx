import React, { useState, useEffect, useRef, useCallback } from "react";
import Swal from "sweetalert2";
import { nodesApi, imagesApi } from "../../services/api";
import { config } from "../../config";

// ── Compresión de imagen con Canvas API (sin dependencias externas) ────────────
// Redimensiona y comprime la imagen antes de subirla al servidor.
// Máx 1200px en el lado más largo, calidad JPEG 0.82 — balance calidad/peso.
const compressImage = (file, maxPx = 1200, quality = 0.82) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) =>
            resolve(
              new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
                type: "image/jpeg",
              }),
            ),
          "image/jpeg",
          quality,
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

const MAX_PHOTOS = 10;

// Inyectar keyframe para el spinner de carga
let sidebarSpinInjected = false;
const injectSidebarStyles = () => {
  if (sidebarSpinInjected) return;
  sidebarSpinInjected = true;
  const s = document.createElement("style");
  s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(s);
};
injectSidebarStyles();

const Sidebar = ({
  selectedNode,
  onNodeUpdate,
  onClose,
  currentNodeId,
  allNodes = [],
  onRefreshMap,
  isEditing, // controlado desde App.jsx para sobrevivir re-renders
  setIsEditing,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    ip: "",
    mac: "",
    description: "",
    parentId: "",
    romonEnabled: false,
    neighborDiscovery: false,
    interfacesAll: false,
  });
  const [availableParents, setAvailableParents] = useState([]);
  const [saving, setSaving] = useState(false);

  // ── Galería de fotos ───────────────────────────────────────────────────────
  const [photos, setPhotos] = useState([]); // [{id, url, label}]
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editingLabel, setEditingLabel] = useState(null); // id de foto en edición
  const [labelDraft, setLabelDraft] = useState("");
  const photoInputRef = useRef(null);

  useEffect(() => {
    if (selectedNode) {
      // isEditing se resetea desde App.jsx al cambiar de nodo (onNodeClick),
      // así que aquí solo sincronizamos el formulario con los datos del nodo.
      setFormData({
        name: selectedNode.name || "",
        ip: selectedNode.ip || "",
        mac: selectedNode.mac || "",
        description: selectedNode.description || "",
        parentId: selectedNode.parentId || "",
        romonEnabled: selectedNode.romonEnabled ?? false,
        neighborDiscovery: selectedNode.neighborDiscovery ?? false,
        interfacesAll: selectedNode.interfacesAll ?? false,
      });
      // Cargar fotos del nodo
      loadPhotos(selectedNode.id);
    }
    loadAvailableParents();
  }, [selectedNode?.id]); // solo cuando cambia el ID, no en cada re-render

  // ── Cargar fotos desde el backend ─────────────────────────────────────────
  const loadPhotos = useCallback(async (nodeId) => {
    if (!nodeId) return;
    try {
      const res = await imagesApi.getByNode(nodeId);
      setPhotos(
        (res.data ?? []).map((img) => ({
          id: img.id,
          url: img.url,
          label: img.label ?? "",
          order: img.order ?? 0,
        })),
      );
    } catch {
      setPhotos([]);
    }
  }, []);

  // ── Subir nueva foto (comprimida) ─────────────────────────────────────────
  const handlePhotoAdd = useCallback(
    async (e) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length || !selectedNode?.id) return;
      if (photos.length + files.length > MAX_PHOTOS) {
        showErrorAlert(`Máximo ${MAX_PHOTOS} fotos por equipo`);
        return;
      }

      setUploadingPhoto(true);
      try {
        for (const file of files) {
          if (!file.type.startsWith("image/")) continue;
          // Comprimir antes de subir
          const compressed = await compressImage(file);
          // imagesApi.upload → POST /uploads/node/:nodeId
          // campo "image" en FormData, label vacío por defecto
          const res = await imagesApi.upload(selectedNode.id, compressed, "");
          const img = res.data;
          setPhotos((prev) => [
            ...prev,
            {
              id: img.id,
              url: img.url,
              label: img.label ?? "",
              order: img.order ?? prev.length,
            },
          ]);
        }
        showSuccessAlert("Foto(s) agregada(s) correctamente");
      } catch (err) {
        console.error("Upload error:", err);
        showErrorAlert("Error al subir la foto");
      } finally {
        setUploadingPhoto(false);
        if (photoInputRef.current) photoInputRef.current.value = "";
      }
    },
    [photos.length, selectedNode?.id],
  );

  // ── Eliminar foto ─────────────────────────────────────────────────────────
  const handlePhotoDelete = useCallback(async (photoId) => {
    const confirmed = await Swal.fire({
      title: "¿Eliminar foto?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirmed.isConfirmed) return;
    try {
      // DELETE /uploads/image/:imageId — no necesita nodeId
      await imagesApi.delete(photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      showSuccessAlert("Foto eliminada");
    } catch {
      showErrorAlert("Error al eliminar la foto");
    }
  }, []);

  // ── Guardar label de foto ─────────────────────────────────────────────────
  const handleLabelSave = useCallback(
    async (photoId) => {
      try {
        // PATCH /uploads/image/:imageId/label
        await imagesApi.updateLabel(photoId, labelDraft);
        setPhotos((prev) =>
          prev.map((p) => (p.id === photoId ? { ...p, label: labelDraft } : p)),
        );
      } catch {
        showErrorAlert("Error al guardar el label");
      } finally {
        setEditingLabel(null);
      }
    },
    [labelDraft],
  );

  const loadAvailableParents = () => {
    if (currentNodeId && allNodes.length > 0) {
      const parents = allNodes.filter((node) => node.id !== currentNodeId);
      setAvailableParents(parents);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const showSuccessAlert = (message) => {
    Swal.fire({
      icon: "success",
      title: "¡Éxito!",
      text: message,
      timer: 2000,
      showConfirmButton: false,
      position: "top-end",
      toast: true,
    });
  };

  const showErrorAlert = (message) => {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: message,
      confirmButtonColor: "#3b82f6",
    });
  };

  const showConfirmAlert = async (title, text, confirmText) => {
    const result = await Swal.fire({
      title: title,
      text: text,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: confirmText,
      cancelButtonText: "Cancelar",
    });
    return result.isConfirmed;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedNode?.id) return;

    // Solo enviamos los campos que UpdateNodeDto acepta en el backend.
    // parentId, clientId, posX/Y tienen sus propios endpoints separados.
    // Strings vacíos → undefined para no romper @IsIP/@IsString en NestJS.
    const payload = {
      name: formData.name || undefined,
      ip: formData.ip || undefined,
      mac: formData.mac || undefined,
      description: formData.description || undefined,
      romonEnabled: formData.romonEnabled,
      neighborDiscovery: formData.neighborDiscovery,
      interfacesAll: formData.interfacesAll,
    };

    setSaving(true);
    try {
      await nodesApi.updateNode(selectedNode.id, payload);
      onNodeUpdate(formData);
      setIsEditing(false);
      showSuccessAlert("Nodo actualizado exitosamente");
      if (onRefreshMap) onRefreshMap();
    } catch (error) {
      showErrorAlert("Error al actualizar el nodo");
    } finally {
      setSaving(false);
    }
  };

  const handleConnectToParent = async (parentId) => {
    if (!selectedNode?.id || !parentId) return;

    const parentNode = availableParents.find((p) => p.id === parentId);
    const parentName =
      parentNode?.data?.name || parentNode?.name || "Nodo desconocido";

    const confirmed = await Swal.fire({
      title: "¿Conectar nodos?",
      html: `
        <div class="text-left">
          <p>Estás a punto de conectar:</p>
          <div class="bg-blue-50 p-3 rounded-lg my-3">
            <p class="font-semibold">📡 ${selectedNode.name}</p>
            <p class="text-sm text-gray-600">Será hijo de:</p>
            <p class="font-semibold mt-2">🔗 ${parentName}</p>
          </div>
          <p class="text-sm text-gray-500 mt-2">Esto establecerá una relación jerárquica entre los equipos.</p>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3b82f6",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sí, conectar",
      cancelButtonText: "Cancelar",
    });

    if (confirmed.isConfirmed) {
      setSaving(true);
      try {
        await nodesApi.updateParent(selectedNode.id, parentId);
        // FIX #3: Actualizar formData con el nuevo parentId para que el
        // panel de jerarquía y el select reflejen el cambio inmediatamente
        const newFormData = { ...formData, parentId };
        setFormData(newFormData);
        onNodeUpdate(newFormData);
        showSuccessAlert("Nodos conectados exitosamente");
        if (onRefreshMap) onRefreshMap();
      } catch (error) {
        showErrorAlert("Error al conectar los nodos");
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDisconnectParent = async () => {
    const confirmed = await showConfirmAlert(
      "¿Desconectar nodo?",
      `El nodo "${selectedNode.name}" dejará de depender de su nodo padre.`,
      "Sí, desconectar",
    );

    if (confirmed) {
      setSaving(true);
      try {
        await nodesApi.updateParent(selectedNode.id, null);
        // FIX #4: Actualizar formData localmente para que el panel de
        // jerarquía desaparezca sin esperar a que onRefreshMap recargue todo
        const newFormData = { ...formData, parentId: "" };
        setFormData(newFormData);
        onNodeUpdate(newFormData);
        showSuccessAlert("Nodo desconectado exitosamente");
        if (onRefreshMap) onRefreshMap();
      } catch (error) {
        showErrorAlert("Error al desconectar el nodo");
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDeleteNode = async () => {
    const confirmed = await showConfirmAlert(
      "¿Eliminar nodo?",
      `El nodo "${selectedNode.name}" será eliminado permanentemente. Esta acción no se puede deshacer.`,
      "Sí, eliminar",
    );

    if (confirmed) {
      try {
        await nodesApi.deleteNode(selectedNode.id);
        showSuccessAlert("Nodo eliminado exitosamente");
        onClose();
        if (onRefreshMap) onRefreshMap();
      } catch (error) {
        showErrorAlert("Error al eliminar el nodo");
      }
    }
  };

  // FIX #5: getParentName ahora lee de formData (fuente de verdad local),
  // no de selectedNode.parentId (prop estático que no se actualiza al vuelo)
  const getParentName = () => {
    if (!formData.parentId) return null;
    const parent = allNodes.find((node) => node.id === formData.parentId);
    return parent?.data?.name || parent?.name || formData.parentId;
  };

  if (!selectedNode) {
    return (
      <div className="w-96 h-screen bg-white shadow-2xl flex flex-col animate-slide-in">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Panel de Control</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <p className="text-gray-500">
              Selecciona un nodo para ver sus detalles
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 h-screen bg-white shadow-2xl flex flex-col animate-slide-in">
      <div className="p-6 border-b border-gray-200 flex justify-between items-start">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">
            {selectedNode.id ? "Detalle del Nodo" : "Nuevo Nodo"}
          </h2>
          <p className="text-xs text-gray-500 mt-1 font-mono">
            ID: {selectedNode.id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedNode.id && (
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              title={isEditing ? "Cancelar edición" : "Activar edición"}
              className={`p-1.5 rounded-lg text-sm transition-colors ${
                isEditing
                  ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              ✏️
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Panel de Jerarquía — FIX #5: lee formData.parentId en vez de selectedNode.parentId */}
      {(formData.parentId || selectedNode.childrenCount > 0) && (
        <div className="mx-6 mt-4 p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
            <span>🔗</span> Jerarquía de Red
          </h4>
          {formData.parentId && (
            <div className="flex items-center justify-between text-xs mb-2 p-2 bg-white rounded">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">↑ Padre:</span>
                <span className="text-blue-600 font-medium">
                  {getParentName() || formData.parentId}
                </span>
              </div>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDisconnectParent}
                  disabled={saving}
                  className="text-red-500 hover:text-red-700 text-xs disabled:opacity-50"
                >
                  Desconectar
                </button>
              )}
            </div>
          )}
          {selectedNode.childrenCount > 0 && (
            <div className="flex items-center gap-2 text-xs p-2 bg-white rounded">
              <span className="text-gray-500">↓ Hijos:</span>
              <span className="text-green-600 font-medium">
                {selectedNode.childrenCount} nodo(s)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Estado del nodo */}
      <div className="mx-6 mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Estado:</span>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${selectedNode.status === "online" ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
            ></div>
            <span
              className={`text-sm font-semibold ${selectedNode.status === "online" ? "text-green-600" : "text-red-600"}`}
            >
              {selectedNode.status === "online"
                ? "🟢 En línea"
                : "🔴 Fuera de línea"}
            </span>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto p-6 space-y-5"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre del Equipo *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dirección IP *
          </label>
          <input
            type="text"
            name="ip"
            value={formData.ip}
            onChange={handleChange}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 font-mono"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            MAC Address
          </label>
          <input
            type="text"
            name="mac"
            value={formData.mac || ""}
            onChange={handleChange}
            disabled={!isEditing}
            placeholder="XX:XX:XX:XX:XX:XX"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripción
          </label>
          <textarea
            name="description"
            value={formData.description || ""}
            onChange={handleChange}
            disabled={!isEditing}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
          />
        </div>

        {/* Selector de nodo padre */}
        {availableParents.length > 0 && isEditing && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🔗 Conectar a nodo padre
            </label>
            <select
              value={formData.parentId || ""}
              onChange={(e) => {
                if (e.target.value) {
                  handleConnectToParent(e.target.value);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Seleccionar nodo padre --</option>
              {availableParents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.data?.name || parent.name} (
                  {parent.data?.ip || parent.ip})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Este equipo dependerá jerárquicamente del nodo seleccionado
            </p>
          </div>
        )}

        {/* ── Galería de fotos del equipo ── */}
        {selectedNode?.id && (
          <div>
            {/* Header de la sección */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 15 }}>📷</span>
                <span
                  style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}
                >
                  Fotos del equipo
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background:
                      photos.length >= MAX_PHOTOS ? "#fee2e2" : "#eff6ff",
                    color: photos.length >= MAX_PHOTOS ? "#dc2626" : "#2563eb",
                    border: `1px solid ${photos.length >= MAX_PHOTOS ? "#fca5a5" : "#bfdbfe"}`,
                    borderRadius: 20,
                    padding: "1px 8px",
                  }}
                >
                  {photos.length}/{MAX_PHOTOS}
                </span>
              </div>

              {/* Botón + Agregar */}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    background: uploadingPhoto ? "#93c5fd" : "#3b82f6",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: uploadingPhoto ? "not-allowed" : "pointer",
                    transition: "background 0.15s",
                    boxShadow: "0 2px 8px rgba(59,130,246,0.3)",
                  }}
                >
                  {uploadingPhoto ? (
                    <>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          border: "2px solid #fff",
                          borderTopColor: "transparent",
                          borderRadius: "50%",
                          display: "inline-block",
                          animation: "spin 0.7s linear infinite",
                        }}
                      />
                      Subiendo…
                    </>
                  ) : (
                    <>＋ Agregar</>
                  )}
                </button>
              )}

              {/* Input oculto — acepta múltiples */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={handlePhotoAdd}
              />
            </div>

            {/* Grid de fotos */}
            {photos.length === 0 ? (
              <div
                onClick={() => photoInputRef.current?.click()}
                style={{
                  border: "2px dashed #e2e8f0",
                  borderRadius: 10,
                  padding: "24px 0",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                  color: "#94a3b8",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "#3b82f6")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "#e2e8f0")
                }
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  Sin fotos aún
                </div>
                <div style={{ fontSize: 11, marginTop: 3 }}>
                  Clic para agregar fotos del equipo
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {photos.map((photo) => (
                  <div key={photo.id} style={{ position: "relative" }}>
                    {/* Imagen */}
                    <div
                      style={{
                        position: "relative",
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                        aspectRatio: "4/3",
                        background: "#f8fafc",
                      }}
                    >
                      <img
                        src={
                          photo.url.startsWith("http")
                            ? photo.url
                            : `${config.apiUrl}${photo.url}`
                        }
                        alt={photo.label || "Foto del equipo"}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                      {/* Fallback si la imagen falla */}
                      <div
                        style={{
                          display: "none",
                          position: "absolute",
                          inset: 0,
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#f1f5f9",
                          color: "#94a3b8",
                          fontSize: 11,
                        }}
                      >
                        Sin imagen
                      </div>

                      {/* Botón eliminar */}
                      <button
                        type="button"
                        onClick={() => handlePhotoDelete(photo.id)}
                        title="Eliminar foto"
                        style={{
                          position: "absolute",
                          top: 5,
                          right: 5,
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "rgba(239,68,68,0.9)",
                          color: "#fff",
                          border: "1.5px solid #fff",
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          fontWeight: 900,
                          lineHeight: 1,
                          boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                          transition: "transform 0.1s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.transform = "scale(1.15)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.transform = "scale(1)")
                        }
                      >
                        ×
                      </button>
                    </div>

                    {/* Label editable */}
                    {editingLabel === photo.id ? (
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        <input
                          autoFocus
                          value={labelDraft}
                          onChange={(e) => setLabelDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleLabelSave(photo.id);
                            if (e.key === "Escape") setEditingLabel(null);
                          }}
                          placeholder="Descripción…"
                          style={{
                            flex: 1,
                            fontSize: 10,
                            padding: "3px 6px",
                            border: "1.5px solid #3b82f6",
                            borderRadius: 5,
                            outline: "none",
                            minWidth: 0,
                            fontFamily: "system-ui,sans-serif",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleLabelSave(photo.id)}
                          style={{
                            background: "#3b82f6",
                            color: "#fff",
                            border: "none",
                            borderRadius: 5,
                            padding: "3px 7px",
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingLabel(null)}
                          style={{
                            background: "#f1f5f9",
                            color: "#64748b",
                            border: "none",
                            borderRadius: 5,
                            padding: "3px 6px",
                            fontSize: 10,
                            cursor: "pointer",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          setEditingLabel(photo.id);
                          setLabelDraft(photo.label ?? "");
                        }}
                        title="Clic para editar descripción"
                        style={{
                          marginTop: 4,
                          fontSize: 10,
                          color: photo.label ? "#1e293b" : "#94a3b8",
                          fontWeight: photo.label ? 600 : 400,
                          textAlign: "center",
                          cursor: "text",
                          padding: "2px 4px",
                          borderRadius: 4,
                          border: "1px solid transparent",
                          transition: "border-color 0.12s",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.borderColor = "#e2e8f0")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.borderColor = "transparent")
                        }
                      >
                        {photo.label || "＋ Agregar descripción"}
                      </div>
                    )}
                  </div>
                ))}

                {/* Celda "agregar" al final del grid si hay espacio */}
                {photos.length < MAX_PHOTOS && (
                  <div
                    onClick={() => photoInputRef.current?.click()}
                    style={{
                      border: "2px dashed #e2e8f0",
                      borderRadius: 8,
                      aspectRatio: "4/3",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "#94a3b8",
                      transition: "all 0.15s",
                      fontSize: 11,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#3b82f6";
                      e.currentTarget.style.color = "#3b82f6";
                      e.currentTarget.style.background = "#eff6ff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.color = "#94a3b8";
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span style={{ fontSize: 20, marginBottom: 4 }}>＋</span>
                    <span style={{ fontWeight: 600 }}>Agregar foto</span>
                  </div>
                )}
              </div>
            )}

            {/* Nota de compresión */}
            <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>
              Las imágenes se comprimen automáticamente antes de subirse.
            </p>
          </div>
        )}

        {/* ── Protocolos de visibilidad MikroTik ── */}
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            padding: "12px 14px",
          }}
        >
          {/* Título sección */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: "#185FA5",
              }}
            />
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#1e293b",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                margin: 0,
              }}
            >
              Visibilidad MikroTik
            </p>
          </div>
          <p style={{ fontSize: 10, color: "#94a3b8", margin: "0 0 12px" }}>
            Indica si estos protocolos están habilitados en el equipo físico
            (solo documentación).
          </p>

          {/* ── RoMON ── */}
          <div
            onClick={() => {
              if (isEditing)
                setFormData((p) => ({ ...p, romonEnabled: !p.romonEnabled }));
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              background: "#fff",
              borderRadius: 8,
              marginBottom: 8,
              border: `1.5px solid ${formData.romonEnabled ? "#185FA5" : "#e2e8f0"}`,
              cursor: isEditing ? "pointer" : "default",
              transition: "border-color 0.15s",
              userSelect: "none",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: "1px 6px",
                    borderRadius: 4,
                    letterSpacing: "0.04em",
                    background: formData.romonEnabled ? "#185FA5" : "#f1f5f9",
                    color: formData.romonEnabled ? "#fff" : "#94a3b8",
                  }}
                >
                  RoMON
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: formData.romonEnabled ? "#0c447c" : "#374151",
                  }}
                >
                  Router Management Overlay Network
                </span>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#94a3b8",
                  marginTop: 3,
                  lineHeight: 1.4,
                }}
              >
                Permite administrar este equipo saltando por otros MikroTik
                aunque no haya IP directa. Visible desde Winbox vía RoMON.
              </div>
            </div>
            <div
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                marginLeft: 10,
                background: formData.romonEnabled ? "#185FA5" : "#d1d5db",
                position: "relative",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#fff",
                  position: "absolute",
                  top: 3,
                  transition: "left 0.2s",
                  left: formData.romonEnabled ? 18 : 3,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </div>
          </div>

          {/* ── Neighbor Discovery (MNDP) ── */}
          <div
            onClick={() => {
              if (isEditing)
                setFormData((p) => ({
                  ...p,
                  neighborDiscovery: !p.neighborDiscovery,
                }));
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              background: "#fff",
              borderRadius: 8,
              marginBottom: 8,
              border: `1.5px solid ${formData.neighborDiscovery ? "#0f6e56" : "#e2e8f0"}`,
              cursor: isEditing ? "pointer" : "default",
              transition: "border-color 0.15s",
              userSelect: "none",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: "1px 6px",
                    borderRadius: 4,
                    letterSpacing: "0.04em",
                    background: formData.neighborDiscovery
                      ? "#0f6e56"
                      : "#f1f5f9",
                    color: formData.neighborDiscovery ? "#fff" : "#94a3b8",
                  }}
                >
                  MNDP
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: formData.neighborDiscovery ? "#085041" : "#374151",
                  }}
                >
                  Neighbor Discovery — All
                </span>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#94a3b8",
                  marginTop: 3,
                  lineHeight: 1.4,
                }}
              >
                El equipo anuncia su presencia a todos los vecinos MikroTik.
                Aparece en la lista Neighbors de Winbox en toda la red local.
              </div>
            </div>
            <div
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                marginLeft: 10,
                background: formData.neighborDiscovery ? "#1D9E75" : "#d1d5db",
                position: "relative",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#fff",
                  position: "absolute",
                  top: 3,
                  transition: "left 0.2s",
                  left: formData.neighborDiscovery ? 18 : 3,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </div>
          </div>

          {/* ── Interfaces All (MNDP + Bandwidth-server + otros) ── */}
          <div
            onClick={() => {
              if (isEditing)
                setFormData((p) => ({ ...p, interfacesAll: !p.interfacesAll }));
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              background: "#fff",
              borderRadius: 8,
              border: `1.5px solid ${formData.interfacesAll ? "#854F0B" : "#e2e8f0"}`,
              cursor: isEditing ? "pointer" : "default",
              transition: "border-color 0.15s",
              userSelect: "none",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: "1px 6px",
                    borderRadius: 4,
                    letterSpacing: "0.04em",
                    background: formData.interfacesAll ? "#854F0B" : "#f1f5f9",
                    color: formData.interfacesAll ? "#fff" : "#94a3b8",
                  }}
                >
                  IFACE ALL
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: formData.interfacesAll ? "#633806" : "#374151",
                  }}
                >
                  Interfaces en All
                </span>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#94a3b8",
                  marginTop: 3,
                  lineHeight: 1.4,
                }}
              >
                Los servicios del equipo (SSH, Winbox, API, etc.) responden en
                todas sus interfaces, no solo en una específica.
              </div>
            </div>
            <div
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                marginLeft: 10,
                background: formData.interfacesAll ? "#BA7517" : "#d1d5db",
                position: "relative",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#fff",
                  position: "absolute",
                  top: 3,
                  transition: "left 0.2s",
                  left: formData.interfacesAll ? 18 : 3,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </div>
          </div>

          {/* Resumen de estado */}
          {(formData.romonEnabled ||
            formData.neighborDiscovery ||
            formData.interfacesAll) && (
            <div
              style={{
                marginTop: 8,
                padding: "8px 10px",
                background: "#f0f9ff",
                borderRadius: 8,
                fontSize: 10,
                color: "#0c447c",
                lineHeight: 1.5,
                border: "0.5px solid #bfdbfe",
              }}
            >
              <strong>Estado actual:</strong>{" "}
              {[
                formData.romonEnabled && "RoMON activo (visible vía overlay)",
                formData.neighborDiscovery &&
                  "MNDP activo (aparece en Neighbors)",
                formData.interfacesAll && "Interfaces All (responde en todas)",
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>

        {/* Botones de acción */}
        {selectedNode?.id && !isEditing ? (
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              ✏️ Editar
            </button>
            <button
              type="button"
              onClick={handleDeleteNode}
              className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              🗑️ Eliminar
            </button>
          </div>
        ) : (
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              {saving ? "Guardando..." : "💾 Guardar Cambios"}
            </button>
            {selectedNode?.id && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    name: selectedNode.name || "",
                    ip: selectedNode.ip || "",
                    mac: selectedNode.mac || "",
                    description: selectedNode.description || "",
                    parentId: selectedNode.parentId || "",
                    romonEnabled: selectedNode.romonEnabled ?? false,
                    neighborDiscovery: selectedNode.neighborDiscovery ?? false,
                    interfacesAll: selectedNode.interfacesAll ?? false,
                  });
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                ✖ Cancelar
              </button>
            )}
          </div>
        )}

        {/* Información adicional */}
        {selectedNode?.id && (
          <div className="text-xs text-gray-400 border-t pt-4 mt-4 space-y-1">
            <p>
              📅 Creado: {new Date(selectedNode.createdAt).toLocaleString()}
            </p>
            <p>
              🔄 Actualizado:{" "}
              {new Date(selectedNode.updatedAt).toLocaleString()}
            </p>
            {selectedNode.childrenCount > 0 && (
              <p>👥 Tiene {selectedNode.childrenCount} nodo(s) hijo(s)</p>
            )}
          </div>
        )}
      </form>
    </div>
  );
};

export default Sidebar;
