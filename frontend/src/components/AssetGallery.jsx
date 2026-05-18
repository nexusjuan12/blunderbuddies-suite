import { API_BASE } from "../api.js";

function assetUrl(path) {
  if (!path) return "";
  return path.startsWith("/") ? `${API_BASE}${path}` : path;
}

function AssetGallery({ assets = [], selectedId, onSelect }) {
  return (
    <div className="asset-gallery">
      {assets.length === 0 && <div className="empty-state">No generated assets yet.</div>}
      {assets.map((asset) => (
        <button className={`asset-card ${selectedId === asset.id ? "selected" : ""}`} key={asset.id} type="button" onClick={() => onSelect?.(asset.id)}>
          {asset.file_path && <img src={assetUrl(asset.file_path)} alt={`${asset.frame_type} frame`} />}
          <span className="badge">{asset.approved ? "approved" : "draft"}</span>
          <span>{asset.file_path}</span>
        </button>
      ))}
    </div>
  );
}

export default AssetGallery;
