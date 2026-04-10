import React, { useState, useCallback } from "react";
import { useReactFlow } from "reactflow";

// ── Estilos inyectados una vez ─────────────────────────────────────────────
let stylesInjected = false;
const injectStyles = () => {
  if (stylesInjected) return;
  stylesInjected = true;
  const s = document.createElement("style");
  s.textContent = `
    @keyframes mc-spin { to { transform: rotate(360deg); } }

    .mc-btn {
      width: 36px;
      height: 36px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      color: #475569;
      transition: background 0.12s, border-color 0.12s, color 0.12s, transform 0.1s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.07);
      user-select: none;
      outline: none;
      position: relative;
    }
    .mc-btn:hover:not(:disabled) {
      background: #f8fafc;
      border-color: #cbd5e1;
      color: #1e293b;
    }
    .mc-btn:active:not(:disabled) {
      transform: scale(0.93);
    }
    .mc-btn:disabled {
      cursor: default;
      opacity: 0.5;
    }
    .mc-btn.mc-edit-on {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #2563eb;
    }
    .mc-btn.mc-export-loading {
      background: #f0fdf4;
      border-color: #86efac;
      color: #16a34a;
      cursor: wait;
    }
    .mc-btn.mc-export:hover:not(:disabled) {
      background: #f0fdf4;
      border-color: #22c55e;
      color: #16a34a;
    }
    .mc-btn.mc-svg:hover:not(:disabled) {
      background: #fdf4ff;
      border-color: #c084fc;
      color: #9333ea;
    }
    .mc-divider {
      height: 1px;
      background: #e2e8f0;
      margin: 2px 0;
    }
    .mc-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #22c55e;
      border-top-color: transparent;
      border-radius: 50%;
      animation: mc-spin 0.7s linear infinite;
    }
    /* Tooltip */
    .mc-btn::after {
      content: attr(data-tooltip);
      position: absolute;
      right: calc(100% + 8px);
      top: 50%;
      transform: translateY(-50%);
      background: #1e293b;
      color: #f8fafc;
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
      padding: 4px 8px;
      border-radius: 6px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      z-index: 9999;
      font-family: system-ui, sans-serif;
    }
    .mc-btn:hover::after {
      opacity: 1;
    }
  `;
  document.head.appendChild(s);
};
injectStyles();

// ── Iconos SVG reutilizables ───────────────────────────────────────────────
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <line
      x1="7"
      y1="2"
      x2="7"
      y2="12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="2"
      y1="7"
      x2="12"
      y2="7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);
const IconMinus = () => (
  <svg width="14" height="2" viewBox="0 0 14 2" fill="none">
    <line
      x1="2"
      y1="1"
      x2="12"
      y2="1"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);
const IconFit = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect
      x="1"
      y="1"
      width="12"
      height="12"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
    <rect
      x="4.5"
      y="4.5"
      width="5"
      height="5"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
  </svg>
);
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M9.5 2.5L11.5 4.5L5 11H3V9L9.5 2.5Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);
const IconDownloadPng = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M7 1v8M4.5 6.5L7 9l2.5-2.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2 10v1.5A0.5 0.5 0 002.5 12h9a0.5 0.5 0 00.5-.5V10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <text
      x="2"
      y="13.5"
      style={{
        fontSize: "4px",
        fontWeight: 700,
        fill: "currentColor",
        fontFamily: "monospace",
      }}
    >
      PNG
    </text>
  </svg>
);
const IconDownloadSvg = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M7 1v7M4.5 5.5L7 8l2.5-2.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2 10v1.5A0.5 0.5 0 002.5 12h9a0.5 0.5 0 00.5-.5V10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <text
      x="1.5"
      y="13.5"
      style={{
        fontSize: "3.8px",
        fontWeight: 700,
        fill: "currentColor",
        fontFamily: "monospace",
      }}
    >
      SVG
    </text>
  </svg>
);
const Spinner = () => <span className="mc-spinner" />;

// ── Componente ─────────────────────────────────────────────────────────────
const MapControls = ({
  onToggleEdit,
  isEditMode,
  onExportImage,
  onExportSvg,
}) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [exportingPng, setExportingPng] = useState(false);
  const [exportingSvg, setExportingSvg] = useState(false);

  const handleExportPng = useCallback(async () => {
    if (exportingPng || !onExportImage) return;
    setExportingPng(true);
    try {
      await onExportImage();
    } finally {
      setExportingPng(false);
    }
  }, [exportingPng, onExportImage]);

  const handleExportSvg = useCallback(async () => {
    if (exportingSvg || !onExportSvg) return;
    setExportingSvg(true);
    try {
      await onExportSvg();
    } finally {
      setExportingSvg(false);
    }
  }, [exportingSvg, onExportSvg]);

  return (
    <div
      data-id="map-controls"
      style={{
        position: "absolute",
        bottom: 20,
        right: 16,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        zIndex: 10,
      }}
    >
      <button
        className="mc-btn"
        onClick={() => zoomIn({ duration: 200 })}
        data-tooltip="Acercar"
        aria-label="Acercar"
      >
        <IconPlus />
      </button>

      <button
        className="mc-btn"
        onClick={() => zoomOut({ duration: 200 })}
        data-tooltip="Alejar"
        aria-label="Alejar"
      >
        <IconMinus />
      </button>

      <button
        className="mc-btn"
        onClick={() => fitView({ padding: 0.12, duration: 350 })}
        data-tooltip="Centrar mapa"
        aria-label="Centrar mapa"
      >
        <IconFit />
      </button>

      <div className="mc-divider" />

      <button
        className={`mc-btn${isEditMode ? " mc-edit-on" : ""}`}
        onClick={onToggleEdit}
        data-tooltip={isEditMode ? "Desactivar edición" : "Activar edición"}
        aria-label={isEditMode ? "Desactivar edición" : "Activar edición"}
      >
        <IconEdit />
      </button>

      <div className="mc-divider" />

      {/* Exportar PNG */}
      <button
        className={`mc-btn mc-export${exportingPng ? " mc-export-loading" : ""}`}
        onClick={handleExportPng}
        disabled={exportingPng || exportingSvg}
        data-tooltip="Exportar PNG (alta calidad)"
        aria-label="Exportar mapa como PNG"
      >
        {exportingPng ? <Spinner /> : <IconDownloadPng />}
      </button>

      {/* Exportar SVG — solo si se pasa la función */}
      {onExportSvg && (
        <button
          className={`mc-btn mc-svg${exportingSvg ? " mc-export-loading" : ""}`}
          onClick={handleExportSvg}
          disabled={exportingPng || exportingSvg}
          data-tooltip="Exportar SVG (vectorial)"
          aria-label="Exportar mapa como SVG"
        >
          {exportingSvg ? <Spinner /> : <IconDownloadSvg />}
        </button>
      )}
    </div>
  );
};

export default MapControls;
