import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";
import AssistantPanel from "../components/AssistantPanel.jsx";

function ScriptStudio({ episode, refreshEpisodes, setActivePage }) {
  const [draft, setDraft] = useState(episode || null);

  useEffect(() => {
    setDraft(episode || null);
  }, [episode]);

  if (!draft) {
    return <div className="empty-state">Create an episode to start writing.</div>;
  }

  async function savePatch(patch) {
    const updated = await api.updateEpisode(draft.id, patch);
    setDraft(updated);
    await refreshEpisodes();
  }

  async function lockScript() {
    const updated = await api.updateEpisode(draft.id, { ...draft, status: "script_locked" });
    await api.createLibraryEntry({
      entry_type: "script",
      title: updated.title,
      content: updated.script_text,
      tags: ["episode-script", updated.type],
      asset_path: null,
    });
    setDraft(updated);
    await refreshEpisodes();
    setActivePage("breakdown");
  }

  return (
    <section className="two-column">
      <div className="panel">
        <div className="section-header">
          <div>
            <h1>Script Studio</h1>
            <p>Final script text stays manually controlled.</p>
          </div>
          <span className="badge">{draft.status}</span>
        </div>
        <div className="stacked-form">
          <label>
            Episode title
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} onBlur={() => savePatch({ title: draft.title })} />
          </label>
          <label>
            Episode type
            <select value={draft.type} onChange={(event) => savePatch({ type: event.target.value })}>
              <option value="short">Short</option>
              <option value="long">Long</option>
              <option value="special">Special</option>
            </select>
          </label>
          <label>
            Buddy Day name
            <input
              value={draft.buddy_day_name}
              onChange={(event) => setDraft({ ...draft, buddy_day_name: event.target.value })}
              onBlur={() => savePatch({ buddy_day_name: draft.buddy_day_name })}
            />
          </label>
          <label>
            Script
            <textarea
              className="script-editor"
              value={draft.script_text}
              onChange={(event) => setDraft({ ...draft, script_text: event.target.value })}
              onBlur={() => savePatch({ script_text: draft.script_text })}
            />
          </label>
          <button type="button" onClick={lockScript}>
            <Save size={16} />
            Lock Script
          </button>
        </div>
      </div>
      <AssistantPanel title="Creative Assistant" />
    </section>
  );
}

export default ScriptStudio;

