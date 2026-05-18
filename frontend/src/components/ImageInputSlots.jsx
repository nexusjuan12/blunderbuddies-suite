function ImageInputSlots({ slots = [] }) {
  return (
    <div className="input-slots">
      {slots.length === 0 && <div className="empty-state">No image input slots.</div>}
      {slots.map((slot, index) => (
        <div className="slot-row" key={slot.id || index}>
          <span className="slot-index">{index + 1}</span>
          <input value={slot.label || ""} readOnly />
        </div>
      ))}
    </div>
  );
}

export default ImageInputSlots;

