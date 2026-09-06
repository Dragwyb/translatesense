/**
 * TranslateSense - React Admin Dashboard
 * Supports separate XML per editor, Generate Config sandbox flow, Edit Config modal, and Grid/List view switcher.
 */

(function () {
  const { createElement: el, useState, useEffect, useMemo } = window.wp.element;

  function TranslateSenseApp() {
    const getInitialTab = () => {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab');
      const validTabs = ['gutenberg', 'elementor', 'classic', 'xml_editor', 'settings'];
      if (urlTab && validTabs.includes(urlTab)) {
        return urlTab;
      }
      return 'gutenberg';
    };

    const [activeBuilders, setActiveBuilders] = useState(TranslateSenseData.activeBuilders || { gutenberg: true, elementor: false, classic: false });
    const [activeTab, setActiveTab] = useState(getInitialTab);
    const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
    const [widgetsData, setWidgetsData] = useState({ gutenberg: [], elementor: [], classic: [] });
    const [xmlConfigs, setXmlConfigs] = useState({
      all: '',
      gutenberg: '',
      elementor: '',
      classic: '',
    });
    const [settings, setSettings] = useState({
      openai_api_key: '',
      openai_model: 'gpt-4o-mini',
      gemini_api_key: '',
      gemini_model: 'gemini-1.5-flash',
      enabled_providers: ['chrome_ai', 'openai', 'gemini'],
      batch_size: 5,
    });
    const [languages, setLanguages] = useState([]);
    const [stats, setStats] = useState({ total_packages: 0, cached_results: 0 });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [sortBy, setSortBy] = useState('name_asc');
    const [selectedWidget, setSelectedWidget] = useState(null);
    const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
    const [modalTargetBuilder, setModalTargetBuilder] = useState('gutenberg');
    const [notice, setNotice] = useState(null);
    const [isCreatingSandbox, setIsCreatingSandbox] = useState(false);

    // Tab Change handler that updates URL query param
    const handleTabChange = (newTab) => {
      setActiveTab(newTab);
      if (['gutenberg', 'elementor', 'classic'].includes(newTab)) {
        setSearchQuery('');
        setSelectedCategory('all');
        setSelectedStatus('all');
        setSortBy('name_asc');
      }
      const url = new URL(window.location.href);
      url.searchParams.set('tab', newTab);
      window.history.pushState({ tab: newTab }, '', url.toString());
    };

    // Listen to browser Back/Forward navigation
    useEffect(() => {
      const onPopState = () => {
        const params = new URLSearchParams(window.location.search);
        const tabFromUrl = params.get('tab');
        const validTabs = ['gutenberg', 'elementor', 'classic', 'xml_editor', 'settings'];
        if (tabFromUrl && validTabs.includes(tabFromUrl)) {
          setActiveTab(tabFromUrl);
        }
      };
      window.addEventListener('popstate', onPopState);
      return () => window.removeEventListener('popstate', onPopState);
    }, []);

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
            if (firstActive) handleTabChange(firstActive);
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

    const availableCategories = useMemo(() => {
      const list = widgetsData[activeTab] || [];
      const cats = new Set();
      list.forEach((w) => {
        if (w.category && typeof w.category === 'string') {
          cats.add(w.category);
        }
      });
      return Array.from(cats).sort((a, b) => a.localeCompare(b));
    }, [widgetsData, activeTab]);

    const filteredWidgets = useMemo(() => {
      let list = [...(widgetsData[activeTab] || [])];

      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        list = list.filter((w) => (w.name && w.name.toLowerCase().includes(q)) || (w.id && w.id.toLowerCase().includes(q)));
      }

      // 2. Category Filter
      if (selectedCategory && selectedCategory !== 'all') {
        list = list.filter((w) => w.category === selectedCategory);
      }

      // 3. Support Status Filter
      if (selectedStatus && selectedStatus !== 'all') {
        list = list.filter((w) => w.status === selectedStatus);
      }

      // 4. Sorting (Alphabetical A-Z by default)
      list.sort((a, b) => {
        const nameA = (a.name || a.id || '').toLowerCase();
        const nameB = (b.name || b.id || '').toLowerCase();

        if (sortBy === 'name_desc') {
          return nameB.localeCompare(nameA);
        }
        if (sortBy === 'fields_desc') {
          return (b.field_count || 0) - (a.field_count || 0) || nameA.localeCompare(nameB);
        }
        if (sortBy === 'fields_asc') {
          return (a.field_count || 0) - (b.field_count || 0) || nameA.localeCompare(nameB);
        }
        if (sortBy === 'status') {
          const order = { custom: 1, supported: 2, unsupported: 3 };
          const statusA = order[a.status] || 4;
          const statusB = order[b.status] || 4;
          return statusA - statusB || nameA.localeCompare(nameB);
        }
        // Default: name_asc (Alphabetical A-Z)
        return nameA.localeCompare(nameB);
      });

      return list;
    }, [widgetsData, activeTab, searchQuery, selectedCategory, selectedStatus, sortBy]);

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
            el(
              'h1',
              null,
              'TranslateSense Engine',
              el('span', { className: 'ts-version-tag' }, 'v' + (TranslateSenseData && TranslateSenseData.version || '1.0.0'))
            ),
            el(
              'p',
              null,
              el('span', { className: 'ts-pulse-dot' }),
              TranslateSenseData.polylangActive
                ? `Polylang Connected (${languages.length} Languages active)`
                : 'Polylang inactive - Standalone configuration mode'
            )
          )
        ),
        el(
          'div',
          { className: 'ts-quick-stats' },
          el(
            'div',
            { className: 'ts-stat-badge' },
            el('div', { className: 'ts-stat-label' }, 'Translation Cache'),
            el('div', { className: 'ts-stat-value' }, stats.cached_results.toLocaleString() + ' Strings')
          ),
          el(
            'div',
            { className: 'ts-stat-badge' },
            el('div', { className: 'ts-stat-label' }, 'Active Packages'),
            el('div', { className: 'ts-stat-value' }, stats.total_packages.toLocaleString())
          )
        )
      ),

      // Notification Banner
      notice &&
      el(
        'div',
        { className: `ts-notice-banner ${notice.type}` },
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          notice.type === 'error' ? '⚠️' : '✅',
          el('span', null, notice.text)
        ),
        el('button', { className: 'ts-notice-close', onClick: () => setNotice(null) }, '✕')
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
            onClick: () => handleTabChange('gutenberg'),
          },
          '🧱 Gutenberg Blocks',
          el('span', { className: 'ts-tab-count' }, widgetsData.gutenberg ? widgetsData.gutenberg.length : 0)
        ),
        activeBuilders.elementor &&
        el(
          'button',
          {
            className: `ts-tab-btn ${activeTab === 'elementor' ? 'active' : ''}`,
            onClick: () => handleTabChange('elementor'),
          },
          '🎨 Elementor Widgets',
          el('span', { className: 'ts-tab-count' }, widgetsData.elementor ? widgetsData.elementor.length : 0)
        ),
        activeBuilders.classic &&
        el(
          'button',
          {
            className: `ts-tab-btn ${activeTab === 'classic' ? 'active' : ''}`,
            onClick: () => handleTabChange('classic'),
          },
          '📝 Classic / Custom Fields',
          el('span', { className: 'ts-tab-count' }, widgetsData.classic ? widgetsData.classic.length : 0)
        ),
        el(
          'button',
          {
            className: `ts-tab-btn ${activeTab === 'xml_editor' ? 'active' : ''}`,
            onClick: () => handleTabChange('xml_editor'),
          },
          '📋 XML Configs'
        ),
        el(
          'button',
          {
            className: `ts-tab-btn ${activeTab === 'settings' ? 'active' : ''}`,
            onClick: () => handleTabChange('settings'),
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
          showNotice,
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
                // Category Filter
                el(
                  'select',
                  {
                    className: 'ts-filter-select',
                    value: selectedCategory,
                    onChange: (e) => setSelectedCategory(e.target.value),
                    title: 'Filter by Category',
                  },
                  el('option', { value: 'all' }, '📂 All Categories'),
                  availableCategories.map((cat) =>
                    el('option', { key: cat, value: cat }, cat.charAt(0).toUpperCase() + cat.slice(1))
                  )
                ),
                // Support Status Filter
                el(
                  'select',
                  {
                    className: 'ts-filter-select',
                    value: selectedStatus,
                    onChange: (e) => setSelectedStatus(e.target.value),
                    title: 'Filter by Support Status',
                  },
                  el('option', { value: 'all' }, '🏷️ All Statuses'),
                  el('option', { value: 'supported' }, '✓ Supported'),
                  el('option', { value: 'custom' }, '★ Custom Config'),
                  el('option', { value: 'unsupported' }, '✕ Unsupported')
                ),
                // Sort By
                el(
                  'select',
                  {
                    className: 'ts-filter-select',
                    value: sortBy,
                    onChange: (e) => setSortBy(e.target.value),
                    title: 'Sort Items',
                  },
                  el('option', { value: 'name_asc' }, '🔤 Name (A → Z)'),
                  el('option', { value: 'name_desc' }, '🔤 Name (Z → A)'),
                  el('option', { value: 'fields_desc' }, '🔢 Fields (High → Low)'),
                  el('option', { value: 'fields_asc' }, '🔢 Fields (Low → High)'),
                  el('option', { value: 'status' }, '⚡ Status (Supported first)')
                ),
                // Reset Filters Button if any filter active
                (searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all' || sortBy !== 'name_asc') &&
                el(
                  'button',
                  {
                    className: 'ts-btn ts-btn-secondary ts-btn-sm ts-reset-filter-btn',
                    onClick: () => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                      setSelectedStatus('all');
                      setSortBy('name_asc');
                    },
                    title: 'Reset filters to default',
                  },
                  '✕ Reset'
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
        el(
          'span',
          { className: `ts-badge ts-badge-translate ${widget.field_count > 0 ? '' : 'empty'}` },
          `🌐 ${widget.field_count || 0} Translate ${widget.field_count === 1 ? 'Field' : 'Fields'}`
        ),
        widget.no_translate_count > 0 &&
        el(
          'span',
          { className: 'ts-badge ts-badge-no-translate' },
          `🚫 ${widget.no_translate_count} No Translate`
        )
      ),
      el(
        'div',
        { className: 'ts-card-actions' },
        isSupported
          ? el(
            'button',
            {
              className: 'ts-btn ts-btn-secondary',
              style: { flex: 1 },
              onClick: () => onEdit(widget),
              title: 'Edit XML rule directly',
            },
            '📝 Edit Config'
          )
          : el(
            'button',
            {
              className: 'ts-btn ts-btn-primary',
              style: { flex: 1 },
              onClick: () => onGenerate(widget),
              title: "Open editor with 'Translate This Content' for this item",
            },
            '⚡ Generate'
          )
      )
    );
  }

  // Widget Table Row Component (List / Table View)
  function WidgetTableRow({ widget, onEdit, onGenerate }) {
    const isSupported = widget.status !== 'unsupported';

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
      el(
        'td',
        null,
        el(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } },
          el(
            'span',
            { className: `ts-badge ts-badge-translate ${widget.field_count > 0 ? '' : 'empty'}` },
            `🌐 ${widget.field_count || 0} Translate ${widget.field_count === 1 ? 'field' : 'fields'}`
          ),
          widget.no_translate_count > 0 &&
          el(
            'span',
            { className: 'ts-badge ts-badge-no-translate' },
            `🚫 ${widget.no_translate_count} No Translate`
          )
        )
      ),
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
          isSupported
            ? el(
              'button',
              {
                className: 'ts-btn ts-btn-secondary',
                style: { padding: '6px 12px', fontSize: '12px' },
                onClick: () => onEdit(widget),
                title: 'Edit XML rule directly',
              },
              '📝 Edit Config'
            )
            : el(
              'button',
              {
                className: 'ts-btn ts-btn-primary',
                style: { padding: '6px 12px', fontSize: '12px' },
                onClick: () => onGenerate(widget),
                title: 'Generate XML configuration rule',
              },
              '⚡ Generate'
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
          setEditorCode(`<?xml version="1.0" encoding="UTF-8"?>\n<wpml-config>\n    <elementor-widgets>\n        <widget name="${widget.id}">\n            <fields>\n                <field type="title" editor_type="LINE">title</field>\n            </fields>\n        </widget>\n    </elementor-widgets>\n</wpml-config>`);
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
      { className: 'ts-settings-card', style: { maxWidth: '1000px' } },
      el(
        'div',
        { className: 'ts-settings-card-header' },
        el(
          'div',
          { className: 'ts-settings-card-title-group' },
          el('h3', null, '📝 Editor-Specific XML Configurations'),
          el(
            'p',
            null,
            'TranslateSense maintains isolated XML configuration rules for each editor. Select an editor below to inspect or edit its custom XML mapping.'
          )
        )
      ),

      el(
        'div',
        { style: { display: 'flex', gap: '10px', marginBottom: '16px' } },
        ['gutenberg', 'elementor', 'classic'].map((ed) =>
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

  // Modernized General Settings Panel Component
  function SettingsPanel({ settings, setSettings, onSave, languages, showNotice }) {
    const [showOpenAiKey, setShowOpenAiKey] = useState(false);
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const enabledProviders = settings.enabled_providers || ['chrome_ai', 'openai', 'gemini'];
    const currentDefaultProvider = settings.provider || '';

    const toggleProvider = (providerId) => {
      let updated;
      if (enabledProviders.includes(providerId)) {
        if (enabledProviders.length === 1) {
          showNotice('At least one translation provider must remain enabled.', 'error');
          return;
        }
        updated = enabledProviders.filter((p) => p !== providerId);
      } else {
        updated = [...enabledProviders, providerId];
      }
      setSettings({ ...settings, enabled_providers: updated });
    };

    const handleFormSubmit = async (e) => {
      if (e) e.preventDefault();
      setIsSaving(true);
      try {
        await onSave(e);
      } finally {
        setIsSaving(false);
      }
    };

    // Keyboard shortcut (Ctrl+S / Cmd+S) for rapid save
    useEffect(() => {
      const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          handleFormSubmit();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [settings]);

    // Insert tag token into textarea
    const insertTag = (tag) => {
      const textarea = document.getElementById('ts-custom-prompt-editor');
      const currentVal = settings.custom_prompt !== undefined && settings.custom_prompt !== ''
        ? settings.custom_prompt
        : (settings.default_prompt || '');

      if (!textarea) {
        setSettings({ ...settings, custom_prompt: currentVal + ' ' + tag });
        return;
      }

      const start = textarea.selectionStart || currentVal.length;
      const end = textarea.selectionEnd || currentVal.length;
      const newVal = currentVal.substring(0, start) + tag + currentVal.substring(end);
      setSettings({ ...settings, custom_prompt: newVal });

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tag.length, start + tag.length);
      }, 50);
    };

    const copyPromptToClipboard = () => {
      const val = settings.custom_prompt !== undefined && settings.custom_prompt !== ''
        ? settings.custom_prompt
        : (settings.default_prompt || '');
      navigator.clipboard.writeText(val);
      showNotice('Prompt template copied to clipboard!');
    };

    // Temperature helper text
    const getTemperatureLabel = (temp) => {
      const t = parseFloat(temp);
      if (t <= 0.25) return '0.0 - 0.25: Highly Precise & Literal (Best for UI & Technical Terms)';
      if (t <= 0.6) return '0.3 - 0.6: Balanced & Natural (Recommended)';
      return '0.7 - 1.0: Creative & Fluid (More expressive variation)';
    };

    const currentPromptVal = settings.custom_prompt !== undefined && settings.custom_prompt !== ''
      ? settings.custom_prompt
      : (settings.default_prompt || '');

    const getProviderLogo = (providerId) => {
      const pluginUrl = (window.TranslateSenseData && window.TranslateSenseData.pluginUrl) ? window.TranslateSenseData.pluginUrl : '';
      return pluginUrl ? `${pluginUrl}assets/img/${providerId}.png` : '';
    };

    return el(
      'form',
      { className: 'ts-settings-container', onSubmit: handleFormSubmit },

      // 1. AI Translation Providers Card
      el(
        'div',
        { className: 'ts-settings-card' },
        el(
          'div',
          { className: 'ts-settings-card-header' },
          el(
            'div',
            { className: 'ts-settings-card-title-group' },
            el('h3', null, '🌐 AI Translation Engines & Models'),
            el('p', null, 'Configure active translation engines, API authentication keys, and target neural models.')
          ),
          el(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            el('span', { style: { fontSize: '12px', fontWeight: '600', color: '#64748b' } }, 'Default Engine:'),
            el(
              'select',
              {
                className: 'ts-form-select',
                style: { width: 'auto', padding: '6px 10px', fontSize: '13px', fontWeight: '600' },
                value: currentDefaultProvider,
                onChange: (e) => setSettings({ ...settings, provider: e.target.value }),
              },
              el('option', { value: '' }, '— None (Select in modal) —'),
              el('option', { value: 'openai' }, '🧠 OpenAI (ChatGPT)'),
              el('option', { value: 'gemini' }, '✨ Google Gemini AI'),
              el('option', { value: 'chrome_ai' }, '🤖 Chrome Built-in AI')
            )
          )
        ),

        // Providers 3-Card Grid
        el(
          'div',
          { className: 'ts-providers-grid' },

          // --- OpenAI Card ---
          el(
            'div',
            {
              className: `ts-provider-card openai ${enabledProviders.includes('openai') ? 'enabled' : ''} ${currentDefaultProvider === 'openai' ? 'default-provider' : ''}`,
            },
            el(
              'div',
              { className: 'ts-provider-card-top' },
              el(
                'div',
                { className: 'ts-provider-info' },
                el(
                  'div',
                  { className: 'ts-provider-icon' },
                  el('img', {
                    src: getProviderLogo('openai'),
                    alt: 'OpenAI',
                    className: 'ts-provider-logo-img',
                    onError: (e) => {
                      e.target.style.display = 'none';
                      if (e.target.parentNode) e.target.parentNode.textContent = '🧠';
                    },
                  })
                ),
                el(
                  'div',
                  null,
                  el('h4', { className: 'ts-provider-name' }, 'OpenAI (ChatGPT)'),
                  el(
                    'span',
                    {
                      className: `ts-provider-tag ${!enabledProviders.includes('openai') ? 'offline' : settings.openai_api_key ? 'ready' : 'key-needed'}`,
                    },
                    !enabledProviders.includes('openai')
                      ? 'Disabled'
                      : settings.openai_api_key
                        ? '✓ Configured'
                        : '⚠️ API Key Needed'
                  )
                )
              ),
              el(
                'label',
                { className: 'ts-modern-switch', title: 'Enable/Disable OpenAI' },
                el('input', {
                  type: 'checkbox',
                  checked: enabledProviders.includes('openai'),
                  onChange: () => toggleProvider('openai'),
                }),
                el('span', { className: 'ts-modern-slider' })
              )
            ),
            el('p', { className: 'ts-provider-desc' }, 'Industry standard high-accuracy neural machine translation with strict HTML tags and attribute preservation.'),
            el(
              'div',
              { className: 'ts-provider-body' },
              el(
                'div',
                { className: 'ts-input-group' },
                el(
                  'label',
                  null,
                  el('span', null, 'OpenAI API Key'),
                  el(
                    'a',
                    {
                      href: 'https://platform.openai.com/api-keys',
                      target: '_blank',
                      rel: 'noopener noreferrer',
                      className: 'ts-input-link',
                    },
                    'Get Key ↗'
                  )
                ),
                el(
                  'div',
                  { className: 'ts-input-password-wrap' },
                  el('input', {
                    type: showOpenAiKey ? 'text' : 'password',
                    className: 'ts-form-input',
                    value: settings.openai_api_key || '',
                    placeholder: 'sk-proj-...',
                    disabled: !enabledProviders.includes('openai'),
                    onChange: (e) => setSettings({ ...settings, openai_api_key: e.target.value.trim() }),
                  }),
                  el(
                    'button',
                    {
                      type: 'button',
                      className: 'ts-pw-toggle-btn',
                      title: showOpenAiKey ? 'Hide key' : 'Show key',
                      onClick: () => setShowOpenAiKey(!showOpenAiKey),
                    },
                    showOpenAiKey ? '🙈' : '👁️'
                  )
                )
              ),
              el(
                'div',
                { className: 'ts-input-group' },
                el('label', null, el('span', null, 'Translation Model')),
                el(
                  'select',
                  {
                    className: 'ts-form-select',
                    value: settings.openai_model || 'gpt-4o-mini',
                    disabled: !enabledProviders.includes('openai'),
                    onChange: (e) => setSettings({ ...settings, openai_model: e.target.value }),
                  },
                  el('option', { value: 'gpt-4o-mini' }, 'gpt-4o-mini (⚡ Fast & Cost-Effective) — Recommended'),
                  el('option', { value: 'gpt-4o' }, 'gpt-4o (🧠 Flagship Reasoning)'),
                  el('option', { value: 'gpt-3.5-turbo' }, 'gpt-3.5-turbo (Legacy)')
                )
              )
            )
          ),

          // --- Google Gemini Card ---
          el(
            'div',
            {
              className: `ts-provider-card gemini ${enabledProviders.includes('gemini') ? 'enabled' : ''} ${currentDefaultProvider === 'gemini' ? 'default-provider' : ''}`,
            },
            el(
              'div',
              { className: 'ts-provider-card-top' },
              el(
                'div',
                { className: 'ts-provider-info' },
                el(
                  'div',
                  { className: 'ts-provider-icon' },
                  el('img', {
                    src: getProviderLogo('gemini'),
                    alt: 'Google Gemini AI',
                    className: 'ts-provider-logo-img',
                    onError: (e) => {
                      e.target.style.display = 'none';
                      if (e.target.parentNode) e.target.parentNode.textContent = '✨';
                    },
                  })
                ),
                el(
                  'div',
                  null,
                  el('h4', { className: 'ts-provider-name' }, 'Google Gemini AI'),
                  el(
                    'span',
                    {
                      className: `ts-provider-tag ${!enabledProviders.includes('gemini') ? 'offline' : settings.gemini_api_key ? 'ready' : 'key-needed'}`,
                    },
                    !enabledProviders.includes('gemini')
                      ? 'Disabled'
                      : settings.gemini_api_key
                        ? '✓ Configured'
                        : '⚠️ API Key Needed'
                  )
                )
              ),
              el(
                'label',
                { className: 'ts-modern-switch', title: 'Enable/Disable Gemini' },
                el('input', {
                  type: 'checkbox',
                  checked: enabledProviders.includes('gemini'),
                  onChange: () => toggleProvider('gemini'),
                }),
                el('span', { className: 'ts-modern-slider' })
              )
            ),
            el('p', { className: 'ts-provider-desc' }, 'Ultra-fast contextual multilingual models by Google with massive token windows and excellent localization fluency.'),
            el(
              'div',
              { className: 'ts-provider-body' },
              el(
                'div',
                { className: 'ts-input-group' },
                el(
                  'label',
                  null,
                  el('span', null, 'Gemini API Key'),
                  el(
                    'a',
                    {
                      href: 'https://aistudio.google.com/app/apikey',
                      target: '_blank',
                      rel: 'noopener noreferrer',
                      className: 'ts-input-link',
                    },
                    'Get Key ↗'
                  )
                ),
                el(
                  'div',
                  { className: 'ts-input-password-wrap' },
                  el('input', {
                    type: showGeminiKey ? 'text' : 'password',
                    className: 'ts-form-input',
                    value: settings.gemini_api_key || '',
                    placeholder: 'AIzaSy...',
                    disabled: !enabledProviders.includes('gemini'),
                    onChange: (e) => setSettings({ ...settings, gemini_api_key: e.target.value.trim() }),
                  }),
                  el(
                    'button',
                    {
                      type: 'button',
                      className: 'ts-pw-toggle-btn',
                      title: showGeminiKey ? 'Hide key' : 'Show key',
                      onClick: () => setShowGeminiKey(!showGeminiKey),
                    },
                    showGeminiKey ? '🙈' : '👁️'
                  )
                )
              ),
              el(
                'div',
                { className: 'ts-input-group' },
                el('label', null, el('span', null, 'Translation Model')),
                el(
                  'select',
                  {
                    className: 'ts-form-select',
                    value: settings.gemini_model || 'gemini-1.5-flash',
                    disabled: !enabledProviders.includes('gemini'),
                    onChange: (e) => setSettings({ ...settings, gemini_model: e.target.value }),
                  },
                  el('option', { value: 'gemini-1.5-flash' }, 'gemini-1.5-flash (⚡ High Speed & Quota) — Recommended'),
                  el('option', { value: 'gemini-1.5-pro' }, 'gemini-1.5-pro (🧠 Advanced Multilingual)'),
                  el('option', { value: 'gemini-2.0-flash' }, 'gemini-2.0-flash (🚀 Next-Gen Flash)')
                )
              )
            )
          ),

          // --- Chrome Built-in AI Card ---
          el(
            'div',
            {
              className: `ts-provider-card chrome_ai ${enabledProviders.includes('chrome_ai') ? 'enabled' : ''} ${currentDefaultProvider === 'chrome_ai' ? 'default-provider' : ''}`,
            },
            el(
              'div',
              { className: 'ts-provider-card-top' },
              el(
                'div',
                { className: 'ts-provider-info' },
                el(
                  'div',
                  { className: 'ts-provider-icon' },
                  el('img', {
                    src: getProviderLogo('chrome_ai'),
                    alt: 'Chrome Built-in AI',
                    className: 'ts-provider-logo-img',
                    onError: (e) => {
                      e.target.style.display = 'none';
                      if (e.target.parentNode) e.target.parentNode.textContent = '🤖';
                    },
                  })
                ),
                el(
                  'div',
                  null,
                  el('h4', { className: 'ts-provider-name' }, 'Chrome Built-in AI'),
                  el(
                    'span',
                    { className: 'ts-provider-tag local' },
                    '⚡ Local & Free'
                  )
                )
              ),
              el(
                'label',
                { className: 'ts-modern-switch', title: 'Enable/Disable Chrome Built-in AI' },
                el('input', {
                  type: 'checkbox',
                  checked: enabledProviders.includes('chrome_ai'),
                  onChange: () => toggleProvider('chrome_ai'),
                }),
                el('span', { className: 'ts-modern-slider' })
              )
            ),
            el('p', { className: 'ts-provider-desc' }, '100% private on-device local translation using Chrome 128+ built-in Translation API. Zero cloud latency and zero API cost.'),
            el(
              'div',
              { className: 'ts-provider-body' },
              el(
                'div',
                { style: { padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' } },
                el('div', { style: { fontWeight: '700', color: '#0f172a', marginBottom: '4px' } }, '🔒 On-Device Processing'),
                'No API keys required. Operates directly in supporting browsers with automatic fallback to cloud engines.'
              )
            )
          )
        )
      ),

      // 2. AI Request & Performance Engine Card
      el(
        'div',
        { className: 'ts-settings-card' },
        el(
          'div',
          { className: 'ts-settings-card-header' },
          el(
            'div',
            { className: 'ts-settings-card-title-group' },
            el('h3', null, '⚡ AI Performance & Execution Controls'),
            el('p', null, 'Tune batching concurrency, token allocation, timeouts, and translation creativity.')
          )
        ),
        el(
          'div',
          { className: 'ts-params-grid' },

          // Batch Size
          el(
            'div',
            { className: 'ts-param-card' },
            el(
              'div',
              { className: 'ts-param-header' },
              el('span', { className: 'ts-param-title' }, '📦 Batch Size'),
              el('span', { className: 'ts-param-badge' }, `${settings.batch_size || 25} items`)
            ),
            el('p', { className: 'ts-param-desc' }, 'Translatable strings packaged per single AI request.'),
            el('input', {
              type: 'range',
              min: 1,
              max: 50,
              step: 1,
              className: 'ts-param-slider',
              value: settings.batch_size || 25,
              onChange: (e) => setSettings({ ...settings, batch_size: parseInt(e.target.value, 10) }),
            })
          ),

          // Response Timeout
          el(
            'div',
            { className: 'ts-param-card' },
            el(
              'div',
              { className: 'ts-param-header' },
              el('span', { className: 'ts-param-title' }, '⏱️ Timeout Wait'),
              el('span', { className: 'ts-param-badge' }, `${settings.response_timeout || 30}s`)
            ),
            el('p', { className: 'ts-param-desc' }, 'Maximum wait limit before retrying API translation.'),
            el('input', {
              type: 'range',
              min: 5,
              max: 120,
              step: 5,
              className: 'ts-param-slider',
              value: settings.response_timeout || 30,
              onChange: (e) => setSettings({ ...settings, response_timeout: parseInt(e.target.value, 10) }),
            })
          ),

          // Max Tokens
          el(
            'div',
            { className: 'ts-param-card' },
            el(
              'div',
              { className: 'ts-param-header' },
              el('span', { className: 'ts-param-title' }, '🪙 Max Tokens'),
              el('span', { className: 'ts-param-badge' }, `${(settings.max_tokens || 4096).toLocaleString()}`)
            ),
            el('p', { className: 'ts-param-desc' }, 'Max output tokens allocated for JSON translated responses.'),
            el('input', {
              type: 'range',
              min: 512,
              max: 16384,
              step: 512,
              className: 'ts-param-slider',
              value: settings.max_tokens || 4096,
              onChange: (e) => setSettings({ ...settings, max_tokens: parseInt(e.target.value, 10) }),
            })
          ),

          // Temperature
          el(
            'div',
            { className: 'ts-param-card' },
            el(
              'div',
              { className: 'ts-param-header' },
              el('span', { className: 'ts-param-title' }, '🎯 Temperature'),
              el('span', { className: 'ts-param-badge' }, (settings.temperature !== undefined ? parseFloat(settings.temperature) : 0.2).toFixed(2))
            ),
            el('p', { className: 'ts-param-desc' }, getTemperatureLabel(settings.temperature !== undefined ? settings.temperature : 0.2)),
            el('input', {
              type: 'range',
              min: 0,
              max: 1,
              step: 0.05,
              className: 'ts-param-slider',
              value: settings.temperature !== undefined ? settings.temperature : 0.2,
              onChange: (e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) }),
            })
          )
        )
      ),

      // 3. Custom AI Prompt Engineering Studio Card
      el(
        'div',
        { className: 'ts-settings-card' },
        el(
          'div',
          { className: 'ts-settings-card-header' },
          el(
            'div',
            { className: 'ts-settings-card-title-group' },
            el('h3', null, '📝 AI Prompt Engineering Studio'),
            el('p', null, 'Customize system instructions, tone, and HTML formatting constraints delivered to OpenAI and Gemini.')
          )
        ),
        el(
          'div',
          { className: 'ts-prompt-studio' },
          el(
            'div',
            { className: 'ts-chips-container' },
            el('span', { className: 'ts-chips-title' }, 'Click to insert token:'),
            ['{source_lang}', '{target_lang}', '{count}', '{json_strings}'].map((token) =>
              el(
                'button',
                {
                  key: token,
                  type: 'button',
                  className: 'ts-chip-btn',
                  title: `Insert ${token} into prompt template`,
                  onClick: () => insertTag(token),
                },
                `+ ${token}`
              )
            )
          ),
          el(
            'div',
            { className: 'ts-prompt-editor-wrap' },
            el('textarea', {
              id: 'ts-custom-prompt-editor',
              className: 'ts-prompt-textarea',
              value: currentPromptVal,
              placeholder: 'Enter custom prompt instructions...',
              onChange: (e) => setSettings({ ...settings, custom_prompt: e.target.value }),
              spellCheck: 'false',
            })
          ),
          el(
            'div',
            { className: 'ts-prompt-footer' },
            el(
              'span',
              null,
              `${currentPromptVal.length} characters • ${currentPromptVal.split('\n').length} lines`
            ),
            el(
              'div',
              { style: { display: 'flex', gap: '8px' } },
              el(
                'button',
                {
                  type: 'button',
                  className: 'ts-btn ts-btn-secondary ts-btn-sm',
                  onClick: copyPromptToClipboard,
                },
                '📋 Copy Prompt'
              ),
              el(
                'button',
                {
                  type: 'button',
                  className: 'ts-btn ts-btn-secondary ts-btn-sm',
                  onClick: () => setSettings({ ...settings, custom_prompt: '' }),
                },
                '↺ Reset to Default'
              )
            )
          )
        )
      ),

      // 4. Polylang System & Multilingual Overview Card
      languages && languages.length > 0 &&
      el(
        'div',
        { className: 'ts-settings-card' },
        el(
          'div',
          { className: 'ts-settings-card-header' },
          el(
            'div',
            { className: 'ts-settings-card-title-group' },
            el('h3', null, '🌍 Multilingual Setup (Polylang)'),
            el('p', null, 'Active languages detected from Polylang integration for full-site automatic and editor translations.')
          ),
          el(
            'a',
            {
              href: 'admin.php?page=mlang',
              className: 'ts-btn ts-btn-secondary ts-btn-sm',
            },
            'Manage Languages ↗'
          )
        ),
        el(
          'div',
          { className: 'ts-lang-tags-container' },
          languages.map((l) =>
            el(
              'div',
              {
                key: l.slug || l.code,
                className: `ts-lang-tag ${l.is_default ? 'default' : ''}`,
              },
              el('img', { src: l.flag ? l.flag : '🌐' }),
              el('span', null, l.name || l.slug),
              el('span', { style: { opacity: 0.6, fontSize: '11px', fontFamily: 'monospace' } }, `(${l.slug || l.code})`),
              l.is_default && el('span', { className: 'ts-lang-badge-default' }, 'DEFAULT')
            )
          )
        )
      ),

      // 5. Sticky Bottom Save Bar
      el(
        'div',
        { className: 'ts-save-bar' },
        el(
          'div',
          { className: 'ts-save-status' },
          '💡 Tip: Press ',
          el('kbd', { style: { padding: '2px 6px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', fontWeight: '700' } }, 'Ctrl + S'),
          ' anytime to save settings.'
        ),
        el(
          'div',
          { className: 'ts-save-actions' },
          el(
            'button',
            {
              type: 'submit',
              disabled: isSaving,
              className: 'ts-btn ts-btn-primary',
              style: { padding: '10px 24px', fontSize: '14px' },
            },
            isSaving ? 'Saving...' : '💾 Save Settings'
          )
        )
      )
    );
  }

  // Mount App
  window.addEventListener('DOMContentLoaded', () => {
    const rootEl = document.getElementById('translatesense-admin-root');
    if (rootEl && window.wp && window.wp.element) {
      const root = window.wp.element.createRoot(rootEl);
      root.render(el(TranslateSenseApp));
    }
  });
})();

