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

async function upload(path, file) {
  const body = new FormData();
  body.append("file", file);
  return request(path, { method: "POST", body });
}

export const api = {
  listEpisodes: () => request("/episodes"),
  getConfig: () => request("/config"),
  chat: (payload) => request("/assistant/chat", { method: "POST", body: JSON.stringify(payload) }),
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
  splitShot: (id, payload) => request(`/shots/${id}/split`, { method: "POST", body: JSON.stringify(payload) }),
  getShotProduction: (shotId) => request(`/shots/${shotId}/production`),
  assistPrompt: (shotId, payload) =>
    request(`/shots/${shotId}/prompt-assist`, { method: "POST", body: JSON.stringify(payload) }),
  generateImage: (shotId, payload) =>
    request(`/shots/${shotId}/images/generate`, { method: "POST", body: JSON.stringify(payload) }),
  approveImage: (imageId) => request(`/images/${imageId}/approve`, { method: "POST" }),
  saveImageToLibrary: (imageId, payload) =>
    request(`/images/${imageId}/save-to-library`, { method: "POST", body: JSON.stringify(payload) }),
  generateVideo: (shotId, payload) =>
    request(`/shots/${shotId}/videos/generate`, { method: "POST", body: JSON.stringify(payload) }),
  approveVideo: (videoId) => request(`/videos/${videoId}/approve`, { method: "POST" }),
  getEpisodeAudio: (episodeId) => request(`/episodes/${episodeId}/audio`),
  updateAudioLine: (id, payload) => request(`/audio-lines/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  uploadAudioLine: (id, file) => upload(`/audio-lines/${id}/upload`, file),
  padAudioLine: (id) => request(`/audio-lines/${id}/pad`, { method: "POST" }),
  createMusicTrack: (episodeId, payload) =>
    request(`/episodes/${episodeId}/music-tracks`, { method: "POST", body: JSON.stringify(payload) }),
  updateMusicTrack: (id, payload) => request(`/music-tracks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  uploadMusicTrack: (id, file) => upload(`/music-tracks/${id}/upload`, file),
  deleteMusicTrack: (id) => request(`/music-tracks/${id}`, { method: "DELETE" }),
  getAssembly: (episodeId) => request(`/episodes/${episodeId}/assembly`),
  exportAssembly: (episodeId) => request(`/episodes/${episodeId}/assembly/export`, { method: "POST" }),
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
    return upload("/uploads/library", file);
  },
};

export { API_BASE };
