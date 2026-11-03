/**
 * WidgetCard Component - Grid View for Blocks / Widgets
 */

import { DashboardIcons } from './DashboardIcons';

export function WidgetCard({ widget, activeTab, onEdit, onGenerate }) {
  const isSupported = widget.status !== 'unsupported';

  return (
    <div className="ts-widget-card">
      <div className="ts-card-top">
        <div>
          <h3 className="ts-card-title">{widget.name}</h3>
          <div className="ts-card-slug">{widget.id}</div>
        </div>
        <span className={`ts-table-status ${widget.status}`}>
          {widget.status === 'supported' ? 'Supported' : widget.status === 'custom' ? 'Custom' : 'Unsupported'}
        </span>
      </div>

      <div className="ts-card-meta">
        <span>{`Category: ${widget.category || 'Standard'}`}</span>
        <span>•</span>
        <span className={`ts-badge ts-badge-translate ${widget.field_count > 0 ? '' : 'empty'}`}>
          {`${widget.field_count || 0} Translate ${widget.field_count === 1 ? 'Field' : 'Fields'}`}
        </span>
        {widget.no_translate_count > 0 && (
          <span className="ts-badge ts-badge-no-translate">
            {`${widget.no_translate_count} No Translate`}
          </span>
        )}
        {((widget.xpaths && widget.xpaths.length > 0) || widget.xpath) && (
          <span
            className="ts-badge ts-badge-xpath"
            title={
              widget.xpaths && widget.xpaths.length > 0
                ? widget.xpaths.map((x) => (x.type ? `[${x.type}] ${x.value}` : x.value)).join('\n')
                : `XPath: ${widget.xpath}`
            }
          >
            {widget.xpaths && widget.xpaths.length > 0 && `${widget.xpaths.length} XPaths`}
          </span>
        )}
      </div>

      <div className="ts-card-actions">
        {isSupported ? (
          <button
            type="button"
            className="ts-table-btn edit"
            style={{ width: '100%' }}
            onClick={() => onEdit(widget)}
          >
            <span style={{ display: 'inline-flex', marginRight: '5px' }}>
              {DashboardIcons.pencil({ size: 12 })}
            </span>
            Edit Config
          </button>
        ) : (
          <button
            type="button"
            className="ts-table-btn generate"
            style={{ width: '100%' }}
            onClick={() => onGenerate(widget)}
          >
            Generate
          </button>
        )}
      </div>
    </div>
  );
}

