function ShotCanvas({ shots }) {
  return (
    <div className="shot-canvas">
      {shots.length === 0 && <div className="empty-state">No shots planned yet.</div>}
      {shots.map((shot) => (
        <div className="shot-tile" key={shot.id}>
          <span className="badge">Shot {shot.order_index}</span>
          <p>{shot.description}</p>
        </div>
      ))}
    </div>
  );
}

export default ShotCanvas;

