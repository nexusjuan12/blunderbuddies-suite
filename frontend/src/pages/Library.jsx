import { Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";

const entryTypes = ["character", "setting", "lore", "script", "reference"];

function Library() {
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [draft, setDraft] = useState({
    entry_type: "character",
    title: "",
    content: "",
    tags: "",
    asset_path: "",
  });

  async function loadEntries() {
    setEntries(await api.listLibrary({ q: query, entry_type: typeFilter }));
  }

  useEffect(() => {
    loadEntries().catch(console.error);
  }, [query, typeFilter]);

  async function createEntry(event) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    await api.createLibraryEntry({
      entry_type: draft.entry_type,
      title: draft.title.trim(),
      content: draft.content,
      tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      asset_path: draft.asset_path || null,
    });
    setDraft({ entry_type: "character", title: "", content: "", tags: "", asset_path: "" });
    await loadEntries();
  }

  async function updateEntry(entry, patch) {
    await api.updateLibraryEntry(entry.id, patch);
    await loadEntries();
  }

  async function deleteEntry(id) {
    await api.deleteLibraryEntry(id);
    await loadEntries();
  }

  return (
    <section className="page-grid library-page">
      <div className="panel library-list">
        <div className="section-header">
          <div>
            <h1>Reference Library</h1>
            <p>Characters, settings, lore, scripts, and reusable visual references.</p>
          </div>
          <div className="filter-row">
            <label className="search-box">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search library" />
            </label>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">All types</option>
              {entryTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="entry-list">
          {entries.map((entry) => (
            <article className="entry-card" key={entry.id}>
              <div className="entry-card-header">
                <span className="badge">{entry.entry_type}</span>
                <button type="button" className="icon-button" onClick={() => deleteEntry(entry.id)} title="Delete entry">
                  <Trash2 size={16} />
                </button>
              </div>
              <input
                className="inline-title"
                defaultValue={entry.title}
                onBlur={(event) => updateEntry(entry, { title: event.target.value })}
              />
              <textarea
                defaultValue={entry.content}
                onBlur={(event) => updateEntry(entry, { content: event.target.value })}
                rows={5}
              />
              <input
                defaultValue={entry.tags.join(", ")}
                onBlur={(event) =>
                  updateEntry(entry, {
                    tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean),
                  })
                }
                placeholder="tags"
              />
              {entry.asset_path && <div className="asset-path">{entry.asset_path}</div>}
            </article>
          ))}
          {entries.length === 0 && <div className="empty-state">No library entries yet.</div>}
        </div>
      </div>

      <aside className="panel">
        <h2>Create Entry</h2>
        <form className="stacked-form" onSubmit={createEntry}>
          <label>
            Type
            <select value={draft.entry_type} onChange={(event) => setDraft({ ...draft, entry_type: event.target.value })}>
              {entryTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </label>
          <label>
            Content
            <textarea value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} rows={8} />
          </label>
          <label>
            Tags
            <input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="comma separated" />
          </label>
          <label>
            Asset path
            <input value={draft.asset_path} onChange={(event) => setDraft({ ...draft, asset_path: event.target.value })} />
          </label>
          <button type="submit">
            <Plus size={16} />
            Create
          </button>
        </form>
      </aside>
    </section>
  );
}

export default Library;

