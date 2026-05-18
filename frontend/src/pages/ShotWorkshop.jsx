import { Check, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { API_BASE, api } from "../api.js";
import AssetGallery from "../components/AssetGallery.jsx";
import ImageInputSlots from "../components/ImageInputSlots.jsx";
import PromptEditor from "../components/PromptEditor.jsx";
import ShotCanvas from "../components/ShotCanvas.jsx";

const defaultImagePrompt = "";

function urlFor(path) {
  if (!path) return "";
  return path.startsWith("/") ? `${API_BASE}${path}` : path;
}

function ShotWorkshop({ episode }) {
  const [shots, setShots] = useState([]);
  const [activeShotId, setActiveShotId] = useState(null);
  const [productionByShot, setProductionByShot] = useState({});
  const [libraryImages, setLibraryImages] = useState([]);
  const [imagePrompt, setImagePrompt] = useState(defaultImagePrompt);
  const [videoPrompt, setVideoPrompt] = useState("");
  const [frameType, setFrameType] = useState("first");
  const [inputSlots, setInputSlots] = useState([]);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [resolution, setResolution] = useState("1K");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [videoDuration, setVideoDuration] = useState(4);
  const [fps, setFps] = useState(24);
  const [videoResolution, setVideoResolution] = useState("720p");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeShot = useMemo(() => shots.find((shot) => shot.id === activeShotId) || null, [shots, activeShotId]);
  const production = activeShot ? productionByShot[activeShot.id] || { images: [], videos: [], prompt_history: [] } : { images: [], videos: [], prompt_history: [] };
  const firstApproved = production.images.find((image) => image.frame_type === "first" && image.approved);
  const lastApproved = production.images.find((image) => image.frame_type === "last" && image.approved);
  const approvedVideo = production.videos.find((video) => video.approved);
  const activeImages = production.images.filter((image) => image.frame_type === frameType);
  const currentStep = approvedVideo ? "complete" : firstApproved && lastApproved ? "video" : firstApproved ? "last" : "first";

  async function loadShots() {
    if (!episode) {
      setShots([]);
      setActiveShotId(null);
      setProductionByShot({});
      return;
    }
    const nextShots = await api.listShots(episode.id);
    setShots(nextShots);
    const nextActive = activeShotId && nextShots.some((shot) => shot.id === activeShotId) ? activeShotId : nextShots.find((shot) => shot.status !== "approved")?.id || nextShots[0]?.id || null;
    setActiveShotId(nextActive);
  }

  async function loadProduction(shotId) {
    if (!shotId) return;
    const nextProduction = await api.getShotProduction(shotId);
    setProductionByShot((current) => ({ ...current, [shotId]: nextProduction }));
  }

  useEffect(() => {
    loadShots().catch((err) => setError(err.message));
    api
      .listLibrary({ entry_type: "reference" })
      .then((entries) => setLibraryImages(entries.filter((entry) => entry.asset_path && (entry.asset_kind === "image" || !entry.asset_kind))))
      .catch(console.error);
  }, [episode?.id]);

  useEffect(() => {
    if (!activeShotId) return;
    loadProduction(activeShotId).catch((err) => setError(err.message));
  }, [activeShotId]);

  useEffect(() => {
    setFrameType(currentStep === "last" ? "last" : "first");
    setSelectedImageId(null);
    setSelectedVideoId(null);
    setInputSlots([]);
    if (currentStep === "last" && firstApproved) {
      setImagePrompt(firstApproved.prompt);
    } else if (activeShot) {
      setImagePrompt("");
      setVideoPrompt("");
    }
  }, [activeShotId, currentStep]);

  async function refreshActive() {
    await loadShots();
    if (activeShotId) await loadProduction(activeShotId);
  }

  async function assistImagePrompt() {
    if (!activeShot) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.assistPrompt(activeShot.id, { target_type: "image", frame_type: frameType, input_slots: inputSlots });
      setImagePrompt(result.prompt);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateImage() {
    if (!activeShot || !imagePrompt.trim()) return;
    setLoading(true);
    setError("");
    try {
      const image = await api.generateImage(activeShot.id, {
        frame_type: frameType,
        prompt: imagePrompt,
        resolution,
        aspect_ratio: aspectRatio,
        input_slots: inputSlots.map((slot, index) => ({ ...slot, slot_index: index + 1 })),
      });
      setSelectedImageId(image.id);
      await refreshActive();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function approveSelectedImage() {
    if (!selectedImageId) return;
    setLoading(true);
    setError("");
    try {
      await api.approveImage(selectedImageId);
      await refreshActive();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function assistVideoPrompt() {
    if (!activeShot) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.assistPrompt(activeShot.id, { target_type: "video" });
      setVideoPrompt(result.prompt);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateVideo() {
    if (!activeShot || !videoPrompt.trim()) return;
    setLoading(true);
    setError("");
    try {
      const video = await api.generateVideo(activeShot.id, {
        prompt: videoPrompt,
        model: "p-video",
        duration_seconds: videoDuration,
        fps,
        resolution: videoResolution,
        draft_mode: true,
      });
      setSelectedVideoId(video.id);
      await refreshActive();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function approveSelectedVideo() {
    if (!selectedVideoId) return;
    setLoading(true);
    setError("");
    try {
      await api.approveVideo(selectedVideoId);
      const nextShots = await api.listShots(episode.id);
      setShots(nextShots);
      const nextShot = nextShots.find((shot) => shot.status !== "approved");
      setActiveShotId(nextShot?.id || activeShotId);
      if (activeShotId) await loadProduction(activeShotId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!episode) {
    return <div className="empty-state">Create an episode and begin production to use the Shot Workshop.</div>;
  }

  return (
    <section className="shot-workshop">
      <div className="panel">
        <div className="section-header">
          <div>
            <h1>Shot Workshop</h1>
            <p>First frame, last frame, and video approval workflow.</p>
          </div>
          {activeShot && <span className="badge">{currentStep}</span>}
        </div>
        {error && <div className="error-banner inline-error">{error}</div>}
        <ShotCanvas shots={shots} activeShotId={activeShotId} onSelect={setActiveShotId} productionByShot={productionByShot} />
      </div>

      {!activeShot && <div className="panel empty-state">Begin production from Shot Breakdown to populate the workshop.</div>}

      {activeShot && (
        <div className="workshop-grid">
          <section className="panel">
            <div className="section-header">
              <div>
                <h2>Shot {activeShot.order_index}</h2>
                <p>{activeShot.description}</p>
              </div>
              <span className="badge">{activeShot.status}</span>
            </div>
            <div className="shot-detail-grid">
              <div>
                <strong>Characters</strong>
                <p>{activeShot.characters.join(", ") || "None"}</p>
              </div>
              <div>
                <strong>Setting</strong>
                <p>{activeShot.setting || "Unspecified"}</p>
              </div>
              <div>
                <strong>Mood</strong>
                <p>{activeShot.mood || "Unspecified"}</p>
              </div>
              <div>
                <strong>Music</strong>
                <p>{activeShot.music_notes || "None"}</p>
              </div>
            </div>

            {currentStep !== "video" && currentStep !== "complete" && (
              <div className="generation-panel">
                <div className="step-tabs">
                  <button type="button" className={frameType === "first" ? "active" : ""} onClick={() => setFrameType("first")}>
                    First Frame
                  </button>
                  <button type="button" className={frameType === "last" ? "active" : ""} onClick={() => setFrameType("last")} disabled={!firstApproved}>
                    Last Frame
                  </button>
                </div>
                <PromptEditor value={imagePrompt} onChange={setImagePrompt} />
                <div className="button-row">
                  <button type="button" onClick={assistImagePrompt} disabled={loading}>
                    <WandSparkles size={16} />
                    Prompt Assistant
                  </button>
                </div>
                <ImageInputSlots slots={inputSlots} onChange={setInputSlots} libraryEntries={libraryImages} previousImage={frameType === "last" ? firstApproved : null} />
                <div className="control-row">
                  <select value={resolution} onChange={(event) => setResolution(event.target.value)}>
                    <option>1K</option>
                    <option>2K</option>
                    <option>4K</option>
                  </select>
                  <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)}>
                    <option>16:9</option>
                    <option>9:16</option>
                    <option>1:1</option>
                    <option>4:3</option>
                  </select>
                  <button type="button" onClick={generateImage} disabled={loading || !imagePrompt.trim()}>
                    Generate Image
                  </button>
                  <button type="button" onClick={approveSelectedImage} disabled={loading || !selectedImageId}>
                    <Check size={16} />
                    Approve Selected
                  </button>
                </div>
                <AssetGallery assets={activeImages} selectedId={selectedImageId} onSelect={setSelectedImageId} />
              </div>
            )}

            {currentStep === "video" && (
              <div className="generation-panel">
                <PromptEditor value={videoPrompt} onChange={setVideoPrompt} placeholder="Write an image-to-video prompt" />
                <div className="button-row">
                  <button type="button" onClick={assistVideoPrompt} disabled={loading}>
                    <WandSparkles size={16} />
                    Prompt Assistant
                  </button>
                </div>
                <div className="control-row">
                  <label>
                    Duration
                    <input type="number" min="1" max="10" value={videoDuration} onChange={(event) => setVideoDuration(Number(event.target.value))} />
                  </label>
                  <label>
                    FPS
                    <select value={fps} onChange={(event) => setFps(Number(event.target.value))}>
                      <option value={24}>24</option>
                      <option value={48}>48</option>
                    </select>
                  </label>
                  <label>
                    Resolution
                    <select value={videoResolution} onChange={(event) => setVideoResolution(event.target.value)}>
                      <option>720p</option>
                      <option>1080p</option>
                    </select>
                  </label>
                  <button type="button" onClick={generateVideo} disabled={loading || !videoPrompt.trim()}>
                    Generate Video
                  </button>
                  <button type="button" onClick={approveSelectedVideo} disabled={loading || !selectedVideoId}>
                    <Check size={16} />
                    Approve Shot
                  </button>
                </div>
                <div className="video-gallery">
                  {production.videos.map((video) => (
                    <button
                      type="button"
                      key={video.id}
                      className={`video-result ${selectedVideoId === video.id ? "selected" : ""}`}
                      onClick={() => setSelectedVideoId(video.id)}
                    >
                      {video.file_path ? <video src={urlFor(video.file_path)} controls /> : <div className="mock-video-frame">MOCK VIDEO</div>}
                      <span>{video.duration_seconds}s, {video.fps}fps, seed {video.seed}</span>
                      {video.approved && <span className="badge">approved</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === "complete" && (
              <div className="empty-state">Shot approved. Select another shot from the canvas to revisit or continue.</div>
            )}
          </section>

          <aside className="panel">
            <h2>Approved Assets</h2>
            <div className="approved-stack">
              {firstApproved && <img src={urlFor(firstApproved.file_path)} alt="Approved first frame" />}
              {lastApproved && <img src={urlFor(lastApproved.file_path)} alt="Approved last frame" />}
              {approvedVideo && (
                approvedVideo.file_path ? <video src={urlFor(approvedVideo.file_path)} controls /> : <div className="mock-video-frame">APPROVED MOCK VIDEO</div>
              )}
              {!firstApproved && <div className="empty-state">No approved first frame yet.</div>}
            </div>
            <h2>Prompt History</h2>
            <div className="prompt-history">
              {production.prompt_history.map((prompt) => (
                <button
                  type="button"
                  key={prompt.id}
                  onClick={() => (prompt.target_type === "video" ? setVideoPrompt(prompt.prompt) : setImagePrompt(prompt.prompt))}
                >
                  <span className="badge">{prompt.target_type}</span>
                  <span>{prompt.prompt}</span>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

export default ShotWorkshop;
