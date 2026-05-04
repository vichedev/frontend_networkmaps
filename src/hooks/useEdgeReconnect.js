// ─────────────────────────────────────────────────────────────────────────────
// Handlers de reconexión de edges para React Flow
//
// CÓMO USARLO — en el archivo donde tengas <ReactFlow ...>:
//
//   import { useEdgeReconnect } from "./hooks/useEdgeReconnect";
//   import { connectionsApi } from "../services/api";
//
//   function Map() {
//     const { edges, setEdges, nodes } = useNetworkMap();  // o como se llame
//
//     const {
//       onReconnectStart,
//       onReconnect,
//       onReconnectEnd,
//       edgeReconnectSuccessful,
//     } = useEdgeReconnect({ setEdges, nodes });
//
//     return (
//       <ReactFlow
//         nodes={nodes}
//         edges={edges}
//         edgesReconnectable={true}          // habilita el drag del extremo
//         onReconnectStart={onReconnectStart}
//         onReconnect={onReconnect}
//         onReconnectEnd={onReconnectEnd}
//         ...
//       />
//     );
//   }
//
// React Flow 11/12 expone `onReconnect*`. Si estás en una versión antigua que
// usa `onEdgeUpdate*`, los nombres son distintos pero la lógica es idéntica:
//
//   v11/12: onReconnectStart / onReconnect / onReconnectEnd + edgesReconnectable
//   v10:    onEdgeUpdateStart / onEdgeUpdate / onEdgeUpdateEnd + edgesUpdatable
//
// Si tu reactflow es antiguo, renombra las 3 funciones antes de exportar.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useRef } from "react";
import { reconnectEdge } from "reactflow";
import { connectionsApi } from "../services/api";
import {
  findPortByHandleId,
  PORT_TYPE_TO_LINK_TYPE,
  PORT_TYPE_TO_BANDWIDTH,
} from "../config/routerModels";

export const useEdgeReconnect = ({ setEdges, nodes }) => {
  // Ref para saber si el drop fue exitoso (soltó sobre un handle válido).
  // Si al final del drag NO fue exitoso, borramos el edge (el usuario lo
  // arrastró al vacío → interpretamos que quiere desconectar).
  const edgeReconnectSuccessful = useRef(true);

  // onReconnectStart: el usuario empezó a arrastrar un extremo del edge.
  // Marcamos como "no exitoso" hasta que onReconnect confirme el drop.
  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  // onReconnect: el usuario soltó sobre un handle válido.
  // Actualizamos el edge localmente + llamamos al backend.
  const onReconnect = useCallback(
    async (oldEdge, newConnection) => {
      edgeReconnectSuccessful.current = true;

      // Resolver los puertos nuevos para auto-inferir interfaz/tipo/velocidad.
      const sourceNode = nodes.find((n) => n.id === newConnection.source);
      const targetNode = nodes.find((n) => n.id === newConnection.target);
      const sourcePort = sourceNode
        ? findPortByHandleId(sourceNode.data?.model, newConnection.sourceHandle)
        : null;
      const targetPort = targetNode
        ? findPortByHandleId(targetNode.data?.model, newConnection.targetHandle)
        : null;

      // Nueva interfaz por defecto: nombre real del puerto del catálogo.
      // Solo sobreescribimos si el usuario no había personalizado el campo,
      // o si el extremo movido ES el que cambió de puerto.
      const sourceChanged =
        oldEdge.sourceHandle !== newConnection.sourceHandle ||
        oldEdge.source !== newConnection.source;
      const targetChanged =
        oldEdge.targetHandle !== newConnection.targetHandle ||
        oldEdge.target !== newConnection.target;

      const patch = {
        sourceHandle: newConnection.sourceHandle,
        targetHandle: newConnection.targetHandle,
      };

      if (sourceChanged && sourcePort) {
        patch.sourceInterface = sourcePort.name;
        // Si el tipo de cable cambió porque el puerto origen es de otro tipo,
        // auto-actualizamos linkType y bandwidth (salvo que el usuario los haya
        // fijado manualmente ANTES del mover — los respetamos en ese caso).
        if (!oldEdge.data?.linkTypeUserSet) {
          patch.linkType = PORT_TYPE_TO_LINK_TYPE[sourcePort.type] ?? null;
        }
        if (!oldEdge.data?.bandwidthUserSet) {
          patch.bandwidth = PORT_TYPE_TO_BANDWIDTH[sourcePort.type] ?? null;
        }
      }
      if (targetChanged && targetPort) {
        patch.targetInterface = targetPort.name;
      }

      // 1. Actualización local — reconnectEdge reemplaza source/target/handles.
      //    Luego encima aplicamos los campos derivados (interfaces, etc.).
      setEdges((eds) => {
        const reconnected = reconnectEdge(oldEdge, newConnection, eds);
        return reconnected.map((e) =>
          e.id === oldEdge.id ? { ...e, data: { ...e.data, ...patch } } : e,
        );
      });

      // 2. Actualización en backend — solo si el edge ya está persistido.
      const connectionId = oldEdge.data?.connectionId;
      if (connectionId) {
        try {
          await connectionsApi.update(connectionId, patch);
        } catch (err) {
          // Si el backend rechaza (ej. por el @@unique del schema: ya existe
          // una conexión idéntica entre esos mismos puertos), revertimos.
          console.error("Error reconectando edge — revirtiendo:", err);
          setEdges((eds) =>
            eds.map((e) => (e.id === oldEdge.id ? oldEdge : e)),
          );
        }
      }
    },
    [setEdges, nodes],
  );

  // onReconnectEnd: el drag terminó. Si no hubo drop exitoso, borramos el edge.
  // Esto es la convención de React Flow para "arrastré el extremo al vacío =
  // quiero eliminar la conexión". Si NO quieres este comportamiento, comenta
  // la eliminación y deja que el edge vuelva a su estado original.
  const onReconnectEnd = useCallback(
    async (_event, edge) => {
      if (!edgeReconnectSuccessful.current) {
        // Eliminar localmente
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
        // Eliminar en backend
        const connectionId = edge.data?.connectionId;
        if (connectionId) {
          try {
            await connectionsApi.delete(connectionId);
          } catch (err) {
            console.error("Error eliminando edge al soltarlo al vacío:", err);
          }
        }
      }
      edgeReconnectSuccessful.current = true;
    },
    [setEdges],
  );

  return {
    onReconnectStart,
    onReconnect,
    onReconnectEnd,
    edgeReconnectSuccessful,
  };
};
