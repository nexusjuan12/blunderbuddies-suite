import { Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { API_BASE, api } from "../api.js";

const entryTypes = ["character", "setting", "lore", "script", "reference", "voice", "music", "audio", "video"];

function resolveAssetUrl(path) {
  if (!path) return "";
  return path.startsWith("/") ? `${API_BASE}${path}` : path;
}

function inferAssetKind(entry) {
  if (entry.asset_kind) return entry.asset_kind;
  if (entry.mime_type?.startsWith("image/")) return "image";
  if (entry.mime_type?.startsWith("audio/")) return "audio";
  if (entry.mime_type?.startsWith("video/")) return "video";
  const path = entry.asset_path || "";
  if (/\.(png|jpe?g|webp|gif)$/i.test(path)) return "image";
  if (/\.(wav|mp3|ogg|flac|m4a|aac)$/i.test(path)) return "audio";
  if (/\.(mp4|mov|webm|mkv)$/i.test(path)) return "video";
  return "file";
}

function AssetPreview({ entry }) {
  if (!entry.asset_path) return null;
  const url = resolveAssetUrl(entry.asset_path);
  const kind = inferAssetKind(entry);

  return (
    <div className="asset-preview">
      {kind === "image" && <img src={url} alt={entry.title} />}
      {kind === "audio" && <audio src={url} controls />}
      {kind === "video" && <video src={url} controls />}
      {kind === "file" && (
        <a href={url} target="_blank" rel="noreferrer">
          Open asset
        </a>
      )}
      <div className="asset-meta">
        <span>{entry.asset_kind || kind}</span>
        {entry.mime_type && <span>{entry.mime_type}</span>}
        {entry.source_filename && <span>{entry.source_filename}</span>}
      </div>
      <div className="asset-path">{entry.asset_path}</div>
    </div>
  );
}

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
    asset_kind: "",
    mime_type: "",
    source_filename: "",
  });
  const [assetFile, setAssetFile] = useState(null);

  async function loadEntries() {
    setEntries(await api.listLibrary({ q: query, entry_type: typeFilter }));
  }

  useEffect(() => {
    loadEntries().catch(console.error);
  }, [query, typeFilter]);

  async function createEntry(event) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    let assetPath = draft.asset_path || null;
    let assetMetadata = {
      asset_kind: draft.asset_kind || null,
      mime_type: draft.mime_type || null,
      source_filename: draft.source_filename || null,
    };
    if (assetFile) {
      const upload = await api.uploadLibraryAsset(assetFile);
      assetPath = upload.file_path;
      assetMetadata = {
        asset_kind: upload.asset_kind,
        mime_type: upload.mime_type,
        source_filename: upload.source_filename,
      };
    }
    await api.createLibraryEntry({
      entry_type: draft.entry_type,
      title: draft.title.trim(),
      content: draft.content,
      tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      asset_path: assetPath,
      ...assetMetadata,
    });
    setDraft({
      entry_type: "character",
      title: "",
      content: "",
      tags: "",
      asset_path: "",
      asset_kind: "",
      mime_type: "",
      source_filename: "",
    });
    setAssetFile(null);
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
            <p>Characters, settings, lore, scripts, voice samples, music, and reusable production assets.</p>
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
              <AssetPreview entry={entry} />
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
          <label>
            Upload asset
            <input type="file" accept="image/*,audio/*,video/*" onChange={(event) => setAssetFile(event.target.files?.[0] || null)} />
          </label>
          {assetFile && <div className="selected-file">{assetFile.name}</div>}
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
