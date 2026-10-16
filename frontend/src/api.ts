import axios from "axios";

const rawUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3100";
const hostUrl = rawUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");

export const api = axios.create({
  baseURL: hostUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

// Tự động chuẩn hóa tiền tố /api cho mọi endpoint để không bao giờ bị lệch đường dẫn
api.interceptors.request.use((config) => {
  if (config.url && !config.url.startsWith("/api") && !config.url.startsWith("http")) {
    config.url = `/api${config.url.startsWith("/") ? "" : "/"}${config.url}`;
  }
  return config;
});

export function setAccessToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}