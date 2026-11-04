/**
 * TranslationGuide Component - Interactive Step-by-Step Translation Walkthrough
 */

import { useState } from '@wordpress/element';
import { GuideMethodSelector } from './GuideMethodSelector';
import { GuideStep } from './GuideStep';

export const GUIDES_DATA = {
  gutenberg: {
    id: 'gutenberg',
    title: 'Gutenberg Block Editor Translation',
    description: 'Follow these simple steps to translate your Gutenberg posts and pages while preserving all blocks and formatting.',
    importantNote: 'The generated translation is not applied to the page until you click Apply To Page.',
    steps: [
      {
        number: 1,
        title: 'Open Language Creation',
        description: 'Navigate to Pages → All Pages and click the + (Add Language) icon in the page row.',
        screenshot: 'Pages list showing the + (Add Language) icon in Polylang columns',
      },
      {
        number: 2,
        title: 'Automatic Translation Popup',
        description: 'Continue using the Automatic Translation – Translate Page Content popup by clicking Continue to Translate.',
        screenshot: 'Automatic Translation dialog with Continue to Translate button',
      },
      {
        number: 3,
        title: 'Open Page in Gutenberg',
        description: 'If the popup does not appear or was closed, open the translated page in Gutenberg.',
      },
      {
        number: 4,
        title: 'Locate TranslateSense Metabox',
        description: 'Locate the TranslateSense metabox in the right sidebar, above the Polylang language metabox.',
        screenshot: 'Right editor sidebar with TranslateSense metabox above Polylang',
      },
      {
        number: 5,
        title: 'Click Auto Translate',
        description: 'Click Auto Translate to initialize content block extraction.',
      },
      {
        number: 6,
        title: 'Select AI Provider & Start',
        description: 'Select an AI provider and click Start Translation.',
      },
      {
        number: 7,
        title: 'Wait for Translation',
        description: 'Wait for translation to finish. Translatable content is mapped and cached strings are reused.',
      },
      {
        number: 8,
        title: 'Apply Generated Translation',
        description: 'Click Apply To Page to apply the generated translation.',
        note: 'The generated translation is not applied to the page until you click Apply To Page.',
      },
    ],
  },
  classic: {
    id: 'classic',
    title: 'Classic Editor (WYSIWYG) Translation',
    description: 'Translate traditional WordPress content, WooCommerce descriptions, and custom post types using the Classic Editor.',
    importantNote: 'Classic Editor support includes WooCommerce content and supported custom post types.',
    steps: [
      {
        number: 1,
        title: 'Open Content Listing',
        description: 'Open the relevant content listing and click + (Add Language).',
      },
      {
        number: 2,
        title: 'Continue via Popup',
        description: 'Continue using the initial automatic translation popup.',
      },
      {
        number: 3,
        title: 'Open in Classic Editor',
        description: 'If the popup does not appear or was closed, open the translated content in the Classic Editor.',
      },
      {
        number: 4,
        title: 'Locate Auto Translate Button',
        description: 'Locate Auto Translate above the Add Media button in the WYSIWYG editor.',
        screenshot: 'Classic Editor toolbar showing Auto Translate above Add Media',
      },
      {
        number: 5,
        title: 'Click Auto Translate',
        description: 'Click Auto Translate.',
      },
      {
        number: 6,
        title: 'Select AI Provider & Start',
        description: 'Select an AI provider and click Start Translation.',
      },
      {
        number: 7,
        title: 'Wait for Translation',
        description: 'Wait for translation to finish.',
      },
      {
        number: 8,
        title: 'Apply Translation',
        description: 'Click Apply To Page.',
        note: 'Classic Editor support includes WooCommerce content and supported custom post types.',
      },
    ],
  },
  elementor: {
    id: 'elementor',
    title: 'Elementor Page Builder Translation',
    description: 'Translate visual Elementor layouts, custom widgets, and styled sections seamlessly without losing design hierarchy.',
    importantNote: 'The generated translation is not applied to the page until you click Apply To Page.',
    steps: [
      {
        number: 1,
        title: 'Navigate to Pages',
        description: 'Navigate to Pages → All Pages and click + (Add Language).',
      },
      {
        number: 2,
        title: 'Continue via Popup',
        description: 'Continue using the initial automatic translation popup.',
      },
      {
        number: 3,
        title: 'Open Page in Elementor',
        description: 'If the popup does not appear or was closed, open page in Elementor Editor.',
      },
      {
        number: 4,
        title: 'Locate Header Button',
        description: 'Locate Auto Translate in the Elementor editor header.',
        screenshot: 'Elementor header panel with TranslateSense Auto Translate button',
      },
      {
        number: 5,
        title: 'Click Auto Translate',
        description: 'Click Auto Translate.',
      },
      {
        number: 6,
        title: 'Select AI Provider & Start',
        description: 'Select an AI provider and click Start Translation.',
      },
      {
        number: 7,
        title: 'Wait for Translation',
        description: 'Wait for translation to finish.',
      },
      {
        number: 8,
        title: 'Apply Generated Translation',
        description: 'Click Apply To Page.',
        note: 'The generated translation is not applied to the page until you click Apply To Page.',
      },
    ],
  },
  bulk: {
    id: 'bulk',
    title: 'Bulk Translation (Batch Queue)',
    description: 'Translate multiple posts and pages in a single batch with real-time background progress monitoring.',
    importantNote: 'Translations are queued and processed safely in the background. You can monitor live progress and cancel or skip at any time.',
    steps: [
      {
        number: 1,
        title: 'Navigate to Content Listing',
        description: 'Navigate to Pages → All Pages or Posts → All Posts.',
      },
      {
        number: 2,
        title: 'Select Multiple Items',
        description: 'Select multiple pages or posts using the table checkboxes.',
      },
      {
        number: 3,
        title: 'Click Bulk Translation Button',
        description: 'Click Bulk Translation, available above and below the list table after the page filter options.',
        screenshot: 'List table navigation showing the Translate button',
      },
      {
        number: 4,
        title: 'Select Target Languages',
        description: 'Select one or more target languages.',
      },
      {
        number: 5,
        title: 'Choose Provider Step',
        description: 'Click Next: Choose Provider.',
      },
      {
        number: 6,
        title: 'Select AI Provider',
        description: 'Select an AI provider in the provider modal.',
      },
      {
        number: 7,
        title: 'Start Bulk Translation',
        description: 'Click Start Bulk Translation.',
      },
      {
        number: 8,
        title: 'Progress Modal Appears',
        description: 'The bulk translation progress modal appears.',
      },
      {
        number: 9,
        title: 'Monitor Live Progress',
        description: 'Monitor live translation progress in the modal.',
      },
      {
        number: 10,
        title: 'Review Summary Breakdown',
        description: 'Review successful, failed and incomplete translations after completion.',
        note: 'Translations are linked in Polylang automatically. Taxonomies, categories, and post meta are synchronized.',
      },
    ],
  },
};

