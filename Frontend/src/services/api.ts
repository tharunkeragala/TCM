import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "";

const API = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

API.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;
