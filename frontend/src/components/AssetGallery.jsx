import { API_BASE } from "../api.js";

function assetUrl(path) {
  if (!path) return "";
  return path.startsWith("/") ? `${API_BASE}${path}` : path;
}

function AssetGallery({ assets = [], selectedId, onSelect }) {
  const selectedAsset = assets.find((asset) => asset.id === selectedId) || assets[0] || null;

  return (
    <div className="asset-gallery-panel">
      {assets.length === 0 && <div className="empty-state">No generated assets yet.</div>}
      {selectedAsset && (
        <div className="selected-asset-preview">
          <div className="preview-stage">
            <img src={assetUrl(selectedAsset.file_path)} alt={`${selectedAsset.frame_type} selected preview`} />
          </div>
          <div className="preview-meta">
            <span className="badge">{selectedAsset.approved ? "approved" : "draft"}</span>
            <span>{selectedAsset.resolution}</span>
            <span>{selectedAsset.aspect_ratio}</span>
          </div>
          <p>{selectedAsset.prompt}</p>
        </div>
      )}
      <div className="asset-gallery">
        {assets.map((asset) => (
          <button className={`asset-card ${selectedId === asset.id ? "selected" : ""}`} key={asset.id} type="button" onClick={() => onSelect?.(asset.id)}>
            {asset.file_path && <img src={assetUrl(asset.file_path)} alt={`${asset.frame_type} frame`} />}
            <span className="badge">{asset.approved ? "approved" : "draft"}</span>
            <span className="asset-card-label">{asset.resolution} · {asset.aspect_ratio}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default AssetGallery;
