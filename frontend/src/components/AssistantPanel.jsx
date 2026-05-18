import { Send } from "lucide-react";
import { useState } from "react";

function AssistantPanel({ title = "Creative Assistant" }) {
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a practical creative assistant for an animated YouTube production. Help brainstorm, but keep final choices under the creator's control.",
  );

  return (
    <aside className="panel assistant-panel">
      <h2>{title}</h2>
      <label>
        System prompt
        <textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} rows={5} />
      </label>
      <div className="chat-window">
        <div className="chat-message muted">Assistant wiring starts with the mock provider in a later phase.</div>
      </div>
      <div className="chat-input">
        <input placeholder="Brainstorm ideas" disabled />
        <button type="button" disabled title="Send">
          <Send size={16} />
        </button>
      </div>
    </aside>
  );
}

export default AssistantPanel;

