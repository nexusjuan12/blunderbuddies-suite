import ShotCanvas from "../components/ShotCanvas.jsx";

function ShotWorkshop() {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <h1>Shot Workshop</h1>
          <p>Phase 1 shell. One-shot-at-a-time generation workflow starts after shot breakdown is functional.</p>
        </div>
      </div>
      <ShotCanvas shots={[]} />
    </section>
  );
}

export default ShotWorkshop;

