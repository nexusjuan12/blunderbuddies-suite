import { API_BASE } from "../api.js";

function ShotCanvas({ shots, activeShotId, onSelect, productionByShot = {} }) {
  return (
    <div className="shot-canvas">
      {shots.length === 0 && <div className="empty-state">No shots planned yet.</div>}
      {shots.map((shot) => (
        <button
          className={`shot-tile ${activeShotId === shot.id ? "active-shot" : ""}`}
          key={shot.id}
          onClick={() => onSelect?.(shot.id)}
          type="button"
        >
          <div className="entry-card-header">
            <span className="badge">Shot {shot.order_index}</span>
            <span className="badge">{shot.status}</span>
          </div>
          <div className="shot-thumb-pair">
            {(productionByShot[shot.id]?.images || [])
              .filter((image) => image.approved)
              .slice(0, 2)
              .map((image) => (
                <img key={image.id} src={image.file_path.startsWith("/") ? `${API_BASE}${image.file_path}` : image.file_path} alt="" />
              ))}
          </div>
          <p>{shot.description}</p>
        </button>
      ))}
    </div>
  );
}

export default ShotCanvas;
