import { Send } from "lucide-react";
import { useState } from "react";
import { api } from "../api.js";

function AssistantPanel({ title = "Creative Assistant" }) {
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a practical creative assistant for an animated YouTube production. Help brainstorm, but keep final choices under the creator's control.",
  );
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    const nextMessages = [...messages, { role: "user", content: draft.trim() }];
    setMessages(nextMessages);
    setDraft("");
    setLoading(true);
    setError("");
    try {
      const result = await api.chat({ system_prompt: systemPrompt, messages: nextMessages, context_entry_ids: [] });
      setMessages([...nextMessages, { role: "assistant", content: result.response }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="panel assistant-panel">
      <h2>{title}</h2>
      <label>
        System prompt
        <textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} rows={5} />
      </label>
      {error && <div className="error-banner inline-error">{error}</div>}
      <div className="chat-window">
        {messages.length === 0 && <div className="chat-message muted">Ask for brainstorming, rewrites, or production planning help.</div>}
        {messages.map((message, index) => (
          <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
            <strong>{message.role === "assistant" ? "Assistant" : "You"}</strong>
            <p>{message.content}</p>
          </div>
        ))}
      </div>
      <form className="chat-input" onSubmit={sendMessage}>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Brainstorm ideas" disabled={loading} />
        <button type="submit" disabled={loading || !draft.trim()} title="Send">
          <Send size={16} />
        </button>
      </form>
    </aside>
  );
}

export default AssistantPanel;
