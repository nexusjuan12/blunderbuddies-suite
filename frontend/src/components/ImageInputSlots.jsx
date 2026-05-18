import { Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { API_BASE, api } from "../api.js";

function assetUrl(path) {
  if (!path) return "";
  return path.startsWith("/") ? `${API_BASE}${path}` : path;
}

function ImageInputSlots({ slots = [], onChange, libraryEntries = [], previousImage }) {
  const [quickLibraryId, setQuickLibraryId] = useState("");

  function updateSlot(index, patch) {
    onChange(slots.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot)));
  }

  function addSlot(slot = {}) {
    if (slots.length >= 14) return;
    onChange([
      ...slots,
      {
        slot_index: slots.length + 1,
        label: "",
        source_type: "library",
        library_entry_id: null,
        file_path: "",
        url: "",
        ...slot,
      },
    ]);
  }

  function removeSlot(index) {
    onChange(slots.filter((_, slotIndex) => slotIndex !== index).map((slot, slotIndex) => ({ ...slot, slot_index: slotIndex + 1 })));
  }

  function moveSlot(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= slots.length) return;
    const next = [...slots];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((slot, slotIndex) => ({ ...slot, slot_index: slotIndex + 1, order_changed: true })));
  }

  function useLibraryAsset(index, entryId) {
    const entry = libraryEntries.find((item) => item.id === Number(entryId));
    updateSlot(index, {
      library_entry_id: entry?.id || null,
      file_path: entry?.asset_path || "",
      url: entry?.asset_path || "",
      source_type: "library",
      label: slots[index].label || entry?.title || "",
    });
  }

  async function uploadFresh(index, file) {
    if (!file) return;
    const upload = await api.uploadLibraryAsset(file);
    updateSlot(index, {
      source_type: "upload",
      library_entry_id: null,
      file_path: upload.file_path,
      url: upload.file_path,
      label: slots[index].label || upload.source_filename || "uploaded image",
    });
  }

  async function uploadFreshSlot(file) {
    if (!file || slots.length >= 14) return;
    const upload = await api.uploadLibraryAsset(file);
    addSlot({
      source_type: "upload",
      library_entry_id: null,
      file_path: upload.file_path,
      url: upload.file_path,
      label: upload.source_filename || "uploaded image",
    });
  }

  function addLibrarySlot(entryId) {
    const entry = libraryEntries.find((item) => item.id === Number(entryId));
    if (!entry || slots.length >= 14) return;
    addSlot({
      source_type: "library",
      library_entry_id: entry.id,
      file_path: entry.asset_path,
      url: entry.asset_path,
      label: entry.title,
    });
    setQuickLibraryId("");
  }

  const orderChanged = slots.some((slot) => slot.order_changed);

  return (
    <div className="input-slots">
      <div className="slot-toolbar">
        <div>
          <h3>Image Inputs</h3>
          <p>Optional ordered reference images. Prompts refer to these as image 1, image 2, and so on.</p>
        </div>
        <div className="slot-actions">
          <label className="file-button">
            <Upload size={16} />
            Upload Image
            <input type="file" accept="image/*" onChange={(event) => uploadFreshSlot(event.target.files?.[0])} />
          </label>
          <select value={quickLibraryId} onChange={(event) => addLibrarySlot(event.target.value)}>
            <option value="">Add from Library</option>
            {libraryEntries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => addSlot()} disabled={slots.length >= 14}>
            <Plus size={16} />
            Empty Slot
          </button>
          {previousImage && (
            <button
              type="button"
              onClick={() =>
                addSlot({
                  label: previousImage.frame_type === "first" ? "approved first frame" : "previous generation",
                  source_type: "previous_generation",
                  file_path: previousImage.file_path,
                  url: previousImage.file_path,
                })
              }
              disabled={slots.length >= 14}
            >
              Use Previous
            </button>
          )}
        </div>
      </div>
      {orderChanged && <div className="notice">Slot order changed - check your prompt references.</div>}
      {slots.length === 0 && <div className="empty-state">No reference images selected. Upload one, add from Library, or generate without references.</div>}
      {slots.map((slot, index) => (
        <div className="slot-row" key={slot.id || index}>
          <span className="slot-index">{index + 1}</span>
          <div className="slot-fields">
            {slot.file_path && <img src={assetUrl(slot.file_path)} alt={slot.label || `Image ${index + 1}`} />}
            <input value={slot.label || ""} onChange={(event) => updateSlot(index, { label: event.target.value })} placeholder="slot label" />
            <select value={slot.library_entry_id || ""} onChange={(event) => useLibraryAsset(index, event.target.value)}>
              <option value="">Pick from Library</option>
              {libraryEntries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title}
                </option>
              ))}
            </select>
            <input
              value={slot.file_path || ""}
              onChange={(event) => updateSlot(index, { file_path: event.target.value, url: event.target.value, source_type: "upload" })}
              placeholder="asset path or URL"
            />
            <label className="file-button slot-upload">
              Upload Fresh
              <input type="file" accept="image/*" onChange={(event) => uploadFresh(index, event.target.files?.[0])} />
            </label>
            <div className="button-row compact">
              <button type="button" onClick={() => moveSlot(index, -1)} disabled={index === 0}>
                Up
              </button>
              <button type="button" onClick={() => moveSlot(index, 1)} disabled={index === slots.length - 1}>
                Down
              </button>
              <button type="button" className="icon-button" onClick={() => removeSlot(index)} title="Remove slot">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ImageInputSlots;
