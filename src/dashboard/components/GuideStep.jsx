/**
 * GuideStep Component - Vertical Timeline Step Item
 */

export function GuideStep({ number, title, description, screenshot, note }) {
  return (
    <div className="ts-timeline-step">
      <div className="ts-timeline-axis">
        <div className="ts-timeline-circle">{number}</div>
        <div className="ts-timeline-track" />
      </div>
      <div className="ts-timeline-body">
        <h4 className="ts-timeline-title">{title}</h4>
        <p className="ts-timeline-desc">{description}</p>

        {screenshot && (
          <div className="ts-screenshot-placeholder">
            <div className="ts-screenshot-icon-box">
              <span className="dashicons dashicons-format-image" />
            </div>
            <div className="ts-screenshot-info">
              <span className="ts-screenshot-label">Screenshot Reference</span>
              <span className="ts-screenshot-caption">{screenshot}</span>
            </div>
          </div>
        )}

        {note && (
          <div className="ts-timeline-note">
            <span className="dashicons dashicons-info ts-timeline-note-icon" />
            <span className="ts-timeline-note-text">{note}</span>
          </div>
        )}
      </div>
    </div>
  );
}

