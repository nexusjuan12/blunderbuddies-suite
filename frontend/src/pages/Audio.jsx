import { Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { API_BASE, api } from "../api.js";

function assetUrl(path) {
  if (!path) return "";
  return path.startsWith("/") ? `${API_BASE}${path}` : path;
}

function seconds(ms) {
  return ms ? `${(ms / 1000).toFixed(2)}s` : "";
}

function Audio({ episode }) {
  const [audio, setAudio] = useState({ dialogue_shots: [], music_tracks: [] });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadAudio() {
    if (!episode) {
      setAudio({ dialogue_shots: [], music_tracks: [] });
      return;
    }
    setAudio(await api.getEpisodeAudio(episode.id));
  }

  useEffect(() => {
    loadAudio().catch((err) => setError(err.message));
  }, [episode?.id]);

  async function updateLine(line, patch) {
    await api.updateAudioLine(line.id, patch);
    await loadAudio();
  }

  async function uploadLine(line, file) {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      await api.uploadAudioLine(line.id, file);
      await loadAudio();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function padLine(line) {
    setLoading(true);
    setError("");
    try {
      await api.padAudioLine(line.id);
      await loadAudio();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addTrack() {
    if (!episode) return;
    await api.createMusicTrack(episode.id, { scene_reference: "", track_type: "music", file_path: "", notes: "" });
    await loadAudio();
  }

  async function uploadTrack(track, file) {
    if (!file) return;
    await api.uploadMusicTrack(track.id, file);
    await loadAudio();
  }

  if (!episode) {
    return <div className="empty-state">Create an episode to manage audio.</div>;
  }

  return (
    <section className="audio-page">
      <div className="panel">
        <div className="section-header">
          <div>
            <h1>Audio</h1>
            <p>Dialogue takes, silence padding, reusable music, SFX, and ambient tracks.</p>
          </div>
        </div>
        {error && <div className="error-banner inline-error">{error}</div>}
        <div className="audio-shot-list">
          {audio.dialogue_shots.length === 0 && <div className="empty-state">No dialogue shots yet. Mark shots as dialogue in Shot Breakdown.</div>}
          {audio.dialogue_shots.map(({ shot, lines }) => (
            <article className="audio-shot" key={shot.id}>
              <div className="entry-card-header">
                <div>
                  <span className="badge">Shot {shot.order_index}</span>
                  <h2>{shot.description}</h2>
                </div>
                <span className="badge">{shot.status}</span>
              </div>
              <div className="audio-lines">
                {lines.map((line) => (
                  <div className="audio-line" key={line.id}>
                    <div className="line-main">
                      <label>
                        Character
                        <input defaultValue={line.character_name} onBlur={(event) => updateLine(line, { character_name: event.target.value })} />
                      </label>
                      <label>
                        Line text
                        <textarea defaultValue={line.line_text} onBlur={(event) => updateLine(line, { line_text: event.target.value })} rows={3} />
                      </label>
                    </div>
                    <div className="line-controls">
                      {line.file_path && <audio src={assetUrl(line.file_path)} controls />}
                      {line.padded_file_path && <div className="notice">Padded total: {seconds(line.total_duration_ms)}</div>}
                      <label className="file-button">
                        <Upload size={16} />
                        Upload Take
                        <input type="file" accept="audio/*" onChange={(event) => uploadLine(line, event.target.files?.[0])} disabled={loading} />
                      </label>
                      <label>
                        Start silence ms
                        <input
                          type="number"
                          min="0"
                          defaultValue={line.silence_start_ms}
                          onBlur={(event) => updateLine(line, { silence_start_ms: Number(event.target.value) })}
                        />
                      </label>
                      <label>
                        End silence ms
                        <input
                          type="number"
                          min="0"
                          defaultValue={line.silence_end_ms}
                          onBlur={(event) => updateLine(line, { silence_end_ms: Number(event.target.value) })}
                        />
                      </label>
                      <button type="button" onClick={() => padLine(line)} disabled={loading || !line.file_path}>
                        Apply Padding
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>

      <aside className="panel">
        <div className="section-header">
          <div>
            <h2>Backing Tracks</h2>
            <p>Music, SFX, or ambient references for this episode.</p>
          </div>
          <button type="button" onClick={addTrack}>
            <Plus size={16} />
            Add
          </button>
        </div>
        <div className="music-track-list">
          {audio.music_tracks.map((track) => (
            <article className="music-track" key={track.id}>
              <div className="entry-card-header">
                <select defaultValue={track.track_type} onChange={(event) => api.updateMusicTrack(track.id, { track_type: event.target.value }).then(loadAudio)}>
                  <option value="music">music</option>
                  <option value="sfx">sfx</option>
                  <option value="ambient">ambient</option>
                </select>
                <button type="button" className="icon-button" onClick={() => api.deleteMusicTrack(track.id).then(loadAudio)} title="Delete track">
                  <Trash2 size={16} />
                </button>
              </div>
              <input
                defaultValue={track.scene_reference}
                placeholder="scene or shot reference"
                onBlur={(event) => api.updateMusicTrack(track.id, { scene_reference: event.target.value }).then(loadAudio)}
              />
              <textarea
                defaultValue={track.notes}
                placeholder="notes"
                onBlur={(event) => api.updateMusicTrack(track.id, { notes: event.target.value }).then(loadAudio)}
              />
              {track.file_path && <audio src={assetUrl(track.file_path)} controls />}
              <label className="file-button">
                <Upload size={16} />
                Upload Track
                <input type="file" accept="audio/*" onChange={(event) => uploadTrack(track, event.target.files?.[0])} />
              </label>
            </article>
          ))}
          {audio.music_tracks.length === 0 && <div className="empty-state">No backing tracks attached.</div>}
        </div>
      </aside>
    </section>
  );
}

export default Audio;
