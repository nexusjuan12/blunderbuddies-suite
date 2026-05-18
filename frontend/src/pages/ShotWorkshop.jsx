import ShotCanvas from "../components/ShotCanvas.jsx";
import { useEffect, useState } from "react";
import { api } from "../api.js";

function ShotWorkshop({ episode }) {
  const [shots, setShots] = useState([]);

  useEffect(() => {
    if (!episode) {
      setShots([]);
      return;
    }
    api.listShots(episode.id).then(setShots).catch(console.error);
  }, [episode?.id]);

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <h1>Shot Workshop</h1>
          <p>One-shot-at-a-time generation workflow starts after the shot canvas and mock assets are wired in.</p>
        </div>
      </div>
      <ShotCanvas shots={shots} />
    </section>
  );
}

export default ShotWorkshop;
