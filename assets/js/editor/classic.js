/**
 * TranslateSense - Classic WordPress Editor Live Updater
 * File: assets/js/editor/classic.js
 * 
 * Provides live synchronization and DOM node translation for Classic Editor:
 * - Updates post title input (#title)
 * - Updates post excerpt textarea (#excerpt) & TinyMCE excerpt instance
 * - Translates Classic Editor post content using DOM node & unit slice logic
 *   (preserving HTML structure, inline formatting, shortcodes, and non-translatable attributes)
 * - Injects translated content into TinyMCE (#content) & Textarea (#content)
 * - Syncs custom fields table (#postcustomstuff) & SEO metaboxes
 */

(function (window, document) {
  'use strict';

  const ClassicUpdater = {
    fieldRulesCache: null,

    /**
     * Leaf block tags that typically contain direct translatable text and inline elements.
     */
    LEAF_BLOCK_TAGS: [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figcaption',
      'td', 'th', 'dt', 'dd', 'caption', 'address', 'summary', 'hr'
    ],

    /**
     * Container block elements that group child elements.
     */
    CONTAINER_BLOCK_TAGS: [
      'div', 'section', 'article', 'aside', 'header', 'footer',
      'nav', 'main', 'figure', 'ul', 'ol', 'dl', 'table',
      'thead', 'tbody', 'tfoot', 'tr', 'details', 'center',
      'form', 'fieldset', 'blockquote', 'li'
    ],

    /**
     * HTML void / self-closing elements.
     */
    VOID_TAGS: [
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img',
      'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
    ],

    /**
     * Non-translatable elements whose inner content must be completely excluded from extraction.
     */
    EXCLUDED_TAGS: [
      'script', 'style', 'noscript', 'pre', 'svg', 'iframe',
      'object', 'embed', 'textarea', 'select', 'option',
      'template', 'canvas', 'audio', 'video'
    ],

    /**
     * HTML attributes that contain translatable human-readable text.
     */
    TRANSLATABLE_ATTRS: [
      'alt', 'title', 'aria-label', 'aria-description', 'placeholder'
    ],

    /**
     * Fetch custom field configuration rules parsed from editor-xml-config REST endpoint.
     */
    async getFieldRules() {
      if (this.fieldRulesCache) {
        return this.fieldRulesCache;
      }

      const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
      const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
      const nonce = config.nonce || '';

      try {
        const response = await fetch(restUrl + 'editor-xml-config?editor=classic', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': nonce,
          },
        });
        const data = await response.json();
        if (data && (data.field_rules || data.rules)) {
          this.fieldRulesCache = data.field_rules || data.rules;
          return this.fieldRulesCache;
        }
      } catch (err) {
        console.warn('[TranslateSense] Could not fetch /editor-xml-config?editor=classic:', err);
      }

      return {};
    },

    /**
     * Check if Classic Editor is active.
     */
    isActive() {
      return !!document.getElementById('postdivrich') || (!!document.getElementById('title') && !!document.getElementById('content'));
    },

    /**
     * Safely decode HTML entities into plain characters.
     */
    decodeHtmlEntities(str) {
      if (!str || typeof str !== 'string') return '';
      const txt = document.createElement('textarea');
      txt.innerHTML = str;
      return txt.value;
    },

    /**
     * Escape special HTML characters for safe attribute values.
     */
    escapeHtml(str) {
      if (!str || typeof str !== 'string') return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    /**
     * Check if a string contains readable human text outside shortcodes and tags.
     */
    hasTranslatableText(text) {
      if (!text || typeof text !== 'string') return false;
      // Strip shortcodes to avoid extracting pure shortcode blocks
      let clean = text.replace(/\[\/?[\w-]+(?:\s+[^\]]*)?\]/gs, '');
      // Strip HTML tags
      clean = clean.replace(/<[^>]*>/g, '');
      // Decode entities
      clean = this.decodeHtmlEntities(clean);
      // Strip non-breaking spaces and invisible characters
      clean = clean.replace(/[\s\u00a0\u200b\u200e\u200f]+/g, '');
      return clean.length > 0;
    },

    /**
     * Check if a tag name represents a recognized block-level element.
     */
    isBlockTag(tag, customBlocks = []) {
      if (!tag) return false;
      const t = tag.toLowerCase();
      return this.LEAF_BLOCK_TAGS.includes(t) ||
        this.CONTAINER_BLOCK_TAGS.includes(t) ||
        customBlocks.includes(t);
    },

    /**
     * Recursively check if a DOM element has child block elements.
     */
    hasChildBlocks(element, customBlocks = []) {
      if (!element || !element.children) return false;
      for (let i = 0; i < element.children.length; i++) {
        const child = element.children[i];
        const tag = child.tagName ? child.tagName.toLowerCase() : '';
        if (this.isBlockTag(tag, customBlocks) || this.hasChildBlocks(child, customBlocks)) {
          return true;
        }
      }
      return false;
    },

    /**
     * Find the offset and byte length of a target value in source HTML when entities or tag formatting differ.
     */
    findDecodedOffset(sourceHtml, targetVal, startFrom) {
      const targetTrimmed = (targetVal || '').trim();
      if (!targetTrimmed) return null;

      const directPos = sourceHtml.indexOf(targetTrimmed, startFrom);
      if (directPos !== -1) {
        return { offset: directPos, length: targetTrimmed.length };
      }

      const sub = sourceHtml.substring(startFrom);
      const pattern = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+/g;
      const tokens = [];
      let m;
      while ((m = pattern.exec(sub)) !== null) {
        tokens.push({ raw: m[0], offset: m.index, length: m[0].length });
      }

      const targetTokens = [];
      pattern.lastIndex = 0;
      while ((m = pattern.exec(targetTrimmed)) !== null) {
        targetTokens.push(m[0]);
      }

      const tCount = targetTokens.length;
      if (tCount === 0 || tCount > tokens.length) return null;

      for (let i = 0; i <= tokens.length - tCount; i++) {
        let match = true;
        for (let j = 0; j < tCount; j++) {
          const sTok = tokens[i + j].raw;
          const tTok = targetTokens[j];

          if (sTok && sTok[0] === '<') {
            const sTagNorm = sTok.toLowerCase().replace(/\s*\/\s*>$/, '>');
            const tTagNorm = tTok.toLowerCase().replace(/\s*\/\s*>$/, '>');
            if (sTagNorm !== tTagNorm) {
              match = false;
              break;
            }
          } else {
            const sDec = this.decodeHtmlEntities(sTok).trim();
            const tDec = this.decodeHtmlEntities(tTok).trim();
            if (sDec !== tDec) {
              match = false;
              break;
            }
          }
        }

        if (match) {
          const firstTok = tokens[i];
          const lastTok = tokens[i + tCount - 1];
          const start = startFrom + firstTok.offset;
          const length = (lastTok.offset + lastTok.length) - firstTok.offset;
          return { offset: start, length: length };
        }
      }

      return null;
    },

    /**
     * Extract translation units with exact source offsets from HTML content.
     * Matches the server-side Classic_Builder DOM extraction rules:
     * - Leaf blocks (p, h1-h6, figcaption, td, th, dt, dd, caption, address, summary, hr)
     * - Nested container elements traversed recursively
     * - wpautop double-newline paragraph separation for standalone text & inline flows
     * - Translatable attributes (alt, title, aria-label, etc.) outside extracted blocks
     * - Exclusion of non-translatable tags (script, style, pre, svg, iframe, etc.)
     * - Shortcode protection
     *
     * @param {string} html Source HTML content.
     * @param {Object} [customRules={}] Custom rules.
     * @returns {Array<Object>} Extracted units with offsets, lengths, names, keys, and values.
     */
    extractUnitsWithOffsets(html, customRules = {}) {
      if (!html || typeof html !== 'string' || !html.trim()) return [];

      const HTML_TOKEN_PATTERN = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+/g;
      const tokens = [];
      let m;
      while ((m = HTML_TOKEN_PATTERN.exec(html)) !== null) {
        tokens.push({
          raw: m[0],
          offset: m.index,
          length: m[0].length,
        });
      }

      const transAttrs = customRules.attributes && Array.isArray(customRules.attributes)
        ? Array.from(new Set([...this.TRANSLATABLE_ATTRS, ...customRules.attributes.map((a) => a.toLowerCase())]))
        : this.TRANSLATABLE_ATTRS;

      const excludedTags = customRules.exclude && Array.isArray(customRules.exclude)
        ? Array.from(new Set([...this.EXCLUDED_TAGS, ...customRules.exclude.map((t) => t.toLowerCase())]))
        : this.EXCLUDED_TAGS;

      // 1. Build tag boundaries from source token stream
      const elementsByTag = {};
      const stack = [];
      const autoClose = ['p', 'dt', 'dd', 'tr', 'td', 'th'];

      tokens.forEach((t) => {
        const raw = t.raw;
        const offset = t.offset;

        if (!raw || raw[0] !== '<' || raw.startsWith('<!--') || raw.startsWith('<!')) {
          return;
        }

        if (raw.startsWith('</')) {
          const match = raw.match(/^<\/([a-zA-Z0-9:_-]+)/);
          if (match) {
            const closeTag = match[1].toLowerCase();
            for (let k = stack.length - 1; k >= 0; k--) {
              if (stack[k].tag === closeTag) {
                const idx = stack[k].idx;
                elementsByTag[closeTag][idx].innerEnd = offset;
                elementsByTag[closeTag][idx].closeOffset = offset + raw.length;
                elementsByTag[closeTag][idx].rawInner = html.substring(elementsByTag[closeTag][idx].innerStart, offset);
                stack.splice(k);
                break;
              }
            }
          }
        } else {
          const match = raw.match(/^<([a-zA-Z0-9:_-]+)/);
          if (match) {
            const openTag = match[1].toLowerCase();
            const isSelf = this.VOID_TAGS.includes(openTag) || /\/\s*>$/.test(raw);

            if (!isSelf) {
              if (autoClose.includes(openTag)) {
                for (let k = stack.length - 1; k >= 0; k--) {
                  if (stack[k].tag === openTag) {
                    const idx = stack[k].idx;
                    elementsByTag[openTag][idx].innerEnd = offset;
                    elementsByTag[openTag][idx].closeOffset = offset;
                    elementsByTag[openTag][idx].rawInner = html.substring(elementsByTag[openTag][idx].innerStart, offset);
                    stack.splice(k);
                    break;
                  }
                }
              }

              if (!elementsByTag[openTag]) elementsByTag[openTag] = [];
              const idx = elementsByTag[openTag].length;
              elementsByTag[openTag].push({
                tagIdx: idx,
                tag: openTag,
                openOffset: offset,
                openRaw: raw,
                innerStart: offset + raw.length,
                innerEnd: html.length,
                closeOffset: html.length,
                rawInner: html.substring(offset + raw.length),
              });

              stack.push({ tag: openTag, idx: idx });
            }
          }
        }
      });

      while (stack.length > 0) {
        const popped = stack.pop();
        const ptag = popped.tag;
        const pidx = popped.idx;
        elementsByTag[ptag][pidx].rawInner = html.substring(
          elementsByTag[ptag][pidx].innerStart,
          elementsByTag[ptag][pidx].innerEnd
        );
      }

      // 2. DOM parsing with UTF-8 support
      let domUnits = [];
      if (typeof DOMParser !== 'undefined') {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString('<!DOCTYPE html><html><body>' + html + '</body></html>', 'text/html');
          const body = doc.body;

          if (body) {
            // Tag DOM elements with tag counter index to map back to elementsByTag
            const domTagCounters = {};
            const allDomNodes = body.querySelectorAll('*');
            allDomNodes.forEach((node) => {
              const dtag = node.tagName.toLowerCase();
              const cidx = domTagCounters[dtag] || 0;
              domTagCounters[dtag] = cidx + 1;
              node.setAttribute('data-ts-tag-idx', String(cidx));
            });

            const tempDiv = doc.createElement('div');

            const extractDomRecursive = (container, depth = 0) => {
              if (depth > 50) return;

              let inlineNodes = [];

              const flushInline = () => {
                if (inlineNodes.length === 0) return;

                let inlineHtml = '';
                inlineNodes.forEach((n) => {
                  if (n.nodeType === Node.ELEMENT_NODE) {
                    inlineHtml += n.outerHTML;
                  } else if (n.nodeType === Node.TEXT_NODE) {
                    tempDiv.textContent = '';
                    tempDiv.appendChild(n.cloneNode(true));
                    inlineHtml += tempDiv.innerHTML;
                  }
                });
                inlineNodes = [];

                inlineHtml = inlineHtml.replace(/\s*data-ts-tag-idx="[^"]*"/gi, '');

                // Split inline flow by blank lines (double newlines or wpautop breaks)
                const paras = inlineHtml.split(/(\r?\n\s*\r?\n)/u);
                paras.forEach((pHtml) => {
                  const trimmed = (pHtml || '').trim();
                  if (trimmed && this.hasTranslatableText(trimmed)) {
                    const tag = (container.nodeType === Node.ELEMENT_NODE && container.tagName.toLowerCase() !== 'body')
                      ? container.tagName.toLowerCase()
                      : 'text';
                    domUnits.push({
                      type: 'text',
                      name: 'classic_' + tag,
                      tag: tag,
                      value: trimmed,
                      node: (container.nodeType === Node.ELEMENT_NODE && container.tagName.toLowerCase() !== 'body') ? container : null,
                    });
                  }
                });
              };

              for (let i = 0; i < container.childNodes.length; i++) {
                const child = container.childNodes[i];
                if (child.nodeType === Node.ELEMENT_NODE) {
                  const childTag = child.tagName.toLowerCase();
                  if (excludedTags.includes(childTag)) {
                    flushInline();
                    continue;
                  }

                  if (this.isBlockTag(childTag, customRules.blocks || [])) {
                    flushInline();

                    if (this.hasChildBlocks(child, customRules.blocks || [])) {
                      extractDomRecursive(child, depth + 1);
                    } else {
                      let inner = (child.innerHTML || '').trim();
                      inner = inner.replace(/\s*data-ts-tag-idx="[^"]*"/gi, '').trim();
                      if (inner && this.hasTranslatableText(inner)) {
                        domUnits.push({
                          type: 'block',
                          name: 'classic_' + childTag,
                          tag: childTag,
                          value: inner,
                          node: child,
                        });
                      }
                    }
                  } else {
                    inlineNodes.push(child);
                  }
                } else if (child.nodeType === Node.TEXT_NODE) {
                  inlineNodes.push(child);
                }
              }

              flushInline();
            };

            extractDomRecursive(body, 0);
          }
        } catch (e) {
          console.warn('[TranslateSense] DOMParser extraction warning, falling back to token flow:', e);
          domUnits = [];
        }
      }

      // 3. Correlate DOM units to exact source slices
      const units = [];
      const tagOccurrenceCounters = {};
      const extractedRanges = [];
      let sourcePos = 0;

      if (domUnits.length > 0) {
        domUnits.forEach((du) => {
          const tag = du.tag;
          const count = tagOccurrenceCounters[tag] || 0;
          tagOccurrenceCounters[tag] = count + 1;
          const key = `post_content>${tag}[${count}]`;

          const tagIdxAttr = du.node && typeof du.node.getAttribute === 'function'
            ? du.node.getAttribute('data-ts-tag-idx')
            : null;
          const tagIdx = tagIdxAttr !== null ? parseInt(tagIdxAttr, 10) : null;

          if (tagIdx !== null && !isNaN(tagIdx) && elementsByTag[tag] && elementsByTag[tag][tagIdx]) {
            const slice = elementsByTag[tag][tagIdx];
            const rawInner = slice.rawInner;

            // Direct match
            if (rawInner === du.value) {
              const start = slice.innerStart;
              const len = rawInner.length;
              units.push({
                type: du.type,
                name: du.name,
                key: key,
                tag: tag,
                offset: start,
                length: len,
                value: du.value,
                source: rawInner,
              });
              extractedRanges.push([start, start + len]);
              sourcePos = start + len;
              return;
            }

            // Substring match in rawInner
            const posInInner = rawInner.indexOf(du.value);
            if (posInInner !== -1) {
              const start = slice.innerStart + posInInner;
              const len = du.value.length;
              units.push({
                type: du.type,
                name: du.name,
                key: key,
                tag: tag,
                offset: start,
                length: len,
                value: du.value,
                source: html.substring(start, start + len),
              });
              extractedRanges.push([start, start + len]);
              sourcePos = start + len;
              return;
            }

            // Trimmed whitespace match
            const leadMatch = rawInner.match(/^\s+/);
            const leadWs = leadMatch ? leadMatch[0].length : 0;
            const trailMatch = rawInner.match(/\s+$/);
            const trailWs = trailMatch ? trailMatch[0].length : 0;

            const start = slice.innerStart + leadWs;
            const len = rawInner.length - leadWs - trailWs;

            if (len > 0) {
              const exactSource = html.substring(start, start + len);
              units.push({
                type: du.type,
                name: du.name,
                key: key,
                tag: tag,
                offset: start,
                length: len,
                value: exactSource,
                source: exactSource,
              });
              extractedRanges.push([start, start + len]);
              sourcePos = start + len;
              return;
            }
          }

          // Standalone paragraph or text run
          let val = du.value;
          let pos = html.indexOf(val, sourcePos);
          let foundLen = val.length;

          if (pos === -1) {
            const decoded = this.findDecodedOffset(html, val, sourcePos);
            if (decoded) {
              pos = decoded.offset;
              foundLen = decoded.length;
              val = html.substring(pos, pos + foundLen);
            }
          }

          if (pos !== -1) {
            units.push({
              type: du.type,
              name: du.name,
              key: key,
              tag: tag,
              offset: pos,
              length: foundLen,
              value: val,
              source: html.substring(pos, pos + foundLen),
            });
            extractedRanges.push([pos, pos + foundLen]);
            sourcePos = pos + foundLen;
          }
        });
      }

      // 4. Extract translatable HTML attributes ONLY from elements outside extracted block units
      const attrCounters = {};
      tokens.forEach((token) => {
        const raw = token.raw;
        const tagOffset = token.offset;

        if (!raw || raw[0] !== '<' || raw.startsWith('<!--') || raw.startsWith('</') || raw.startsWith('<!')) {
          return;
        }

        const match = raw.match(/^<([a-zA-Z0-9:_-]+)/);
        if (!match) return;

        const tagName = match[1].toLowerCase();
        if (excludedTags.includes(tagName)) return;

        const tagEnd = tagOffset + raw.length;
        let insideExtractedBlock = false;
        for (const range of extractedRanges) {
          if (tagOffset >= range[0] && tagEnd <= range[1]) {
            insideExtractedBlock = true;
            break;
          }
        }
        if (insideExtractedBlock) return;

        transAttrs.forEach((attrName) => {
          const attrPattern = new RegExp(`(?<![\\w:-])(${attrName})(\\s*=\\s*)(["'])([\\s\\S]*?)\\3`, 'gi');
          let attrMatch;
          while ((attrMatch = attrPattern.exec(raw)) !== null) {
            const val = attrMatch[4];
            const decodedVal = this.decodeHtmlEntities(val);

            if (decodedVal && decodedVal.trim() && this.hasTranslatableText(decodedVal)) {
              const valOffset = tagOffset + attrMatch.index + attrMatch[1].length + attrMatch[2].length + 1;
              const valLength = val.length;

              const counterKey = `${tagName}@${attrName}`;
              const count = attrCounters[counterKey] || 0;
              attrCounters[counterKey] = count + 1;

              units.push({
                type: 'attribute',
                name: `classic_attr_${attrName.toLowerCase()}`,
                key: `post_content>${tagName}[${count}]@${attrName}`,
                tag: tagName,
                attr: attrName,
                offset: valOffset,
                length: valLength,
                value: decodedVal.trim(),
                source: val,
              });
            }
          }
        });
      });

      return units;
    },

    /**
     * Translate Classic Editor HTML content using DOM node & unit slice logic.
     * Replaces translatable units at exact source slice boundaries, preserving
     * surrounding HTML, formatting, non-translatable attributes, and shortcodes.
     *
     * @param {string} html Raw post content string.
     * @param {Array<Object>} strings Array of translated string objects.
     * @param {Object} [options={}] Options including provider and core instance.
     * @returns {string} Translated HTML content.
     */
    translateContent(html, strings, options = {}) {
      if (!html || typeof html !== 'string' || !html.trim()) {
        return html;
      }
      if (!Array.isArray(strings) || strings.length === 0) {
        return html;
      }

      const provider = options.provider || this.provider || '';
      const core = this.core || options.core || (typeof window.TranslateSenseCore === 'object' ? window.TranslateSenseCore : null);

      // Normalize a string for robust comparison (handles HTML entities & whitespace)
      const normalize = (str) => {
        if (!str || typeof str !== 'string') return '';
        const dec = this.decodeHtmlEntities(str);
        return dec.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
      };

      // Build quick lookup structures
      const stringsByKeyAndValue = new Map();
      const stringsByValueQueue = new Map();

      strings.forEach((s) => {
        const trans = (s.translated || s.translate || '').trim();
        if (!trans) return;

        const val = (typeof s.value === 'string') ? s.value : '';
        const src = (typeof s.source === 'string') ? s.source : '';
        const normVal = normalize(val);
        const normSrc = normalize(src);

        if (s.key && normVal) {
          stringsByKeyAndValue.set(`${s.key}:::${normVal}`, s.translated || s.translate);
        }

        if (normVal) {
          if (!stringsByValueQueue.has(normVal)) {
            stringsByValueQueue.set(normVal, []);
          }
          stringsByValueQueue.get(normVal).push({
            trans: s.translated || s.translate,
            key: s.key || '',
            name: s.name || '',
            tag: s.tag || '',
            used: false,
          });
        }

        if (normSrc && normSrc !== normVal) {
          if (!stringsByValueQueue.has(normSrc)) {
            stringsByValueQueue.set(normSrc, []);
          }
          stringsByValueQueue.get(normSrc).push({
            trans: s.translated || s.translate,
            key: s.key || '',
            name: s.name || '',
            tag: s.tag || '',
            used: false,
          });
        }
      });

      const resolveTrans = (unit) => {
        const origVal = unit.value;
        const normOrig = normalize(origVal);
        if (!normOrig) return null;

        // 1. Key + exact normalized value match (100% unambiguous 1:1 match)
        const kvKey = `${unit.key}:::${normOrig}`;
        if (stringsByKeyAndValue.has(kvKey)) {
          return stringsByKeyAndValue.get(kvKey);
        }

        // 2. Value match from queue (preferring same tag/name or key)
        if (stringsByValueQueue.has(normOrig)) {
          const candidates = stringsByValueQueue.get(normOrig);
          // Prefer matching name/tag or key
          for (const item of candidates) {
            if (!item.used && (item.name === unit.name || item.tag === unit.tag || item.key === unit.key)) {
              item.used = true;
              return item.trans;
            }
          }
          // Otherwise take first unused candidate in document order
          for (const item of candidates) {
            if (!item.used) {
              item.used = true;
              return item.trans;
            }
          }
          // If all candidates are used (e.g. repeated exact phrases), reuse the first
          return candidates[0].trans;
        }

        // 3. Fallback to core.getTranslatedString by value
        if (core && typeof core.getTranslatedString === 'function') {
          const trans = core.getTranslatedString(unit.name || 'generic', origVal.trim(), provider, unit.name);
          if (trans && (trans.translate || typeof trans === 'string')) {
            return trans.translate || trans;
          }
        }

        return null;
      };

      // 1. Extract translation units with exact character offsets
      const units = this.extractUnitsWithOffsets(html);
      if (!units || units.length === 0) {
        return html;
      }

      const replacements = [];

      units.forEach((unit) => {
        const origVal = unit.value;
        if (!origVal || !origVal.trim()) return;

        const trans = resolveTrans(unit);
        if (trans && trans !== origVal && trans.trim()) {
          const replacementStr = (unit.type === 'attribute' || (unit.name && unit.name.startsWith('classic_attr_')))
            ? this.escapeHtml(trans)
            : trans;

          replacements.push({
            offset: unit.offset,
            length: unit.length,
            replacement: replacementStr,
          });
        }
      });

      if (replacements.length === 0) {
        return html;
      }

      // Sort replacements descending by offset so replacements don't shift earlier offsets
      replacements.sort((a, b) => {
        if (b.offset === a.offset) {
          return b.length - a.length;
        }
        return b.offset - a.offset;
      });

      // Apply replacements sequentially from back to front, ensuring non-overlapping ranges
      let translatedContent = html;
      const contentLen = html.length;
      let lastAppliedStart = Infinity;

      for (const r of replacements) {
        const rStart = r.offset;
        const rLen = r.length;
        const rEnd = rStart + rLen;

        // Skip invalid ranges or overlapping slices
        if (rStart < 0 || rLen <= 0 || rEnd > contentLen || rEnd > lastAppliedStart) {
          continue;
        }

        translatedContent = translatedContent.slice(0, rStart) + r.replacement + translatedContent.slice(rEnd);
        lastAppliedStart = rStart;
      }

      return translatedContent;
    },

    /**
     * Backward-compatibility wrapper for updating fields.
     */
    updatePostFields(strings) {
      if (!Array.isArray(strings)) return;
      this.apply(strings);
    },

    /**
     * Apply translations live to Classic Editor.
     *
     * @param {Array<Object>} strings Translated strings array.
     * @param {Object} [options={}] Options including sourcePageData, provider, and core.
     */
    apply(strings, options = {}) {
      if (!this.isActive() || !Array.isArray(strings)) return;

      this.provider = options.provider || (options.options && options.options.provider) || this.provider || '';
      if (options.core) {
        this.core = options.core;
      } else if (options.options && options.options.core) {
        this.core = options.options.core;
      }

      const sourceData = options.sourcePageData || (options.options && options.options.sourcePageData) || null;

      // 1. Resolve Title and Excerpt translations
      let title = '';
      let excerpt = '';

      strings.forEach((s) => {
        const field = (s.field || s.name || s.key || '').toLowerCase();
        const translated = (s.translated || s.translate || '').trim();
        if (!translated) return;

        if (field === 'post_title' || field === 'title') {
          title = translated;
        } else if (field === 'post_excerpt' || field === 'excerpt') {
          excerpt = translated;
        }
      });

      // Update Title input (#title)
      if (title) {
        const titleInput = document.querySelector('input#title[name="post_title"], input#title');
        if (titleInput) {
          titleInput.value = title;
          titleInput.dispatchEvent(new Event('input', { bubbles: true }));
          titleInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // Update Excerpt textarea (#excerpt) & TinyMCE excerpt instance
      if (excerpt) {
        const excerptEl = document.querySelector('textarea#excerpt');
        if (excerptEl) {
          excerptEl.value = excerpt;
          excerptEl.dispatchEvent(new Event('input', { bubbles: true }));
          excerptEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (window.tinymce && window.tinymce.get('excerpt')) {
          window.tinymce.get('excerpt').setContent(excerpt);
        }
      }

      // 2. Resolve source content to translate
      let rawContent = '';
      if (sourceData && typeof sourceData.content === 'string' && sourceData.content.trim()) {
        rawContent = sourceData.content;
      } else if (window.tinymce && window.tinymce.get('content') && window.tinymce.get('content').getContent()) {
        rawContent = window.tinymce.get('content').getContent();
      } else {
        const contentArea = document.querySelector('textarea#content');
        if (contentArea && contentArea.value) {
          rawContent = contentArea.value;
        }
      }

      // 3. Translate content using DOM node & unit slice logic
      if (rawContent) {
        const translatedContent = this.translateContent(rawContent, strings, options);

        if (translatedContent) {
          // Update Textarea (#content)
          const contentArea = document.querySelector('textarea#content');
          if (contentArea) {
            contentArea.value = translatedContent;
            contentArea.dispatchEvent(new Event('input', { bubbles: true }));
            contentArea.dispatchEvent(new Event('change', { bubbles: true }));
          }

          // Update TinyMCE Visual Editor (#content)
          if (window.tinymce && window.tinymce.get('content')) {
            const editor = window.tinymce.get('content');
            editor.setContent(translatedContent);
            editor.fire('change');
            editor.fire('input');
            if (typeof editor.setDirty === 'function') {
              editor.setDirty(true);
            }
          }
        }
      }

      // 4. Update Custom Fields & Meta Box inputs (Yoast, Rank Math, ACF, standard fields)
      if (window.TranslateSenseMetaUpdater && typeof window.TranslateSenseMetaUpdater.apply === 'function') {
        window.TranslateSenseMetaUpdater.apply(strings);
      }

      // 5. Emit WordPress success notice if notices API is available
      if (window.wp && window.wp.data && window.wp.data.dispatch && window.wp.data.dispatch('core/notices')) {
        window.wp.data.dispatch('core/notices').createSuccessNotice(
          'Translations applied to Classic Editor successfully!',
          { type: 'snackbar', isDismissible: true }
        );
      }
    },
  };

  // Register Classic Editor on a TranslateSenseCore instance
  ClassicUpdater.register = function (core) {
    if (!core || typeof core.registerPageEditor !== 'function') return;
    this.core = core;
    core.registerPageEditor('classic', {
      title: 'Classic WordPress Editor',
      isActive: () => ClassicUpdater.isActive(),
      apply: (strings, options) => ClassicUpdater.apply(strings, options),
    });
  };

  // Backward compatibility: If window.TranslateSenseCore is an instantiated object
  if (window.TranslateSenseCore && typeof window.TranslateSenseCore.registerPageEditor === 'function') {
    ClassicUpdater.register(window.TranslateSenseCore);
  }

  window.TranslateSenseClassicUpdater = ClassicUpdater;
})(window, document);
