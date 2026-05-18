const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    headers: isFormData
      ? options.headers || {}
      : {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  listEpisodes: () => request("/episodes"),
  createEpisode: (payload) => request("/episodes", { method: "POST", body: JSON.stringify(payload) }),
  updateEpisode: (id, payload) => request(`/episodes/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteEpisode: (id) => request(`/episodes/${id}`, { method: "DELETE" }),
  generateShotBreakdown: (episodeId) => request(`/episodes/${episodeId}/shot-breakdown`, { method: "POST" }),
  listShots: (episodeId) => request(`/episodes/${episodeId}/shots`),
  beginProduction: (episodeId, shots) =>
    request(`/episodes/${episodeId}/shots/begin-production`, {
      method: "POST",
      body: JSON.stringify({ shots }),
    }),
  updateShot: (id, payload) => request(`/shots/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  getShotProduction: (shotId) => request(`/shots/${shotId}/production`),
  assistPrompt: (shotId, payload) =>
    request(`/shots/${shotId}/prompt-assist`, { method: "POST", body: JSON.stringify(payload) }),
  generateImage: (shotId, payload) =>
    request(`/shots/${shotId}/images/generate`, { method: "POST", body: JSON.stringify(payload) }),
  approveImage: (imageId) => request(`/images/${imageId}/approve`, { method: "POST" }),
  generateVideo: (shotId, payload) =>
    request(`/shots/${shotId}/videos/generate`, { method: "POST", body: JSON.stringify(payload) }),
  approveVideo: (videoId) => request(`/videos/${videoId}/approve`, { method: "POST" }),
  listLibrary: ({ q = "", entry_type = "" } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (entry_type) params.set("entry_type", entry_type);
    const suffix = params.toString() ? `?${params}` : "";
    return request(`/library${suffix}`);
  },
  createLibraryEntry: (payload) => request("/library", { method: "POST", body: JSON.stringify(payload) }),
  updateLibraryEntry: (id, payload) => request(`/library/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteLibraryEntry: (id) => request(`/library/${id}`, { method: "DELETE" }),
  uploadLibraryAsset: (file) => {
    const body = new FormData();
    body.append("file", file);
    return request("/uploads/library", { method: "POST", body });
  },
};

export { API_BASE };
