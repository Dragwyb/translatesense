/**
 * XmlConfigModal Component - Edit & Generate XML Rule Modal
 */

import { useState, useEffect } from '@wordpress/element';
import { DashboardIcons } from './DashboardIcons';

function injectXpathsIntoXml(xmlStr, xpathsText, builderType) {
  if (!xmlStr || builderType !== 'gutenberg') return xmlStr;
  const lines = (xpathsText || '').split('\n').map((l) => l.trim()).filter(Boolean);

  const blockRegex = /(<gutenberg-block\b[^>]*>)([\s\S]*?)(<\/gutenberg-block>)/i;
  const match = xmlStr.match(blockRegex);
  if (!match) return xmlStr;

  let openTag = match[1].replace(/\s+xpath=(?:"[^"]*"|'[^']*')/i, '');
  if (!/\btranslate=/i.test(openTag)) {
    openTag = openTag.replace(/>$/, ' translate="1">');
  }

  let inner = match[2];
  inner = inner.replace(/^\s*<xpath\b[^>]*>[\s\S]*?<\/xpath>\s*/gim, '');

  const xpathTags = lines.map((line) => {
    if (/^<xpath\b/i.test(line)) {
      return '            ' + line;
    }
    const attrMatch = line.match(/^([a-z_-]+="[^"]*")\s+(.*)$/i);
    if (attrMatch) {
      return '            <xpath ' + attrMatch[1] + '>' + attrMatch[2] + '</xpath>';
    }
    return '            <xpath>' + line + '</xpath>';
  });

  const xpathBlock = xpathTags.length > 0 ? '\n' + xpathTags.join('\n') + '\n            ' : '\n            ';
  const firstKeyIdx = inner.search(/<key\b/i);
  if (firstKeyIdx !== -1) {
    inner = inner.slice(0, firstKeyIdx).trimEnd() + xpathBlock + inner.slice(firstKeyIdx).trimStart();
  } else {
    inner = xpathBlock + inner.trim();
  }

  return xmlStr.replace(blockRegex, openTag + inner + match[3]);
}

export function XmlConfigModal({ widget, builder = 'gutenberg', xmlCode = '', onClose, onSave }) {
  const isGutenberg = builder === 'gutenberg';
  const [editorCode, setEditorCode] = useState(xmlCode || '');

  const getInitialXpaths = () => {
    if (widget && widget.xpaths && widget.xpaths.length > 0) {
      return widget.xpaths
        .map((x) => {
          if (typeof x === 'string') return x;
          const attrs = Object.keys(x)
            .filter((k) => k !== 'value')
            .map((k) => `${k}="${x[k]}"`)
            .join(' ');
          return attrs ? `<xpath ${attrs}>${x.value}</xpath>` : x.value;
        })
        .join('\n');
    }
    if (widget && widget.xpath) {
      return widget.xpath;
    }
    return '';
  };

  useEffect(() => {
    let initialCode = '';
    if (widget) {
      if (widget.xml_snippet) {
        initialCode = widget.xml_snippet;
      } else if (builder === 'gutenberg') {
        initialCode = `<?xml version="1.0" encoding="UTF-8"?>\n<wpml-config>\n    <gutenberg-blocks>\n        <gutenberg-block type="${widget.id}" translate="1">\n            <key name="content" type="text" editor_type="VISUAL" />\n        </gutenberg-block>\n    </gutenberg-blocks>\n</wpml-config>`;
      } else if (builder === 'elementor') {
        initialCode = `<?xml version="1.0" encoding="UTF-8"?>\n<wpml-config>\n    <elementor-widgets>\n        <widget name="${widget.id}">\n            <fields>\n                <field type="title" editor_type="LINE">title</field>\n            </fields>\n        </widget>\n    </elementor-widgets>\n</wpml-config>`;
      } else {
        initialCode = `<?xml version="1.0" encoding="UTF-8"?>\n<wpml-config>\n    <custom-fields>\n        <custom-field action="translate">${widget.id}</custom-field>\n    </custom-fields>\n</wpml-config>`;
      }

      if (isGutenberg) {
        const widgetXpaths = getInitialXpaths();
        if (widgetXpaths && !/<xpath\b/i.test(initialCode)) {
          initialCode = injectXpathsIntoXml(initialCode, widgetXpaths, builder);
        }
      }
    } else {
      initialCode = xmlCode || '';
    }

    setEditorCode(initialCode);
  }, [widget, builder, xmlCode, isGutenberg]);

  return (
    <div className="ts-modal-overlay" onClick={onClose}>
      <div className="ts-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="ts-modal-header">
          <h3>
            {widget
              ? `Configure XML: ${widget.name} (${builder.toUpperCase()})`
              : `Edit ${builder.toUpperCase()} Custom XML Configuration`}
          </h3>
          <button className="ts-modal-close" onClick={onClose} aria-label="Close">
            {DashboardIcons.close({ size: 16 })}
          </button>
        </div>

        <div className="ts-modal-body">
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: 0 }}>
            {isGutenberg
              ? 'Specify translation mappings and child <xpath> tags for GUTENBERG. When saved, this updates the active configuration.'
              : `Specify translation mappings for ${builder.toUpperCase()}. When saved, this updates the active configuration.`}
          </p>
          <textarea
            className="ts-xml-editor"
            style={{ height: '380px' }}
            value={editorCode}
            onChange={(e) => setEditorCode(e.target.value)}
            spellCheck="false"
          />
        </div>

        <div className="ts-modal-footer">
          <button type="button" className="ts-btn ts-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="ts-btn ts-btn-primary button-primary"
            onClick={() => onSave(editorCode)}
          >
            Save Config
          </button>
        </div>
      </div>
    </div>
  );
}
