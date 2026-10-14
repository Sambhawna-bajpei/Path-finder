import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000", withCredentials: true, timeout: 25000 });

export async function analyzeResume(payload) {
  const { data } = await api.post("/api/workspace/analyze", payload);
  return data.result;
}
