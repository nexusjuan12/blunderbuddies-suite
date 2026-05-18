function ShotCard({ shot }) {
  return (
    <article className="entry-card">
      <div className="entry-card-header">
        <span className="badge">Shot {shot.order_index}</span>
        <span className="badge">{shot.status}</span>
      </div>
      <p>{shot.description}</p>
    </article>
  );
}

export default ShotCard;

