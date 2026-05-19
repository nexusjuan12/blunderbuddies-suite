import { Check, Send, WandSparkles } from "lucide-react";
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
  const [draftMode, setDraftMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [workshopNote, setWorkshopNote] = useState("");
  const [assistantMessages, setAssistantMessages] = useState([]);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantResponse, setAssistantResponse] = useState("");

  const activeShot = useMemo(() => shots.find((shot) => shot.id === activeShotId) || null, [shots, activeShotId]);
  const production = activeShot ? productionByShot[activeShot.id] || { images: [], videos: [], prompt_history: [] } : { images: [], videos: [], prompt_history: [] };
  const firstApproved = production.images.find((image) => image.frame_type === "first" && image.approved);
  const lastApproved = production.images.find((image) => image.frame_type === "last" && image.approved);
  const approvedVideo = production.videos.find((video) => video.approved);
  const selectedVideo = production.videos.find((video) => video.id === selectedVideoId) || null;
  const activeImages = production.images.filter((image) => image.frame_type === frameType);
  const currentStep = activeShot?.status === "approved" ? "complete" : firstApproved ? "video" : "first";

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

  async function loadLibraryImages() {
    const entries = await api.listLibrary();
    setLibraryImages(
      entries.filter((entry) => entry.asset_path && (entry.asset_kind === "image" || /\.(png|jpe?g|webp|gif|svg)$/i.test(entry.asset_path))),
    );
  }

  useEffect(() => {
    loadShots().catch((err) => setError(err.message));
    loadLibraryImages().catch(console.error);
  }, [episode?.id]);

  useEffect(() => {
    if (!activeShotId) return;
    loadProduction(activeShotId).catch((err) => setError(err.message));
  }, [activeShotId]);

  useEffect(() => {
    setSelectedImageId(null);
    setSelectedVideoId(null);
    setInputSlots([]);
    if (activeShot) {
      setFrameType(firstApproved && !lastApproved ? "last" : "first");
      setImagePrompt("");
      setVideoPrompt("");
    }
  }, [activeShotId, currentStep]);

  async function refreshActive() {
    await loadShots();
    if (activeShotId) await loadProduction(activeShotId);
  }

  function restoreImageState(image) {
    setFrameType(image.frame_type);
    setImagePrompt(image.prompt || "");
    setResolution(image.resolution || "1K");
    setAspectRatio(image.aspect_ratio || "16:9");
    setInputSlots((image.input_slots || []).map((slot, index) => ({ ...slot, slot_index: index + 1 })));
    setSelectedImageId(image.id);
  }

  async function reviseApprovedImage(image) {
    if (!image) return;
    if (currentStep !== "complete") {
      restoreImageState(image);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.reopenShot(image.shot_id);
      await refreshActive();
      restoreImageState(image);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function restoreVideoState(video) {
    setSelectedVideoId(video.id);
    setVideoPrompt(video.prompt || "");
    setVideoDuration(video.duration_seconds || 4);
    setFps(video.fps || 24);
    setVideoResolution(video.resolution || "720p");
    setDraftMode(Boolean(video.draft_mode));
  }

  async function saveGeneratedImageToLibrary(image) {
    if (!image) return;
    setLoading(true);
    setError("");
    try {
      await api.saveImageToLibrary(image.id, {
        title: `Shot ${activeShot?.order_index || ""} ${image.frame_type} frame`.trim(),
        tags: ["generated", image.frame_type, activeShot ? `shot-${activeShot.order_index}` : "shot"],
      });
      await loadLibraryImages();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function assistImagePrompt() {
    if (!activeShot) return;
    setLoading(true);
    setError("");
    try {
      const note = workshopNote ? `\n\nCreator direction: ${workshopNote}` : "";
      const result = await api.chat({
        system_prompt:
          "You are a prompt planning assistant for an animated series. Discuss the shot image with the creator. Ask clarifying questions when useful. If the direction is clear, provide a concise candidate image prompt at the end under 'Candidate prompt:'.",
        messages: [
          {
            role: "user",
            content: `Current shot: ${JSON.stringify(activeShot)}\nFrame type: ${frameType}\nInput slots: ${JSON.stringify(inputSlots)}${note}`,
          },
        ],
        context_entry_ids: [],
      });
      setAssistantResponse(result.response);
      setAssistantMessages((current) => [...current, { role: "assistant", content: result.response }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function candidatePromptFrom(text) {
    const marker = /candidate prompt:\s*/i;
    const parts = text.split(marker);
    return (parts.length > 1 ? parts.at(-1) : text).trim();
  }

  async function sendWorkshopMessage(event) {
    event.preventDefault();
    if (!activeShot || !assistantDraft.trim()) return;
    const nextMessages = [...assistantMessages, { role: "user", content: assistantDraft.trim() }];
    setAssistantMessages(nextMessages);
    setAssistantDraft("");
    setLoading(true);
    setError("");
    try {
      const result = await api.chat({
        system_prompt:
          "You are an interactive shot workshop assistant. Help plan image prompts and shot edits. Do not apply changes yourself; explain suggested changes and include exact proposed wording when useful.",
        messages: [
          {
            role: "user",
            content: `Episode: ${episode?.title}\nCurrent shot: ${JSON.stringify(activeShot)}\nCurrent frame type: ${frameType}\nCurrent prompt: ${imagePrompt}\nInput slots: ${JSON.stringify(inputSlots)}`,
          },
          ...nextMessages,
        ],
        context_entry_ids: [],
      });
      setAssistantResponse(result.response);
      setAssistantMessages([...nextMessages, { role: "assistant", content: result.response }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function applyWorkshopCommand() {
    if (!activeShot || !workshopNote.trim()) return;
    setLoading(true);
    setError("");
    try {
      const splitMatch = workshopNote.match(/split\s+shot\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i);
      const adjustMatch = workshopNote.match(/(?:adjust|change|update)\s+shot\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten).*?(?:to|like this|:)\s*(.+)$/i);
      const numberWords = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
      const parseShotNumber = (value) => numberWords[value.toLowerCase()] || Number(value);

      if (splitMatch) {
        const shotNumber = parseShotNumber(splitMatch[1]);
        const target = shots.find((shot) => shot.order_index === shotNumber) || activeShot;
        const descriptions = workshopNote.split(/\b(?:into|:)\b/i).slice(1).join(" ").split(/\s*[|;]\s*/);
        await api.splitShot(target.id, {
          first_description: descriptions[0]?.trim() || target.description,
          second_description: descriptions[1]?.trim() || `Continuation of ${target.description}`,
        });
      } else if (adjustMatch) {
        const shotNumber = parseShotNumber(adjustMatch[1]);
        const target = shots.find((shot) => shot.order_index === shotNumber) || activeShot;
        await api.updateShot(target.id, { description: adjustMatch[2].trim() });
      } else {
        await api.updateShot(activeShot.id, { description: workshopNote.trim() });
      }
      setWorkshopNote("");
      await loadShots();
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
    const prompt = videoPrompt.trim() || selectedVideo?.prompt || "";
    if (!activeShot || !prompt) return;
    setLoading(true);
    setError("");
    try {
      const video = await api.generateVideo(activeShot.id, {
        prompt,
        model: "p-video",
        duration_seconds: videoDuration,
        fps,
        resolution: videoResolution,
        draft_mode: draftMode,
      });
      setSelectedVideoId(video.id);
      await refreshActive();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function upgradeSelectedDraft() {
    if (!activeShot || !selectedVideo || !selectedVideo.draft_mode) return;
    setLoading(true);
    setError("");
    try {
      const video = await api.generateVideo(activeShot.id, {
        prompt: selectedVideo.prompt,
        model: selectedVideo.model,
        duration_seconds: selectedVideo.duration_seconds,
        fps: selectedVideo.fps,
        resolution: selectedVideo.resolution,
        draft_mode: false,
        seed: selectedVideo.seed,
        upgrade_from_video_id: selectedVideo.id,
      });
      setDraftMode(false);
      setVideoPrompt(selectedVideo.prompt);
      setVideoDuration(selectedVideo.duration_seconds);
      setFps(selectedVideo.fps);
      setVideoResolution(selectedVideo.resolution);
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

  async function reopenActiveShot() {
    if (!activeShot) return;
    setLoading(true);
    setError("");
    try {
      await api.reopenShot(activeShot.id);
      setSelectedVideoId(null);
      await refreshActive();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!episode) {
    return <div className="empty-state">Create an episode and begin production to use the Shot Workshop.</div>;
  }

  const canGenerateVideo = Boolean(videoPrompt.trim() || selectedVideo?.prompt);
  const canUpgradeVideo = Boolean(selectedVideo?.draft_mode);

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
            <div className="workshop-notes">
              <label>
                Workshop direction
                <textarea
                  value={workshopNote}
                  onChange={(event) => setWorkshopNote(event.target.value)}
                  placeholder="Discuss this shot, or type commands like: split shot two into first beat | second beat"
                  rows={3}
                />
              </label>
              <div className="button-row">
                <button type="button" onClick={assistImagePrompt} disabled={loading}>
                  <WandSparkles size={16} />
                  Discuss Image
                </button>
                <button type="button" onClick={applyWorkshopCommand} disabled={loading || !workshopNote.trim()}>
                  Apply Shot Edit
                </button>
              </div>
            </div>

            {currentStep !== "complete" && (
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
                <AssetGallery
                  assets={activeImages}
                  selectedId={selectedImageId}
                  onSelect={setSelectedImageId}
                  onRestore={restoreImageState}
                  onSaveToLibrary={saveGeneratedImageToLibrary}
                />
              </div>
            )}

            {currentStep !== "complete" && firstApproved && (
              <div className="generation-panel">
                <div className="notice">
                  Video generation will use the approved first frame{lastApproved ? " and approved last frame." : ". Approving a last frame is optional."}
                </div>
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
                  <label className="checkbox-label">
                    <input type="checkbox" checked={draftMode} onChange={(event) => setDraftMode(event.target.checked)} />
                    Draft mode
                  </label>
                  <button
                    type="button"
                    onClick={generateVideo}
                    disabled={loading || !canGenerateVideo}
                    title={!canGenerateVideo ? "Write a video prompt or select an existing video to reuse its prompt." : ""}
                  >
                    Generate {draftMode ? "Draft" : "Final"}
                  </button>
                  <button
                    type="button"
                    onClick={upgradeSelectedDraft}
                    disabled={loading || !canUpgradeVideo}
                    title={!canUpgradeVideo ? "Select a draft video first." : ""}
                  >
                    Upgrade to Final
                  </button>
                  <button type="button" onClick={approveSelectedVideo} disabled={loading || !selectedVideoId}>
                    <Check size={16} />
                    Approve Shot
                  </button>
                </div>
                {!canUpgradeVideo && production.videos.length > 0 && (
                  <div className="muted">Select a draft video to enable Upgrade to Final.</div>
                )}
                <div className="video-gallery">
                  {production.videos.map((video) => (
                    <button
                      type="button"
                      key={video.id}
                      className={`video-result ${selectedVideoId === video.id ? "selected" : ""}`}
                      onClick={() => restoreVideoState(video)}
                    >
                      {video.file_path ? <video src={urlFor(video.file_path)} controls /> : <div className="mock-video-frame">MOCK VIDEO</div>}
                      <span>{video.draft_mode ? "Draft" : "Final"} · {video.duration_seconds}s, {video.fps}fps, seed {video.seed}</span>
                      {video.approved && <span className="badge">approved</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === "complete" && (
              <div className="empty-state">
                <p>Shot approved. Select another shot from the canvas to revisit or continue.</p>
                <button type="button" onClick={reopenActiveShot} disabled={loading}>
                  Reopen Shot
                </button>
              </div>
            )}
          </section>

          <aside className="panel">
            <h2>Workshop Assistant</h2>
            <div className="prompt-history">
              {assistantMessages.length === 0 && <div className="empty-state">Discuss the shot before committing to a prompt or edit.</div>}
              {assistantMessages.map((message, index) => (
                <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
                  <strong>{message.role === "assistant" ? "Assistant" : "You"}</strong>
                  <p>{message.content}</p>
                </div>
              ))}
            </div>
            <form className="chat-input" onSubmit={sendWorkshopMessage}>
              <input value={assistantDraft} onChange={(event) => setAssistantDraft(event.target.value)} placeholder="Ask about this shot" />
              <button type="submit" disabled={loading || !assistantDraft.trim()} title="Send">
                <Send size={16} />
              </button>
            </form>
            <div className="button-row">
              <button type="button" onClick={() => setImagePrompt(candidatePromptFrom(assistantResponse))} disabled={!assistantResponse}>
                Use Response as Prompt
              </button>
            </div>
            <h2>Approved Assets</h2>
            <div className="approved-stack">
              {firstApproved && (
                <div className="approved-asset">
                  <img src={urlFor(firstApproved.file_path)} alt="Approved first frame" />
                  <button type="button" onClick={() => reviseApprovedImage(firstApproved)} disabled={loading}>
                    Revise First Frame
                  </button>
                </div>
              )}
              {lastApproved && (
                <div className="approved-asset">
                  <img src={urlFor(lastApproved.file_path)} alt="Approved last frame" />
                  <button type="button" onClick={() => reviseApprovedImage(lastApproved)} disabled={loading}>
                    Revise Last Frame
                  </button>
                </div>
              )}
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
