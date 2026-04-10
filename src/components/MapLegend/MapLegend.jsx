import React, { useState } from "react";

const MapLegend = () => {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div className="absolute top-5 right-5 z-20">
      {!isMinimized ? (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 text-sm w-56">
          {/* Header con botón de minimizar */}
          <div className="flex justify-between items-center p-3 border-b border-gray-100">
            <h4 className="font-semibold text-gray-700 text-xs flex items-center gap-1">
              <span>📖</span> Leyenda de Jerarquía
            </h4>
            <button
              onClick={() => setIsMinimized(true)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Minimizar"
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
                  d="M5 15l7-7 7 7"
                />
              </svg>
            </button>
          </div>

          {/* Contenido de la leyenda */}
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-100 border-l-4 border-l-purple-500 rounded-full"></div>
              <span className="text-xs text-gray-600">
                👑 Nodo Raíz (Padre)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 border-l-4 border-l-blue-500 rounded-full"></div>
              <span className="text-xs text-gray-600">🔄 Nodo Intermedio</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border-r-4 border-r-green-500 rounded-full"></div>
              <span className="text-xs text-gray-600">🍃 Nodo Hoja (Hijo)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded-full"></div>
              <span className="text-xs text-gray-600">📍 Nodo Aislado</span>
            </div>
            <div className="border-t pt-2 mt-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-blue-500"></div>
                <span className="text-xs text-gray-600">Conexión activa</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                3
              </div>
              <span className="text-xs text-gray-600">Número de hijos</span>
            </div>
          </div>
        </div>
      ) : (
        /* Versión minimizada */
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-white rounded-lg shadow-lg border border-gray-200 p-2 hover:bg-gray-50 transition-colors"
          title="Mostrar leyenda"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default MapLegend;