export function TranslationGuide() {
  const [activeMethod, setActiveMethod] = useState('gutenberg');
  const guide = GUIDES_DATA[activeMethod] || GUIDES_DATA.gutenberg;

  return (
    <section className="translatesense-guide" aria-label="Translation Workflow Guides">
      <div className="ts-guide-section-header">
        <h3 className="ts-guide-main-heading">How to Translate</h3>
        <p className="ts-guide-main-desc">
          Choose a translation method to view its step-by-step guide.
        </p>
      </div>

      <GuideMethodSelector activeTab={activeMethod} onChange={setActiveMethod} />

      <div
        id={`ts-guide-panel-${guide.id}`}
        role="region"
        aria-labelledby={`ts-method-card-${guide.id}`}
        className="ts-guide-panel"
        tabIndex={0}
      >
        <div className="ts-guide-panel-header">
          <h4 className="ts-guide-panel-title">{guide.title}</h4>
          <p className="ts-guide-panel-desc">{guide.description}</p>
        </div>

        <div className="ts-timeline-container">
          {guide.steps.map((step) => (
            <GuideStep
              key={step.number}
              number={step.number}
              title={step.title}
              description={step.description}
              screenshot={step.screenshot}
              note={step.note}
            />
          ))}
        </div>

        {guide.importantNote && (
          <div className="ts-guide-footer-note">
            <span className="ts-footer-note-badge">NOTE: </span>
            <span className="ts-footer-note-text">{guide.importantNote}</span>
          </div>
        )}
      </div>
    </section>
  );
}

