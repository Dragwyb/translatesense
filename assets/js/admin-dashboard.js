/**
 * TranslateSense - React Admin Dashboard
 * Supports separate XML per editor, Generate Config sandbox flow, Edit Config modal, and Grid/List view switcher.
 */

(function () {
  const { createElement: el, useState, useEffect, useMemo } = window.wp.element;

  function TranslateSenseApp() {
    const [activeBuilders, setActiveBuilders] = useState(TranslateSenseData.activeBuilders || { gutenberg: true, elementor: false, divi: false, classic: false });
    const [activeTab, setActiveTab] = useState('gutenberg');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    const [widgetsData, setWidgetsData] = useState({ gutenberg: [], elementor: [], divi: [], classic: [] });
    const [xmlConfigs, setXmlConfigs] = useState({
      all: '',
      gutenberg: '',
      elementor: '',
      divi: '',
      classic: '',
    });
    const [settings, setSettings] = useState({
      provider: 'client_google',
      api_key: '',
      deepl_api_key: '',
      libre_url: '',
      mapping_mode: false,
      batch_size: 5,
    });
    const [languages, setLanguages] = useState([]);
    const [stats, setStats] = useState({ total_packages: 0, cached_results: 0 });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedWidget, setSelectedWidget] = useState(null);
    const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
    const [modalTargetBuilder, setModalTargetBuilder] = useState('gutenberg');
    const [notice, setNotice] = useState(null);
    const [isCreatingSandbox, setIsCreatingSandbox] = useState(false);

    // Fetch initial data from REST API
    useEffect(() => {
      fetchData();
    }, []);

    const fetchData = async () => {
      setLoading(true);
      try {
        const [widgetsRes, xmlRes, settingsRes] = await Promise.all([
          window.wp.apiFetch({ path: '/translatesense/v1/widgets' }),
          window.wp.apiFetch({ path: '/translatesense/v1/xml-config?builder=all' }),
          window.wp.apiFetch({ path: '/translatesense/v1/settings' }),
        ]);

        setWidgetsData(widgetsRes);
        setXmlConfigs({
          all: xmlRes.custom_xml || '',
          gutenberg: xmlRes.gutenberg_xml || '',
          elementor: xmlRes.elementor_xml || '',
          divi: xmlRes.divi_xml || '',
          classic: xmlRes.classic_xml || '',
        });

        if (settingsRes.settings) {
          setSettings(settingsRes.settings);
        }
        if (settingsRes.languages) {
          setLanguages(settingsRes.languages);
        }
        if (settingsRes.stats) {
          setStats(settingsRes.stats);
        }
        if (settingsRes.active_builders) {
          setActiveBuilders(settingsRes.active_builders);
          if (!settingsRes.active_builders[activeTab] && activeTab !== 'xml_editor' && activeTab !== 'settings') {
            const firstActive = Object.keys(settingsRes.active_builders).find((k) => settingsRes.active_builders[k]);
            if (firstActive) setActiveTab(firstActive);
          }
        }
      } catch (err) {
        showNotice('Failed to load dashboard data: ' + (err.message || 'Unknown error'), 'error');
      } finally {
        setLoading(false);
      }
    };

    const showNotice = (text, type = 'success') => {
      setNotice({ text, type });
      setTimeout(() => setNotice(null), 4000);
    };

    // Save builder-specific or widget-specific XML
    const handleSaveXml = async (newXml, builder = modalTargetBuilder, widgetId = '') => {
      try {
        const payload = {
          builder: builder,
          custom_xml: newXml,
        };
        if (widgetId) {
          payload.widget_id = widgetId;
        }
        const res = await window.wp.apiFetch({
          path: '/translatesense/v1/xml-config',
          method: 'POST',
          data: payload,
        });
        showNotice(res.message || 'XML configuration saved successfully!');
        setIsXmlModalOpen(false);
        fetchData();
      } catch (err) {
        showNotice('Error saving XML: ' + (err.message || 'Validation error'), 'error');
      }
    };

    // Open Mapping Sandbox Page Editor for "Generate Config"
    const handleGenerateConfigSandbox = async (builder = activeTab, widgetSlug = '') => {
      setIsCreatingSandbox(true);
      try {
        const res = await window.wp.apiFetch({
          path: '/translatesense/v1/open-mapping-sandbox',
          method: 'POST',
          data: { builder, widget_slug: widgetSlug },
        });

        if (res.editor_url) {
          showNotice(`Opening ${builder.toUpperCase()} Editor sandbox... Add widget with placeholder 'Translate This Content'.`);
          window.open(res.editor_url, '_blank');
        }
      } catch (err) {
        showNotice('Failed to open mapping sandbox: ' + (err.message || 'Unknown error'), 'error');
      } finally {
        setIsCreatingSandbox(false);
      }
    };

    const handleSaveSettings = async (e) => {
      if (e) e.preventDefault();
      try {
        const res = await window.wp.apiFetch({
          path: '/translatesense/v1/settings',
          method: 'POST',
          data: settings,
        });
        showNotice(res.message || 'Settings saved successfully!');
        if (res.settings) setSettings(res.settings);
      } catch (err) {
        showNotice('Error updating settings: ' + (err.message || 'Network error'), 'error');
      }
    };

    const filteredWidgets = useMemo(() => {
      const list = widgetsData[activeTab] || [];
      if (!searchQuery.trim()) return list;
      const q = searchQuery.toLowerCase();
      return list.filter((w) => w.name.toLowerCase().includes(q) || w.id.toLowerCase().includes(q));
    }, [widgetsData, activeTab, searchQuery]);

    if (loading) {
      return el(
        'div',
        { className: 'ts-loading-placeholder' },
        el('div', { className: 'ts-spinner' }),
        el('p', null, 'Loading TranslateSense Dashboard...')
      );
    }

    const currentBuilderXml = xmlConfigs[activeTab] || xmlConfigs.all;

    return el(
      'div',
      { className: 'translatesense-dashboard' },

      // Header Bar
      el(
        'div',
        { className: 'ts-header' },
        el(
          'div',
          { className: 'ts-brand' },
          el('div', { className: 'ts-logo-icon' }, '🌐'),
          el(
            'div',
            null,
            el('h1', null, 'TranslateSense Engine'),
            el(
              'p',
              null,
              TranslateSenseData.polylangActive
                ? `⚡ Polylang Addon Active (${languages.length} Languages configured)`
                : '⚠️ Polylang is inactive - Running in standalone demo mode'
            )
          )
        ),
        el(
          'div',
          { className: 'ts-quick-stats' },
          el(
            'div',
            { className: 'ts-stat-badge' },
            el('div', { className: 'ts-stat-label' }, 'Cached Strings (5-Day)'),
            el('div', { className: 'ts-stat-value' }, stats.cached_results.toLocaleString())
          ),
          el(
            'div',
            { className: 'ts-stat-badge' },
            el('div', { className: 'ts-stat-label' }, 'Translation Packages'),
            el('div', { className: 'ts-stat-value' }, stats.total_packages.toLocaleString())
          )
        )
      ),

      // Notification Banner
      notice &&
        el(
          'div',
          {
            style: {
              padding: '12px 20px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontWeight: '600',
              background: notice.type === 'error' ? '#fee2e2' : '#dcfce7',
              color: notice.type === 'error' ? '#991b1b' : '#166534',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            },
          },
          el('span', null, notice.text),
          el('button', { onClick: () => setNotice(null), style: { background: 'none', border: 'none', cursor: 'pointer' } }, '✕')
        ),

      // Tabs Navigation with Editor Activation Filter
      el(
        'div',
        { className: 'ts-nav-tabs' },
        activeBuilders.gutenberg &&
          el(
            'button',
            {
              className: `ts-tab-btn ${activeTab === 'gutenberg' ? 'active' : ''}`,
              onClick: () => { setActiveTab('gutenberg'); setSearchQuery(''); },
            },
            'Gutenberg Blocks',
            el('span', { className: 'ts-tab-count' }, widgetsData.gutenberg ? widgetsData.gutenberg.length : 0)
          ),
        activeBuilders.elementor &&
          el(
            'button',
            {
              className: `ts-tab-btn ${activeTab === 'elementor' ? 'active' : ''}`,
              onClick: () => { setActiveTab('elementor'); setSearchQuery(''); },
            },
            'Elementor Widgets',
            el('span', { className: 'ts-tab-count' }, widgetsData.elementor ? widgetsData.elementor.length : 0)
          ),
        activeBuilders.divi &&
          el(
            'button',
            {
              className: `ts-tab-btn ${activeTab === 'divi' ? 'active' : ''}`,
              onClick: () => { setActiveTab('divi'); setSearchQuery(''); },
            },
            'Divi Modules',
            el('span', { className: 'ts-tab-count' }, widgetsData.divi ? widgetsData.divi.length : 0)
          ),
        activeBuilders.classic &&
          el(
            'button',
            {
              className: `ts-tab-btn ${activeTab === 'classic' ? 'active' : ''}`,
              onClick: () => { setActiveTab('classic'); setSearchQuery(''); },
            },
            'Classic / Custom Fields',
            el('span', { className: 'ts-tab-count' }, widgetsData.classic ? widgetsData.classic.length : 0)
          ),
        el(
          'button',
          {
            className: `ts-tab-btn ${activeTab === 'xml_editor' ? 'active' : ''}`,
            onClick: () => setActiveTab('xml_editor'),
          },
          '📝 All XML Configs'
        ),
        el(
          'button',
          {
            className: `ts-tab-btn ${activeTab === 'settings' ? 'active' : ''}`,
            onClick: () => setActiveTab('settings'),
          },
          '⚙️ General Settings'
        )
      ),

      // Tab Content View
      activeTab === 'settings'
        ? el(SettingsPanel, {
            settings,
            setSettings,
            onSave: handleSaveSettings,
            languages,
          })
        : activeTab === 'xml_editor'
        ? el(AllXmlEditor, { xmlConfigs, onSave: handleSaveXml })
        : el(
            'div',
            null,
            // Controls Bar
            el(
              'div',
              { className: 'ts-controls-bar' },
              el(
                'div',
                { className: 'ts-controls-left' },
                el(
                  'div',
                  { className: 'ts-search-box' },
                  el('span', { className: 'ts-search-icon' }, '🔍'),
                  el('input', {
                    type: 'text',
                    className: 'ts-search-input',
                    placeholder: `Search ${activeTab} items...`,
                    value: searchQuery,
                    onChange: (e) => setSearchQuery(e.target.value),
                  })
                ),
                // View Switcher (Grid vs List)
                el(
                  'div',
                  { className: 'ts-view-switcher' },
                  el(
                    'button',
                    {
                      className: `ts-view-btn ${viewMode === 'grid' ? 'active' : ''}`,
                      onClick: () => setViewMode('grid'),
                      title: 'Grid Card View',
                    },
                    '⊞ Grid'
                  ),
                  el(
                    'button',
                    {
                      className: `ts-view-btn ${viewMode === 'list' ? 'active' : ''}`,
                      onClick: () => setViewMode('list'),
                      title: 'Table List View',
                    },
                    '☰ List'
                  )
                )
              ),

              // Two Global Actions: "Generate Config" and "Edit Config"
              el(
                'div',
                { className: 'ts-controls-right' },
                el(
                  'button',
                  {
                    className: 'ts-btn ts-btn-primary',
                    disabled: isCreatingSandbox,
                    onClick: () => handleGenerateConfigSandbox(activeTab),
                    title: "Open editor sandbox with placeholder 'Translate This Content'",
                  },
                  isCreatingSandbox ? 'Opening...' : `⚡ Generate ${activeTab.toUpperCase()} Config`
                ),
                el(
                  'button',
                  {
                    className: 'ts-btn ts-btn-secondary',
                    onClick: () => {
                      setSelectedWidget(null);
                      setModalTargetBuilder(activeTab);
                      setIsXmlModalOpen(true);
                    },
                    title: `View & Edit ${activeTab}-config.xml`,
                  },
                  `📝 Edit ${activeTab.toUpperCase()} Config`
                )
              )
            ),

            // Content: Grid View or List / Table View
            viewMode === 'grid'
              ? el(
                  'div',
                  { className: 'ts-widget-grid' },
                  filteredWidgets.length > 0
                    ? filteredWidgets.map((widget) =>
                        el(WidgetCard, {
                          key: widget.id,
                          widget,
                          activeTab,
                          onEdit: (w) => {
                            setSelectedWidget(w);
                            setModalTargetBuilder(activeTab);
                            setIsXmlModalOpen(true);
                          },
                          onGenerate: (w) => handleGenerateConfigSandbox(activeTab, w.id),
                        })
                      )
                    : el(
                        'div',
                        { style: { gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#64748b' } },
                        'No items found matching your search.'
                      )
                )
              : el(
                  'div',
                  { className: 'ts-table-container' },
                  el(
                    'table',
                    { className: 'ts-list-table' },
                    el(
                      'thead',
                      null,
                      el(
                        'tr',
                        null,
                        el('th', { style: { width: '35%' } }, 'Block / Widget Name'),
                        el('th', { style: { width: '15%' } }, 'Category'),
                        el('th', { style: { width: '15%' } }, 'Mapped Fields'),
                        el('th', { style: { width: '15%' } }, 'Status'),
                        el('th', { style: { width: '20%', textAlign: 'right' } }, 'Actions')
                      )
                    ),
                    el(
                      'tbody',
                      null,
                      filteredWidgets.length > 0
                        ? filteredWidgets.map((widget) =>
                            el(WidgetTableRow, {
                              key: widget.id,
                              widget,
                              onEdit: (w) => {
                                setSelectedWidget(w);
                                setModalTargetBuilder(activeTab);
                                setIsXmlModalOpen(true);
                              },
                              onGenerate: (w) => handleGenerateConfigSandbox(activeTab, w.id),
                            })
                          )
                        : el(
                            'tr',
                            null,
                            el('td', { colSpan: 5, style: { padding: '40px', textAlign: 'center', color: '#64748b' } }, 'No items found matching your search.')
                          )
                    )
                  )
                )
          ),

      // XML Config Modal
      isXmlModalOpen &&
        el(XmlConfigModal, {
          widget: selectedWidget,
          builder: modalTargetBuilder,
          xmlCode: selectedWidget ? (selectedWidget.xml_snippet || '') : (xmlConfigs[modalTargetBuilder] || ''),
          onClose: () => setIsXmlModalOpen(false),
          onSave: (code) => handleSaveXml(code, modalTargetBuilder, selectedWidget ? selectedWidget.id : ''),
        })
    );
  }

  // Widget Card Component (Grid View)
  function WidgetCard({ widget, activeTab, onEdit, onGenerate }) {
    const isSupported = widget.status !== 'unsupported';

    return el(
      'div',
      { className: 'ts-widget-card' },
      el(
        'div',
        { className: 'ts-card-top' },
        el(
          'div',
          null,
          el('h3', { className: 'ts-card-title' }, widget.name),
          el('div', { className: 'ts-card-slug' }, widget.id)
        ),
        el(
          'span',
          { className: `ts-badge ${widget.status}` },
          widget.status === 'supported' ? '✓ Supported' : widget.status === 'custom' ? '★ Custom' : '✕ Unsupported'
        )
      ),
      el(
        'div',
        { className: 'ts-card-meta' },
        el('span', null, `Category: ${widget.category || 'Standard'}`),
        el('span', null, '•'),
        el('span', null, `${widget.field_count || 0} Fields Mapped`)
      ),
      el(
        'div',
        { className: 'ts-card-actions' },
        el(
          'button',
          {
            className: 'ts-btn ts-btn-primary',
            style: { flex: 1 },
            onClick: () => onGenerate(widget),
            title: "Open editor with 'Translate This Content' for this item",
          },
          '⚡ Generate'
        ),
        el(
          'button',
          {
            className: 'ts-btn ts-btn-secondary',
            style: { flex: 1 },
            onClick: () => onEdit(widget),
            title: 'Edit XML rule directly',
          },
          '📝 Edit Config'
        )
      )
    );
  }

  // Widget Table Row Component (List / Table View)
  function WidgetTableRow({ widget, onEdit, onGenerate }) {
    return el(
      'tr',
      null,
      el(
        'td',
        null,
        el(
          'div',
          { className: 'ts-table-name-col' },
          el('span', { className: 'ts-table-widget-title' }, widget.name),
          el('span', { className: 'ts-table-widget-slug' }, widget.id)
        )
      ),
      el('td', null, widget.category || 'Standard'),
      el('td', null, `${widget.field_count || 0} fields`),
      el(
        'td',
        null,
        el(
          'span',
          { className: `ts-badge ${widget.status}` },
          widget.status === 'supported' ? '✓ Supported' : widget.status === 'custom' ? '★ Custom' : '✕ Unsupported'
        )
      ),
      el(
        'td',
        { style: { textAlign: 'right' } },
        el(
          'div',
          { className: 'ts-table-actions', style: { justifyContent: 'flex-end' } },
          el(
            'button',
            {
              className: 'ts-btn ts-btn-primary',
              style: { padding: '6px 12px', fontSize: '12px' },
              onClick: () => onGenerate(widget),
            },
            '⚡ Generate'
          ),
          el(
            'button',
            {
              className: 'ts-btn ts-btn-secondary',
              style: { padding: '6px 12px', fontSize: '12px' },
              onClick: () => onEdit(widget),
            },
            '📝 Edit Config'
          )
        )
      )
    );
  }

  // XML Config Modal Component
  function XmlConfigModal({ widget, builder, xmlCode, onClose, onSave }) {
    const [editorCode, setEditorCode] = useState(xmlCode || '');

    useEffect(() => {
      if (widget) {
        if (widget.xml_snippet) {
          setEditorCode(widget.xml_snippet);
        } else if ('gutenberg' === builder) {
          setEditorCode(`<?xml version="1.0" encoding="UTF-8"?>\n<wpml-config>\n    <gutenberg-blocks>\n        <gutenberg-block name="${widget.id}">\n            <key name="content" type="text" editor_type="VISUAL" />\n        </gutenberg-block>\n    </gutenberg-blocks>\n</wpml-config>`);
        } else if ('elementor' === builder) {
          setEditorCode(`<?xml version="1.0" encoding="UTF-8"?>\n<wpml-config>\n    <elementor-widgets>\n        <widget name="${widget.id}">\n            <conditions>\n                <condition key="widgetType">${widget.id}</condition>\n            </conditions>\n            <fields>\n                <field type="title" editor_type="LINE">title</field>\n            </fields>\n        </widget>\n    </elementor-widgets>\n</wpml-config>`);
        } else if ('divi' === builder) {
          setEditorCode(`<?xml version="1.0" encoding="UTF-8"?>\n<wpml-config>\n    <divi-modules>\n        <module name="${widget.id}">\n            <fields>\n                <field type="content" editor_type="VISUAL">content</field>\n            </fields>\n        </module>\n    </divi-modules>\n</wpml-config>`);
        } else {
          setEditorCode(`<?xml version="1.0" encoding="UTF-8"?>\n<wpml-config>\n    <custom-fields>\n        <custom-field action="translate">${widget.id}</custom-field>\n    </custom-fields>\n</wpml-config>`);
        }
      } else {
        setEditorCode(xmlCode || '');
      }
    }, [widget, builder, xmlCode]);

    return el(
      'div',
      { className: 'ts-modal-overlay', onClick: onClose },
      el(
        'div',
        { className: 'ts-modal-container', onClick: (e) => e.stopPropagation() },
        el(
          'div',
          { className: 'ts-modal-header' },
          el('h3', null, widget ? `Configure XML: ${widget.name} (${builder.toUpperCase()})` : `Edit ${builder.toUpperCase()} Custom XML Configuration`),
          el('button', { className: 'ts-modal-close', onClick: onClose }, '✕')
        ),
        el(
          'div',
          { className: 'ts-modal-body' },
          el(
            'p',
            { style: { fontSize: '13px', color: '#64748b', marginTop: 0 } },
            `Specify translation mappings for ${builder.toUpperCase()} widgets/blocks. When saved, this updates ${builder}-config.xml.`
          ),
          el('textarea', {
            className: 'ts-xml-editor',
            value: editorCode,
            onChange: (e) => setEditorCode(e.target.value),
            spellCheck: 'false',
          })
        ),
        el(
          'div',
          { className: 'ts-modal-footer' },
          el('button', { className: 'ts-btn ts-btn-secondary', onClick: onClose }, 'Cancel'),
          el(
            'button',
            {
              className: 'ts-btn ts-btn-primary',
              onClick: () => onSave(editorCode),
            },
            '💾 Save Config'
          )
        )
      )
    );
  }

  // Tab to View/Edit All Separate Editor XMLs
  function AllXmlEditor({ xmlConfigs, onSave }) {
    const [selectedEditor, setSelectedEditor] = useState('gutenberg');
    const [currentCode, setCurrentCode] = useState(xmlConfigs.gutenberg || '');

    useEffect(() => {
      setCurrentCode(xmlConfigs[selectedEditor] || '');
    }, [selectedEditor, xmlConfigs]);

    return el(
      'div',
      { className: 'ts-settings-panel', style: { maxWidth: '1000px' } },
      el('h2', { style: { marginTop: 0 } }, 'Editor-Specific XML Configurations'),
      el(
        'p',
        { style: { color: '#64748b', fontSize: '13px' } },
        'TranslateSense maintains isolated XML files for each editor (Gutenberg, Elementor, Divi, Classic). Select an editor below to inspect or edit its custom XML.'
      ),

      el(
        'div',
        { style: { display: 'flex', gap: '10px', marginBottom: '16px' } },
        ['gutenberg', 'elementor', 'divi', 'classic'].map((ed) =>
          el(
            'button',
            {
              key: ed,
              className: `ts-btn ${selectedEditor === ed ? 'ts-btn-primary' : 'ts-btn-secondary'}`,
              onClick: () => setSelectedEditor(ed),
            },
            `${ed.toUpperCase()} XML`
          )
        )
      ),

      el('textarea', {
        className: 'ts-xml-editor',
        style: { height: '380px', marginBottom: '20px' },
        value: currentCode,
        onChange: (e) => setCurrentCode(e.target.value),
        spellCheck: 'false',
      }),
      el(
        'button',
        {
          className: 'ts-btn ts-btn-primary',
          onClick: () => onSave(currentCode, selectedEditor),
        },
        `💾 Save ${selectedEditor.toUpperCase()} Custom XML`
      )
    );
  }

  // Settings Panel Component
  function SettingsPanel({ settings, setSettings, onSave, languages }) {
    return el(
      'form',
      { className: 'ts-settings-panel', onSubmit: onSave },
      el('h2', { style: { marginTop: 0, marginBottom: '20px' } }, 'TranslateSense Settings'),

      el(
        'div',
        { className: 'ts-form-group', style: { background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' } },
        el(
          'label',
          { className: 'ts-switch-label' },
          el(
            'div',
            { className: 'ts-switch' },
            el('input', {
              type: 'checkbox',
              checked: !!settings.mapping_mode,
              onChange: (e) => setSettings({ ...settings, mapping_mode: e.target.checked }),
            }),
            el('span', { className: 'ts-slider' })
          ),
          el(
            'div',
            null,
            el('strong', null, 'Enable Config Mapping Mode'),
            el('div', { className: 'ts-form-desc', style: { margin: '2px 0 0 0' } }, "When active, saving any post automatically detects 'Translate This Content' placeholders and updates XML rules.")
          )
        )
      ),

      el(
        'div',
        { className: 'ts-form-group' },
        el('label', { className: 'ts-form-label' }, 'Translation Engine Provider'),
        el('div', { className: 'ts-form-desc' }, 'Choose which engine translates content during Bulk or Live Editor translation.'),
        el(
          'select',
          {
            className: 'ts-form-select',
            value: settings.provider || 'client_google',
            onChange: (e) => setSettings({ ...settings, provider: e.target.value }),
          },
          el('option', { value: 'client_google' }, 'Client-Side / Free Translation Engine (Default)'),
          el('option', { value: 'chrome_ai' }, 'Chrome Built-in AI Translation (Local on-device)'),
          el('option', { value: 'google_api' }, 'Google Cloud Translation API (Official Key)'),
          el('option', { value: 'deepl' }, 'DeepL Translation API (Free / Pro Key)'),
          el('option', { value: 'libre' }, 'LibreTranslate Server')
        )
      ),

      settings.provider === 'google_api' &&
        el(
          'div',
          { className: 'ts-form-group' },
          el('label', { className: 'ts-form-label' }, 'Google Cloud API Key'),
          el('input', {
            type: 'password',
            className: 'ts-form-input',
            value: settings.api_key || '',
            placeholder: 'AIzaSy...',
            onChange: (e) => setSettings({ ...settings, api_key: e.target.value }),
          })
        ),

      settings.provider === 'deepl' &&
        el(
          'div',
          { className: 'ts-form-group' },
          el('label', { className: 'ts-form-label' }, 'DeepL Auth Key'),
          el('input', {
            type: 'password',
            className: 'ts-form-input',
            value: settings.deepl_api_key || '',
            placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx',
            onChange: (e) => setSettings({ ...settings, deepl_api_key: e.target.value }),
          })
        ),

      settings.provider === 'libre' &&
        el(
          'div',
          { className: 'ts-form-group' },
          el('label', { className: 'ts-form-label' }, 'LibreTranslate URL'),
          el('input', {
            type: 'text',
            className: 'ts-form-input',
            value: settings.libre_url || '',
            placeholder: 'https://libretranslate.com',
            onChange: (e) => setSettings({ ...settings, libre_url: e.target.value }),
          })
        ),

      el(
        'div',
        { className: 'ts-form-group' },
        el('label', { className: 'ts-form-label' }, 'Bulk Translation Batch Size'),
        el('input', {
          type: 'number',
          min: 1,
          max: 20,
          className: 'ts-form-input',
          style: { maxWidth: '120px' },
          value: settings.batch_size || 5,
          onChange: (e) => setSettings({ ...settings, batch_size: parseInt(e.target.value, 10) || 5 }),
        })
      ),

      el(
        'div',
        { style: { marginTop: '30px' } },
        el('button', { type: 'submit', className: 'ts-btn ts-btn-primary' }, '💾 Save Settings')
      )
    );
  }

  // Mount App
  window.addEventListener('DOMContentLoaded', () => {
    const rootEl = document.getElementById('translatesense-admin-root');
    if (rootEl && window.wp && window.wp.element) {
      window.wp.element.render(el(TranslateSenseApp), rootEl);
    }
  });
})();
