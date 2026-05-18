import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";

function Assembly({ episode }) {
  const [assembly, setAssembly] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadAssembly() {
    if (!episode) {
      setAssembly(null);
      return;
    }
    setAssembly(await api.getAssembly(episode.id));
  }

  useEffect(() => {
    loadAssembly().catch((err) => setError(err.message));
  }, [episode?.id]);

  async function exportAssembly() {
    if (!episode) return;
    setLoading(true);
    setError("");
    try {
      setAssembly(await api.exportAssembly(episode.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!episode) {
    return <div className="empty-state">Create an episode to view assembly status.</div>;
  }

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <h1>Assembly Checklist</h1>
          <p>Track approved frames, videos, dialogue, and backing tracks before export.</p>
        </div>
        <button type="button" onClick={exportAssembly} disabled={loading || !assembly}>
          <Download size={16} />
          Export Output Folder
        </button>
      </div>
      {error && <div className="error-banner inline-error">{error}</div>}
      {assembly?.export_path && <div className="notice">Exported shot sheet to {assembly.export_path}</div>}
      {!assembly || assembly.shots.length === 0 ? (
        <div className="empty-state">Begin production to populate this checklist.</div>
      ) : (
        <div className="assembly-table-wrap">
          <table className="assembly-table">
            <thead>
              <tr>
                <th>Shot</th>
                <th>Description</th>
                <th>First</th>
                <th>Last</th>
                <th>Video</th>
                <th>Audio</th>
                <th>Music</th>
              </tr>
            </thead>
            <tbody>
              {assembly.shots.map((row) => (
                <tr key={row.shot.id}>
                  <td>{row.shot.order_index}</td>
                  <td>{row.shot.description}</td>
                  <td><span className="badge">{row.first_frame}</span></td>
                  <td><span className="badge">{row.last_frame}</span></td>
                  <td><span className="badge">{row.video}</span></td>
                  <td><span className="badge">{row.audio}</span></td>
                  <td><span className="badge">{row.music}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default Assembly;
