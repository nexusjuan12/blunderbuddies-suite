function AssetGallery({ assets = [] }) {
  return (
    <div className="asset-gallery">
      {assets.length === 0 && <div className="empty-state">No generated assets yet.</div>}
      {assets.map((asset) => (
        <div className="asset-card" key={asset.id}>
          <span>{asset.file_path}</span>
        </div>
      ))}
    </div>
  );
}

export default AssetGallery;

