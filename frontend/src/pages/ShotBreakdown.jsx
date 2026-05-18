import { Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";

const emptyShot = {
  order_index: 1,
  description: "",
  characters: [],
  setting: "",
  mood: "",
  has_dialogue: false,
  music_notes: "",
};

function normalizeShots(nextShots) {
  return nextShots.map((shot, index) => ({ ...shot, order_index: index + 1 }));
}

function ShotBreakdown({ episode, refreshEpisodes, setActivePage }) {
  const locked = episode && ["script_locked", "planning", "in_production", "complete"].includes(episode.status);
  const [shots, setShots] = useState([]);
  const [savedShots, setSavedShots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setShots([]);
    setSavedShots([]);
    setError("");
    if (!episode) return;
    api
      .listShots(episode.id)
      .then((records) => {
        setSavedShots(records);
        if (records.length > 0) {
          setShots(records);
        }
      })
      .catch((err) => setError(err.message));
  }, [episode?.id]);

  async function generateShots() {
    if (!episode) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.generateShotBreakdown(episode.id);
      setShots(normalizeShots(result.shots || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateShot(index, patch) {
    setShots((current) => current.map((shot, shotIndex) => (shotIndex === index ? { ...shot, ...patch } : shot)));
  }

  function addBelow(index) {
    setShots((current) => {
      const next = [...current];
      next.splice(index + 1, 0, { ...emptyShot });
      return normalizeShots(next);
    });
  }

  function duplicateShot(index) {
    setShots((current) => {
      const next = [...current];
      next.splice(index + 1, 0, { ...current[index], id: undefined });
      return normalizeShots(next);
    });
  }

  function deleteShot(index) {
    setShots((current) => normalizeShots(current.filter((_, shotIndex) => shotIndex !== index)));
  }

  function moveShot(index, direction) {
    setShots((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return normalizeShots(next);
    });
  }

  async function beginProduction() {
    if (!episode) return;
    setLoading(true);
    setError("");
    try {
      const payload = shots.map((shot, index) => ({
        order_index: index + 1,
        description: shot.description,
        characters: Array.isArray(shot.characters)
          ? shot.characters
          : String(shot.characters)
              .split(",")
              .map((character) => character.trim())
              .filter(Boolean),
        setting: shot.setting,
        mood: shot.mood,
        has_dialogue: Boolean(shot.has_dialogue),
        music_notes: shot.music_notes,
      }));
      const created = await api.beginProduction(episode.id, payload);
      setSavedShots(created);
      setShots(created);
      await refreshEpisodes();
      setActivePage("workshop");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel shot-breakdown-page">
      <div className="section-header">
        <div>
          <h1>Shot Breakdown</h1>
          <p>Generate a mock shot plan, edit every field, then begin production when the list is ready.</p>
        </div>
        <div className="button-row">
          <span className="badge">{locked ? "enabled" : "lock script first"}</span>
          <button type="button" onClick={generateShots} disabled={!locked || loading}>
            Generate Shot List
          </button>
          <button type="button" onClick={beginProduction} disabled={!locked || loading || shots.length === 0}>
            Begin Production
          </button>
        </div>
      </div>
      {error && <div className="error-banner inline-error">{error}</div>}
      {!locked && <div className="empty-state">Lock a script in Script Studio to enable shot planning.</div>}
      {locked && shots.length === 0 && <div className="empty-state">No shot plan yet.</div>}
      {savedShots.length > 0 && <div className="notice">Production has {savedShots.length} saved shots. Regenerating before generation starts will replace them.</div>}
      <div className="shot-plan-list">
        {shots.map((shot, index) => (
          <article className="shot-plan-card" key={shot.id || `${shot.order_index}-${index}`}>
            <div className="entry-card-header">
              <span className="badge">Shot {index + 1}</span>
              <div className="button-row compact">
                <button type="button" onClick={() => moveShot(index, -1)} disabled={index === 0} title="Move up">
                  Up
                </button>
                <button type="button" onClick={() => moveShot(index, 1)} disabled={index === shots.length - 1} title="Move down">
                  Down
                </button>
                <button type="button" className="icon-button" onClick={() => duplicateShot(index)} title="Duplicate shot">
                  <Copy size={16} />
                </button>
                <button type="button" className="icon-button" onClick={() => addBelow(index)} title="Add below">
                  <Plus size={16} />
                </button>
                <button type="button" className="icon-button" onClick={() => deleteShot(index)} title="Delete shot">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="shot-card-grid">
              <label>
                Description
                <textarea value={shot.description} onChange={(event) => updateShot(index, { description: event.target.value })} rows={3} />
              </label>
              <label>
                Characters
                <input
                  value={(shot.characters || []).join(", ")}
                  onChange={(event) =>
                    updateShot(index, {
                      characters: event.target.value.split(",").map((character) => character.trim()).filter(Boolean),
                    })
                  }
                />
              </label>
              <label>
                Setting
                <input value={shot.setting || ""} onChange={(event) => updateShot(index, { setting: event.target.value })} />
              </label>
              <label>
                Mood
                <input value={shot.mood || ""} onChange={(event) => updateShot(index, { mood: event.target.value })} />
              </label>
              <label>
                Music notes
                <input value={shot.music_notes || ""} onChange={(event) => updateShot(index, { music_notes: event.target.value })} />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={Boolean(shot.has_dialogue)} onChange={(event) => updateShot(index, { has_dialogue: event.target.checked })} />
                Has dialogue
              </label>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ShotBreakdown;
