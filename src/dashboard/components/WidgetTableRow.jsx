/**
 * WidgetTableRow Component - List View for Blocks / Widgets
 */

import { DashboardIcons } from './DashboardIcons';

export function WidgetTableRow({ widget, onEdit, onGenerate }) {
  const isSupported = widget.status !== 'unsupported';

  return (
    <tr>
      {/* Column 1: BLOCK / WIDGET NAME */}
      <td>
        <div className="ts-table-name-col">
          <span className="ts-table-widget-title">{widget.name}</span>
          <span className="ts-table-widget-slug">{widget.id}</span>
        </div>
      </td>

      {/* Column 2: CATEGORY */}
      <td>
        <span className="ts-category-text">{widget.category || 'standard'}</span>
      </td>

      {/* Column 3: MAPPED FIELDS */}
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span className={`ts-badge ts-badge-translate ${widget.field_count > 0 ? '' : 'empty'}`}>
            {`${widget.field_count || 0} Translate ${widget.field_count === 1 ? 'field' : 'fields'}`}
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
      </td>

      {/* Column 4: STATUS */}
      <td>
        {widget.status === 'supported' ? (
          <span className="ts-table-status supported">Supported</span>
        ) : widget.status === 'custom' ? (
          <span className="ts-table-status custom">Supported</span>
        ) : (
          <span className="ts-table-status unsupported">Unsupported</span>
        )}
      </td>

      {/* Column 5: ACTIONS */}
      <td style={{ textAlign: 'right' }}>
        {isSupported ? (
          <button
            type="button"
            className="ts-table-btn edit"
            onClick={() => onEdit(widget)}
            title="Edit XML rule directly"
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
            onClick={() => onGenerate(widget)}
            title="Generate XML configuration rule"
          >
            Generate
          </button>
        )}
      </td>
    </tr>
  );
}

