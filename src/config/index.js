export const config = {
  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:3000",
  socketUrl: import.meta.env.VITE_SOCKET_URL || "http://localhost:3000",
  uploadUrl: import.meta.env.VITE_UPLOAD_URL || "http://localhost:3000/uploads",
};
