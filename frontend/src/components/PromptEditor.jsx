function PromptEditor({ value, onChange, placeholder = "Write a generation prompt" }) {
  return <textarea className="prompt-editor" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
}

export default PromptEditor;

