function ShotBreakdown({ episode }) {
  const locked = episode && ["script_locked", "planning", "in_production", "complete"].includes(episode.status);

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <h1>Shot Breakdown</h1>
          <p>Phase 1 placeholder. Editable generated shot cards arrive in Phase 3.</p>
        </div>
        <span className="badge">{locked ? "enabled" : "lock script first"}</span>
      </div>
      {!locked && <div className="empty-state">Lock a script in Script Studio to enable shot planning.</div>}
    </section>
  );
}

export default ShotBreakdown;

