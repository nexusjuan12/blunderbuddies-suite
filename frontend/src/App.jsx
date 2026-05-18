import { BookOpen, Clapperboard, FileAudio, Film, Library as LibraryIcon, ListChecks, ScrollText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import Assembly from "./pages/Assembly.jsx";
import Audio from "./pages/Audio.jsx";
import Library from "./pages/Library.jsx";
import ScriptStudio from "./pages/ScriptStudio.jsx";
import ShotBreakdown from "./pages/ShotBreakdown.jsx";
import ShotWorkshop from "./pages/ShotWorkshop.jsx";

const pages = [
  { id: "library", label: "Library", icon: LibraryIcon, component: Library },
  { id: "script", label: "Script Studio", icon: ScrollText, component: ScriptStudio },
  { id: "breakdown", label: "Shot Breakdown", icon: Clapperboard, component: ShotBreakdown },
  { id: "workshop", label: "Shot Workshop", icon: Film, component: ShotWorkshop },
  { id: "audio", label: "Audio", icon: FileAudio, component: Audio },
  { id: "assembly", label: "Assembly", icon: ListChecks, component: Assembly },
];

function App() {
  const [activePage, setActivePage] = useState("library");
  const [episodes, setEpisodes] = useState([]);
  const [activeEpisodeId, setActiveEpisodeId] = useState("");
  const [error, setError] = useState("");

  const activeEpisode = useMemo(
    () => episodes.find((episode) => episode.id === Number(activeEpisodeId)) || null,
    [episodes, activeEpisodeId],
  );

  const CurrentPage = pages.find((page) => page.id === activePage)?.component || Library;

  async function loadEpisodes() {
    const nextEpisodes = await api.listEpisodes();
    setEpisodes(nextEpisodes);
    if (!activeEpisodeId && nextEpisodes.length > 0) {
      setActiveEpisodeId(String(nextEpisodes[0].id));
    }
  }

  useEffect(() => {
    loadEpisodes().catch((err) => setError(err.message));
  }, []);

  async function createEpisode() {
    const episode = await api.createEpisode({
      title: "Untitled Episode",
      type: "short",
      buddy_day_name: "",
      script_text: "",
      status: "draft",
    });
    await loadEpisodes();
    setActiveEpisodeId(String(episode.id));
    setActivePage("script");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <BookOpen size={20} />
          <span>Blunderbuddies Production Suite</span>
        </div>
        <nav className="nav-tabs" aria-label="Primary">
          {pages.map((page) => {
            const Icon = page.icon;
            return (
              <button
                key={page.id}
                className={activePage === page.id ? "active" : ""}
                onClick={() => setActivePage(page.id)}
                type="button"
              >
                <Icon size={16} />
                {page.label}
              </button>
            );
          })}
        </nav>
        <div className="episode-switcher">
          <select value={activeEpisodeId} onChange={(event) => setActiveEpisodeId(event.target.value)}>
            <option value="">No episode</option>
            {episodes.map((episode) => (
              <option key={episode.id} value={episode.id}>
                {episode.title}
              </option>
            ))}
          </select>
          <button type="button" onClick={createEpisode}>
            New Episode
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <main className="content">
        <CurrentPage
          episode={activeEpisode}
          episodes={episodes}
          refreshEpisodes={loadEpisodes}
          setActivePage={setActivePage}
        />
      </main>
    </div>
  );
}

export default App;

