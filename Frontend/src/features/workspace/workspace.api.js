import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000", withCredentials: true, timeout: 25000 });

export async function analyzeResume(payload) {
  const { data } = await api.post("/api/workspace/analyze", payload);
  return data.result;
}

export async function listApplications() {
  const { data } = await api.get("/api/workspace/applications");
  return data.applications;
}

export async function createApplication(payload) {
  const { data } = await api.post("/api/workspace/applications", payload);
  return data.application;
}

export async function getApplication(id) {
  const { data } = await api.get(`/api/workspace/applications/${id}`);
  return data.application;
}

export async function updateApplication(id, payload) {
  const { data } = await api.patch(`/api/workspace/applications/${id}`, payload);
  return data.application;
}

export async function deleteApplication(id) {
  await api.delete(`/api/workspace/applications/${id}`);
}

export async function createResumeVersion(id, payload) {
  const { data } = await api.post(`/api/workspace/applications/${id}/versions`, payload);
  return data.application;
}

export async function activateResumeVersion(id, versionId) {
  const { data } = await api.patch(`/api/workspace/applications/${id}/versions/${versionId}/activate`);
  return data.application;
}
