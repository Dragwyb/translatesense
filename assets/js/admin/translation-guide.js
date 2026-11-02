/**
 * TranslateSense - Interactive Translation Guide
 * Uses native WordPress JavaScript runtime (wp.element: createElement, Fragment, useState).
 *
 * Provides a single-row selectable option card selector for:
 * 1. Gutenberg
 * 2. Classic
 * 3. Elementor
 * 4. Bulk Translation
 */

(function (wp) {
  'use strict';

  if (!wp || !wp.element) {
    return;
  }

  const { createElement: e, Fragment, useState } = wp.element;
  const __ = (wp.i18n && wp.i18n.__) ? wp.i18n.__ : (text) => text;

  // Selected state radio check icon (blue circle with checkmark)
  const RadioCheckIcon = (size = 18) =>
    e('svg', {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      className: 'ts-radio-icon checked',
      'aria-hidden': 'true',
    },
      e('circle', { cx: 12, cy: 12, r: 10, stroke: '#2563eb', strokeWidth: 2, fill: 'rgba(37, 99, 235, 0.08)' }),
      e('path', { d: 'M8 12.5l2.5 2.5 5.5-5.5', stroke: '#2563eb', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' })
    );

  // Unselected state radio circle icon (neutral gray circular disc)
  const RadioUncheckedIcon = (size = 18) =>
    e('svg', {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      className: 'ts-radio-icon unchecked',
      'aria-hidden': 'true',
    },
      e('circle', { cx: 12, cy: 12, r: 7.5, fill: '#cbd5e1' })
    );

  // Crisp SVG Camera / Image Icon for Screenshot Placeholder
  const CameraIcon = (size = 15) =>
    e('svg', {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
      e('path', { d: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z' }),
      e('circle', { cx: 12, cy: 13, r: 4 })
    );

  // Info Icon for Notes
  const InfoIcon = (size = 14) =>
    e('svg', {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2.2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
      e('circle', { cx: 12, cy: 12, r: 10 }),
      e('line', { x1: 12, y1: 16, x2: 12, y2: 12 }),
      e('line', { x1: 12, y1: 8, x2: 12.01, y2: 8 })
    );

  // Guide Data Definition
  const GUIDES_DATA = {
    gutenberg: {
      id: 'gutenberg',
      title: __('Gutenberg Block Editor Translation', 'translatesense'),
      description: __('Follow these simple steps to translate your Gutenberg posts and pages while preserving all blocks and formatting.', 'translatesense'),
      importantNote: __('The generated translation is not applied to the page until you click Apply To Page.', 'translatesense'),
      steps: [
        {
          number: 1,
          title: __('Open Language Creation', 'translatesense'),
          description: __('Navigate to Pages → All Pages and click the + (Add Language) icon in the page row.', 'translatesense'),
          screenshot: __('Pages list showing the + (Add Language) icon in Polylang columns', 'translatesense'),
        },
        {
          number: 2,
          title: __('Automatic Translation Popup', 'translatesense'),
          description: __('Continue using the Automatic Translation – Translate Page Content popup by clicking Continue to Translate.', 'translatesense'),
          screenshot: __('Automatic Translation dialog with Continue to Translate button', 'translatesense'),
        },
        {
          number: 3,
          title: __('Open Page in Gutenberg', 'translatesense'),
          description: __('If the popup does not appear or was closed, open the translated page in Gutenberg.', 'translatesense'),
        },
        {
          number: 4,
          title: __('Locate TranslateSense Metabox', 'translatesense'),
          description: __('Locate the TranslateSense metabox in the right sidebar, above the Polylang language metabox.', 'translatesense'),
          screenshot: __('Right editor sidebar with TranslateSense metabox above Polylang', 'translatesense'),
        },
        {
          number: 5,
          title: __('Click Auto Translate', 'translatesense'),
          description: __('Click Auto Translate to initialize content block extraction.', 'translatesense'),
        },
        {
          number: 6,
          title: __('Select AI Provider & Start', 'translatesense'),
          description: __('Select an AI provider and click Start Translation.', 'translatesense'),
        },
        {
          number: 7,
          title: __('Wait for Translation', 'translatesense'),
          description: __('Wait for translation to finish. Translatable content is mapped and cached strings are reused.', 'translatesense'),
        },
        {
          number: 8,
          title: __('Apply Generated Translation', 'translatesense'),
          description: __('Click Apply To Page to apply the generated translation.', 'translatesense'),
          note: __('The generated translation is not applied to the page until you click Apply To Page.', 'translatesense'),
        },
      ],
    },
    classic: {
      id: 'classic',
      title: __('Classic Editor (WYSIWYG) Translation', 'translatesense'),
      description: __('Translate traditional WordPress content, WooCommerce descriptions, and custom post types using the Classic Editor.', 'translatesense'),
      importantNote: __('Classic Editor support includes WooCommerce content and supported custom post types.', 'translatesense'),
      steps: [
        {
          number: 1,
          title: __('Open Content Listing', 'translatesense'),
          description: __('Open the relevant content listing and click + (Add Language).', 'translatesense'),
        },
        {
          number: 2,
          title: __('Continue via Popup', 'translatesense'),
          description: __('Continue using the initial automatic translation popup.', 'translatesense'),
        },
        {
          number: 3,
          title: __('Open in Classic Editor', 'translatesense'),
          description: __('If the popup does not appear or was closed, open the translated content in the Classic Editor.', 'translatesense'),
        },
        {
          number: 4,
          title: __('Locate Auto Translate Button', 'translatesense'),
          description: __('Locate Auto Translate above the Add Media button in the WYSIWYG editor.', 'translatesense'),
          screenshot: __('Classic Editor toolbar showing Auto Translate above Add Media', 'translatesense'),
        },
        {
          number: 5,
          title: __('Click Auto Translate', 'translatesense'),
          description: __('Click Auto Translate.', 'translatesense'),
        },
        {
          number: 6,
          title: __('Select AI Provider & Start', 'translatesense'),
          description: __('Select an AI provider and click Start Translation.', 'translatesense'),
        },
        {
          number: 7,
          title: __('Wait for Translation', 'translatesense'),
          description: __('Wait for translation to finish.', 'translatesense'),
        },
        {
          number: 8,
          title: __('Apply Translation', 'translatesense'),
          description: __('Click Apply To Page.', 'translatesense'),
          note: __('Classic Editor support includes WooCommerce content and supported custom post types.', 'translatesense'),
        },
      ],
    },
    elementor: {
      id: 'elementor',
      title: __('Elementor Page Builder Translation', 'translatesense'),
      description: __('Translate visual Elementor layouts, custom widgets, and styled sections seamlessly without losing design hierarchy.', 'translatesense'),
      importantNote: __('The generated translation is not applied to the page until you click Apply To Page.', 'translatesense'),
      steps: [
        {
          number: 1,
          title: __('Navigate to Pages', 'translatesense'),
          description: __('Navigate to Pages → All Pages and click + (Add Language).', 'translatesense'),
        },
        {
          number: 2,
          title: __('Continue via Popup', 'translatesense'),
          description: __('Continue using the initial automatic translation popup.', 'translatesense'),
        },
        {
          number: 3,
          title: __('Open Page in Elementor', 'translatesense'),
          description: __('If the popup does not appear or was closed, open the translated page using Elementor.', 'translatesense'),
        },
        {
          number: 4,
          title: __('Locate Header Button', 'translatesense'),
          description: __('Locate Auto Translate in the Elementor editor header.', 'translatesense'),
          screenshot: __('Elementor header panel with TranslateSense Auto Translate button', 'translatesense'),
        },
        {
          number: 5,
          title: __('Click Auto Translate', 'translatesense'),
          description: __('Click Auto Translate.', 'translatesense'),
        },
        {
          number: 6,
          title: __('Select AI Provider & Start', 'translatesense'),
          description: __('Select an AI provider and click Start Translation.', 'translatesense'),
        },
        {
          number: 7,
          title: __('Wait for Translation', 'translatesense'),
          description: __('Wait for translation to finish.', 'translatesense'),
        },
        {
          number: 8,
          title: __('Apply Generated Translation', 'translatesense'),
          description: __('Click Apply To Page.', 'translatesense'),
          note: __('The generated translation is not applied to the page until you click Apply To Page.', 'translatesense'),
        },
      ],
    },
    bulk: {
      id: 'bulk',
      title: __('Bulk Translation (Batch Queue)', 'translatesense'),
      description: __('Translate multiple posts and pages in a single batch with real-time background progress monitoring.', 'translatesense'),
      importantNote: __('Translations are queued and processed safely in the background. You can monitor live progress and cancel or skip at any time.', 'translatesense'),
      steps: [
        {
          number: 1,
          title: __('Navigate to Content Listing', 'translatesense'),
          description: __('Navigate to Pages → All Pages or Posts → All Posts.', 'translatesense'),
        },
        {
          number: 2,
          title: __('Select Multiple Items', 'translatesense'),
          description: __('Select multiple pages or posts using the table checkboxes.', 'translatesense'),
        },
        {
          number: 3,
          title: __('Click Bulk Translation Button', 'translatesense'),
          description: __('Click Bulk Translation, available above and below the list table after the page filter options.', 'translatesense'),
          screenshot: __('List table navigation showing the Translate button', 'translatesense'),
        },
        {
          number: 4,
          title: __('Select Target Languages', 'translatesense'),
          description: __('Select one or more target languages.', 'translatesense'),
        },
        {
          number: 5,
          title: __('Choose Provider Step', 'translatesense'),
          description: __('Click Next: Choose Provider.', 'translatesense'),
        },
        {
          number: 6,
          title: __('Select AI Provider', 'translatesense'),
          description: __('Select an AI provider in the provider modal.', 'translatesense'),
        },
        {
          number: 7,
          title: __('Start Bulk Translation', 'translatesense'),
          description: __('Click Start Bulk Translation.', 'translatesense'),
        },
        {
          number: 8,
          title: __('Progress Modal Appears', 'translatesense'),
          description: __('The bulk translation progress modal appears.', 'translatesense'),
        },
        {
          number: 9,
          title: __('Monitor Live Progress', 'translatesense'),
          description: __('Monitor live translation progress in the modal.', 'translatesense'),
        },
        {
          number: 10,
          title: __('Review Summary Breakdown', 'translatesense'),
          description: __('Review successful, failed and incomplete translations after completion.', 'translatesense'),
          note: __('Translations are linked in Polylang automatically. Taxonomies, categories, and post meta are synchronized.', 'translatesense'),
        },
      ],
    },
  };

  const METHODS_CONFIG = [
    { id: 'gutenberg', label: __('Gutenberg', 'translatesense') },
    { id: 'classic', label: __('Classic', 'translatesense') },
    { id: 'elementor', label: __('Elementor', 'translatesense') },
    { id: 'bulk', label: __('Bulk Translation', 'translatesense') },
  ];

  /**
   * Accessible 4-Method Single-Row Selector Component
   */
  function GuideMethodSelector({ activeTab, onChange }) {
    const handleKeyDown = (e, index) => {
      let nextIndex = null;
      if (e.key === 'ArrowRight') {
        nextIndex = (index + 1) % METHODS_CONFIG.length;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (index - 1 + METHODS_CONFIG.length) % METHODS_CONFIG.length;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = METHODS_CONFIG.length - 1;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        const nextTab = METHODS_CONFIG[nextIndex];
        onChange(nextTab.id);
        const nextBtn = document.getElementById(`ts-method-card-${nextTab.id}`);
        if (nextBtn) {
          nextBtn.focus();
        }
      }
    };

    return e(
      'div',
      {
        className: 'ts-guide-options-row',
        role: 'radiogroup',
        'aria-label': __('Choose a translation method', 'translatesense'),
      },
      METHODS_CONFIG.map((method, idx) => {
        const isActive = activeTab === method.id;
        return e(
          'button',
          {
            key: method.id,
            type: 'button',
            id: `ts-method-card-${method.id}`,
            role: 'radio',
            'aria-checked': isActive ? 'true' : 'false',
            'aria-controls': `ts-guide-panel-${method.id}`,
            tabIndex: isActive ? 0 : -1,
            className: `ts-method-card ${isActive ? 'active' : ''}`,
            onClick: () => onChange(method.id),
            onKeyDown: (e) => handleKeyDown(e, idx),
          },
          isActive ? RadioCheckIcon(18) : RadioUncheckedIcon(18),
          e('span', { className: 'ts-method-card-label' }, method.label)
        );
      })
    );
  }

  /**
   * Reusable Step Component with Vertical Timeline Node
   */
  function GuideStep({ number, title, description, screenshot, note }) {
    return e(
      'div',
      { className: 'ts-timeline-step' },

      // Left column: Node circle (as shown in provided image) and connecting line
      e(
        'div',
        { className: 'ts-timeline-axis', 'aria-hidden': 'true' },
        e('div', { className: 'ts-timeline-circle' }, number),
        e('div', { className: 'ts-timeline-track' })
      ),

      // Right column: Step content
      e(
        'div',
        { className: 'ts-timeline-body' },
        e('h4', { className: 'ts-timeline-title' }, title),
        e('p', { className: 'ts-timeline-desc' }, description),

        // Optional screenshot placeholder with caption
        screenshot &&
        e(
          'div',
          { className: 'ts-screenshot-placeholder' },
          e(
            'div',
            { className: 'ts-screenshot-icon-box' },
            CameraIcon(15)
          ),
          e(
            'div',
            { className: 'ts-screenshot-info' },
            e('span', { className: 'ts-screenshot-label' }, __('Screenshot Reference', 'translatesense')),
            e('span', { className: 'ts-screenshot-caption' }, screenshot)
          )
        ),

        // Optional note callout
        note &&
        e(
          'div',
          { className: 'ts-timeline-note' },
          e('span', { className: 'ts-timeline-note-icon' }, InfoIcon(14)),
          e('span', { className: 'ts-timeline-note-text' }, note)
        )
      )
    );
  }

  /**
   * Guide Content Panel for Active Tab
   */
  function GuideContent({ activeTab }) {
    const guide = GUIDES_DATA[activeTab] || GUIDES_DATA.gutenberg;

    return e(
      'div',
      {
        id: `ts-guide-panel-${guide.id}`,
        role: 'tabpanel',
        'aria-labelledby': `ts-method-card-${guide.id}`,
        tabIndex: 0,
        className: 'ts-guide-panel',
      },

      // Panel Header
      e(
        'div',
        { className: 'ts-guide-panel-header' },
        e('h3', { className: 'ts-guide-panel-title' }, guide.title),
        e('p', { className: 'ts-guide-panel-desc' }, guide.description)
      ),

      // Vertical Timeline Steps Container
      e(
        'div',
        { className: 'ts-timeline-container' },
        guide.steps.map((step) =>
          e(GuideStep, {
            key: step.number,
            number: step.number,
            title: step.title,
            description: step.description,
            screenshot: step.screenshot,
            note: step.note,
          })
        )
      ),

      // Footer Important Note
      guide.importantNote &&
      e(
        'div',
        { className: 'ts-guide-footer-note' },
        e('strong', { className: 'ts-footer-note-badge' }, __('Important Note:', 'translatesense')),
        e('span', { className: 'ts-footer-note-text' }, guide.importantNote)
      )
    );
  }

  /**
   * Main Translation Guide Component
   */
  function TranslationGuide() {
    const [activeTab, setActiveTab] = useState('gutenberg');

    return e(
      'section',
      { className: 'translatesense-guide' },

      // Section Header (Hierarchy item 1, matching uploaded screenshot)
      e(
        'div',
        { className: 'ts-guide-section-header' },
        e('h2', { className: 'ts-guide-main-heading' }, __('How to Translate', 'translatesense')),
        e(
          'p',
          { className: 'ts-guide-main-desc' },
          __('Choose a translation method to view its step-by-step guide.', 'translatesense')
        )
      ),

      // All four options in a single row (matching uploaded screenshot)
      e(GuideMethodSelector, {
        activeTab: activeTab,
        onChange: setActiveTab,
      }),

      // Selected Guide Content (Steps, Timeline, Screenshot reference, Important note)
      e(GuideContent, {
        activeTab: activeTab,
      })
    );
  }

  // Expose component to global window namespace for dashboard integration
  window.TranslateSenseTranslationGuide = TranslationGuide;

})(window.wp);
