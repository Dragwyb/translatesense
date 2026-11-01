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
      const validTabs = ['gutenberg', 'elementor', 'settings'];
      if (urlTab && validTabs.includes(urlTab)) {
        return urlTab;
      }
      return 'gutenberg';
    };

    const [activeBuilders, setActiveBuilders] = useState(TranslateSenseData.activeBuilders || { gutenberg: true, elementor: false });
    const [activeTab, setActiveTab] = useState(getInitialTab);
    const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
    const [widgetsData, setWidgetsData] = useState({ gutenberg: [], elementor: [] });
    const [xmlConfigs, setXmlConfigs] = useState({
      all: '',
      gutenberg: '',
      elementor: '',
    });
    const [settings, setSettings] = useState({
      openai_api_key: '',
      openai_model: 'gpt-4o-mini',
      gemini_api_key: '',
      gemini_model: 'gemini-3.5-flash-lite',
      enabled_providers: ['chrome_ai', 'openai', 'gemini'],
      batch_size: 5,
    });
    const [languages, setLanguages] = useState([]);
    const [stats, setStats] = useState({ total_packages: 0, cached_results: 0 });
    const [activeProviders, setActiveProviders] = useState((window.TranslateSenseData && window.TranslateSenseData.activeProviders) || {});
    const [providerModels, setProviderModels] = useState((window.TranslateSenseData && window.TranslateSenseData.providerModels) || {});
    const [connectorsUrl, setConnectorsUrl] = useState((window.TranslateSenseData && window.TranslateSenseData.connectorsUrl) || 'options-connectors.php');
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
      if (['gutenberg', 'elementor'].includes(newTab)) {
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
        const validTabs = ['gutenberg', 'elementor', 'settings'];
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

        });

        if (settingsRes.settings) {
          const s = settingsRes.settings;
          setSettings({
            ...s,
            gemini_api_key: typeof s.gemini_api_key === 'string' ? s.gemini_api_key : '',
            openai_api_key: typeof s.openai_api_key === 'string' ? s.openai_api_key : '',
          });
        }
        if (settingsRes.languages) {
          setLanguages(settingsRes.languages);
        }
        if (settingsRes.stats) {
          setStats(settingsRes.stats);
        }
        if (settingsRes.active_providers) {
          setActiveProviders(settingsRes.active_providers);
        }
        if (settingsRes.provider_models) {
          setProviderModels(settingsRes.provider_models);
        }
        if (settingsRes.connectors_url) {
          setConnectorsUrl(settingsRes.connectors_url);
        }
        if (settingsRes.active_builders) {
          setActiveBuilders(settingsRes.active_builders);
          if (!settingsRes.active_builders[activeTab] && activeTab !== 'settings') {
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
        const payload = { ...settings };
        if (typeof payload.gemini_api_key !== 'string') {
          payload.gemini_api_key = '';
        }
        if (typeof payload.openai_api_key !== 'string') {
          payload.openai_api_key = '';
        }
        const res = await window.wp.apiFetch({
          path: '/translatesense/v1/settings',
          method: 'POST',
          data: payload,
        });
        showNotice(res.message || 'Settings saved successfully!');
        if (res.settings) {
          setSettings((prev) => ({
            ...prev,
            ...res.settings,
            gemini_api_key: typeof res.settings.gemini_api_key === 'string' ? res.settings.gemini_api_key : '',
            openai_api_key: typeof res.settings.openai_api_key === 'string' ? res.settings.openai_api_key : '',
          }));
        }
        if (res.active_providers) setActiveProviders(res.active_providers);
        if (res.provider_models) setProviderModels(res.provider_models);
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
          activeProviders,
          connectorsUrl,
          providerModels,
        })
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
                  className: 'ts-btn ts-btn-primary button-primary',
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
        ),
        ((widget.xpaths && widget.xpaths.length > 0) || widget.xpath) &&
        el(
          'span',
          {
            className: 'ts-badge ts-badge-xpath',
            title: widget.xpaths && widget.xpaths.length > 0
              ? widget.xpaths.map((x) => (x.type ? `[${x.type}] ${x.value}` : x.value)).join('\n')
              : `XPath: ${widget.xpath}`,
            style: {
              background: '#ecfdf5',
              color: '#047857',
              border: '1px solid #a7f3d0',
              fontWeight: 500,
            },
          },
          widget.xpaths && widget.xpaths.length > 1
            ? `🎯 ${widget.xpaths.length} XPaths`
            : `🎯 ${(widget.xpath || (widget.xpaths && widget.xpaths[0] && widget.xpaths[0].value) || '').slice(0, 22)}`
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
              className: 'ts-btn ts-btn-primary button-primary',
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
          ),
          ((widget.xpaths && widget.xpaths.length > 0) || widget.xpath) &&
          el(
            'span',
            {
              className: 'ts-badge ts-badge-xpath',
              title: widget.xpaths && widget.xpaths.length > 0
                ? widget.xpaths.map((x) => (x.type ? `[${x.type}] ${x.value}` : x.value)).join('\n')
                : `XPath: ${widget.xpath}`,
              style: {
                background: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
                fontWeight: 500,
              },
            },
            widget.xpaths && widget.xpaths.length > 1
              ? `🎯 ${widget.xpaths.length} XPaths`
              : `🎯 ${(widget.xpath || (widget.xpaths && widget.xpaths[0] && widget.xpaths[0].value) || '').slice(0, 22)}`
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
                className: 'ts-btn ts-btn-primary button-primary',
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

  // Helper for injecting child <xpath> tags into Gutenberg blocks XML snippet
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

    return xmlStr.slice(0, match.index) + openTag + inner + '\n        ' + match[3] + xmlStr.slice(match.index + match[0].length);
  }

  // XML Config Modal Component
  function XmlConfigModal({ widget, builder, xmlCode, onClose, onSave }) {
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
        } else if ('gutenberg' === builder) {
          initialCode = `<?xml version="1.0" encoding="UTF-8"?>\n<wpml-config>\n    <gutenberg-blocks>\n        <gutenberg-block type="${widget.id}" translate="1">\n            <key name="content" type="text" editor_type="VISUAL" />\n        </gutenberg-block>\n    </gutenberg-blocks>\n</wpml-config>`;
        } else if ('elementor' === builder) {
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

    return el(
      'div',
      { className: 'ts-modal-overlay', onClick: onClose },
      el(
        'div',
        { className: 'ts-modal-container', onClick: (e) => e.stopPropagation() },
        el(
          'div',
          { className: 'ts-modal-header' },
          el(
            'h3',
            null,
            widget
              ? `Configure XML: ${widget.name} (${builder.toUpperCase()})`
              : `Edit ${builder.toUpperCase()} Custom XML Configuration`
          ),
          el('button', { className: 'ts-modal-close', onClick: onClose }, '✕')
        ),
        el(
          'div',
          { className: 'ts-modal-body' },
          el(
            'p',
            { style: { fontSize: '13px', color: '#64748b', marginTop: 0 } },
            isGutenberg
              ? 'Specify translation mappings and child <xpath> tags for GUTENBERG. When saved, this updates the active configuration.'
              : `Specify translation mappings for ${builder.toUpperCase()}. When saved, this updates the active configuration.`
          ),
          el('textarea', {
            className: 'ts-xml-editor',
            style: { height: '380px' },
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
              className: 'ts-btn ts-btn-primary button-primary',
              onClick: () => onSave(editorCode),
            },
            '💾 Save Config'
          )
        )
      )
    );
  }

  // Modernized General Settings Panel Component
  function SettingsPanel({
    settings,
    setSettings,
    onSave,
    languages,
    showNotice,
    activeProviders = {},
    connectorsUrl = 'options-connectors.php',
    providerModels = {},
  }) {
    const [showOpenAiKey, setShowOpenAiKey] = useState(false);
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const enabledProviders = settings.enabled_providers || ['chrome_ai', 'openai', 'gemini'];
    const currentDefaultProvider = settings.provider || '';

    const getProviderStatus = (id) => {
      if (activeProviders && typeof activeProviders === 'object' && activeProviders[id]) {
        const meta = activeProviders[id];
        return {
          isConnected: meta.isConnected !== false,
          connectors: Boolean(meta.connectors),
          isProviderInstall: meta.isProviderInstall !== undefined ? Boolean(meta.isProviderInstall) : true,
          isProviderActive: meta.isProviderActive !== undefined ? Boolean(meta.isProviderActive) : true,
        };
      }
      const isKeyConfigured = (id === 'openai')
        ? Boolean(typeof settings.openai_api_key === 'string' ? settings.openai_api_key.trim() : settings.openai_api_key)
        : (id === 'gemini')
          ? Boolean(typeof settings.gemini_api_key === 'string' ? settings.gemini_api_key.trim() : settings.gemini_api_key)
          : true;
      return {
        isConnected: isKeyConfigured,
        connectors: false,
        isProviderInstall: false,
        isProviderActive: false,
      };
    };

    const openAiStatus = getProviderStatus('openai');
    const geminiStatus = getProviderStatus('gemini');

    const defaultOpenAiModels = [
      { id: 'gpt-4o-mini', name: 'gpt-4o-mini ( Fast & Cost-Effective )' },
      { id: 'gpt-4o', name: 'gpt-4o ( Flagship Reasoning )' },
      { id: 'gpt-3.5-turbo', name: 'gpt-3.5-turbo ( Legacy )' },
    ];
    const defaultGeminiModels = [
      { id: 'gemini-3.8-flash', name: 'gemini-3.8-flash ( High Speed & Quality )' },
      { id: 'gemini-3.5-live-translate', name: 'gemini-3.5-live-translate ( Advanced Multilingual )' },
      { id: 'gemini-3.5-flash-lite', name: 'gemini-3.5-flash-lite ( Next-Gen Flash )' },
    ];

    const openAiModels = (providerModels && Array.isArray(providerModels.openai) && providerModels.openai.length > 0)
      ? providerModels.openai
      : defaultOpenAiModels;

    const geminiModels = (providerModels && Array.isArray(providerModels.gemini) && providerModels.gemini.length > 0)
      ? providerModels.gemini
      : (providerModels && Array.isArray(providerModels.google) && providerModels.google.length > 0)
        ? providerModels.google
        : defaultGeminiModels;

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
      return pluginUrl ? `${pluginUrl}assets/img/providers/${providerId}.png` : '';
    };

    // Determine OpenAI badge tag class, label, description & action button
    let openAiTagClass = 'offline';
    let openAiTagText = 'Disabled';
    let openAiConnectorDesc = '';
    let openAiConnectorBtnText = '';

    if (enabledProviders.includes('openai')) {
      if (openAiStatus.connectors && openAiStatus.isProviderInstall) {
        if (!openAiStatus.isProviderActive) {
          openAiTagClass = 'setup-connector';
          openAiTagText = '⚠️ Activate Provider';
          openAiConnectorDesc = 'WordPress AI Connector plugin for OpenAI is installed but inactive. Please activate it in WordPress Connectors.';
          openAiConnectorBtnText = '↗ Activate in WP Connectors';
        } else if (!openAiStatus.isConnected) {
          openAiTagClass = 'key-needed';
          openAiTagText = '⚠️ API Key Needed';
          openAiConnectorDesc = 'WordPress AI Connector plugin is active. API key is needed. Configure your OpenAI credentials directly in WordPress Connectors.';
          openAiConnectorBtnText = '↗ Connect in WP Connectors';
        } else {
          openAiTagClass = 'wp-connector';
          openAiTagText = '⚡ WP Connector Active';
          openAiConnectorDesc = 'Managed natively via WordPress 7.0+ AI Client. Global credentials and connections are handled securely by core.';
          openAiConnectorBtnText = '↗ Manage in WP Connectors';
        }
      } else {
        const hasOpenAiKey = Boolean(typeof settings.openai_api_key === 'string' ? settings.openai_api_key.trim() : settings.openai_api_key);
        openAiTagClass = hasOpenAiKey ? 'ready' : 'key-needed';
        openAiTagText = hasOpenAiKey ? '✓ Configured' : '⚠️ API Key Needed';
      }
    }

    // Determine Gemini badge tag class, label, description & action button
    let geminiTagClass = 'offline';
    let geminiTagText = 'Disabled';
    let geminiConnectorDesc = '';
    let geminiConnectorBtnText = '';

    if (enabledProviders.includes('gemini')) {
      if (geminiStatus.connectors && geminiStatus.isProviderInstall) {
        if (!geminiStatus.isProviderActive) {
          geminiTagClass = 'setup-connector';
          geminiTagText = '⚠️ Activate Provider';
          geminiConnectorDesc = 'WordPress AI Connector plugin for Google Gemini is installed but inactive. Please activate it in WordPress Connectors.';
          geminiConnectorBtnText = '↗ Activate in WP Connectors';
        } else if (!geminiStatus.isConnected) {
          geminiTagClass = 'key-needed';
          geminiTagText = '⚠️ API Key Needed';
          geminiConnectorDesc = 'WordPress AI Connector plugin is active. API key is needed. Configure your Google Gemini credentials directly in WordPress Connectors.';
          geminiConnectorBtnText = '↗ Connect in WP Connectors';
        } else {
          geminiTagClass = 'wp-connector';
          geminiTagText = '⚡ WP Connector Active';
          geminiConnectorDesc = 'Managed natively via WordPress 7.0+ AI Client (Google). Global credentials and connections are handled securely by core.';
          geminiConnectorBtnText = '↗ Manage in WP Connectors';
        }
      } else {
        const hasGeminiKey = Boolean(typeof settings.gemini_api_key === 'string' ? settings.gemini_api_key.trim() : settings.gemini_api_key);
        geminiTagClass = hasGeminiKey ? 'ready' : 'key-needed';
        geminiTagText = hasGeminiKey ? '✓ Configured' : '⚠️ API Key Needed';
      }
    }

    const isOpenAiConnected = (openAiStatus.connectors && openAiStatus.isProviderInstall)
      ? Boolean(openAiStatus.isConnected && openAiStatus.isProviderActive)
      : Boolean(typeof settings.openai_api_key === 'string' ? settings.openai_api_key.trim() : settings.openai_api_key);

    const isGeminiConnected = (geminiStatus.connectors && geminiStatus.isProviderInstall)
      ? Boolean(geminiStatus.isConnected && geminiStatus.isProviderActive)
      : Boolean(typeof settings.gemini_api_key === 'string' ? settings.gemini_api_key.trim() : settings.gemini_api_key);

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
            { className: 'ts-settings-title-wrap' },
            el('div', { className: 'ts-settings-globe-icon' }, '🌐'),
            el(
              'div',
              { className: 'ts-settings-card-title-group' },
              el('h3', null, 'AI Translation Engines & Models'),
              el('p', null, 'Configure active translation engines, API authentication keys, and target neural models.')
            )
          ),
          el(
            'div',
            { className: 'ts-default-engine-wrap' },
            el('span', { className: 'ts-default-engine-label' }, 'Default Engine:'),
            el(
              'div',
              { className: 'ts-default-engine-select-box' },
              currentDefaultProvider &&
              el('img', {
                src: getProviderLogo(currentDefaultProvider),
                alt: currentDefaultProvider,
                className: 'ts-default-engine-logo',
                onError: (e) => { e.target.style.display = 'none'; },
              }),
              el(
                'select',
                {
                  className: 'ts-default-engine-select',
                  value: currentDefaultProvider,
                  onChange: (e) => setSettings({ ...settings, provider: e.target.value }),
                },
                el('option', { value: '' }, '— Select Default —'),
                el('option', { value: 'chrome_ai' }, 'Chrome Built-in AI'),
                el('option', { value: 'openai' }, 'OpenAI (ChatGPT)'),
                el('option', { value: 'gemini' }, 'Google Gemini AI')
              )
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
                      className: `ts-provider-tag ${openAiTagClass}`,
                    },
                    openAiTagText
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
              (openAiStatus.connectors && openAiStatus.isProviderInstall)
                ? el(
                  'div',
                  { className: 'ts-connector-box' },
                  el(
                    'div',
                    { className: 'ts-connector-header' },
                    el('span', { className: 'ts-connector-icon' }, '⚡'),
                    el('span', { className: 'ts-connector-title' }, 'WordPress AI Connector')
                  ),
                  el('p', { className: 'ts-connector-desc' }, openAiConnectorDesc),
                  el(
                    'a',
                    {
                      href: connectorsUrl,
                      target: '_blank',
                      rel: 'noopener noreferrer',
                      className: 'ts-btn-connector',
                      title: 'Manage directly in WordPress Connectors',
                    },
                    openAiConnectorBtnText
                  )
                )
                : el(
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
                      value: (typeof settings.openai_api_key === 'string') ? settings.openai_api_key : '',
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
              isOpenAiConnected
                ? el(
                  'div',
                  { className: 'ts-input-group' },
                  el('label', null, el('span', null, 'Translation Model')),
                  el(
                    'select',
                    {
                      className: 'ts-form-select',
                      value: settings.openai_model || (openAiModels[0] && openAiModels[0].id) || 'gpt-4o-mini',
                      disabled: !enabledProviders.includes('openai'),
                      onChange: (e) => setSettings({ ...settings, openai_model: e.target.value }),
                    },
                    openAiModels.map((m) =>
                      el('option', { key: m.id, value: m.id }, m.name ? (m.name === m.id ? m.id : `${m.name}`) : m.id)
                    )
                  )
                )
                : null
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
                      className: `ts-provider-tag ${geminiTagClass}`,
                    },
                    geminiTagText
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
              (geminiStatus.connectors && geminiStatus.isProviderInstall)
                ? el(
                  'div',
                  { className: 'ts-connector-box' },
                  el(
                    'div',
                    { className: 'ts-connector-header' },
                    el('span', { className: 'ts-connector-icon' }, '⚡'),
                    el('span', { className: 'ts-connector-title' }, 'WordPress AI Connector')
                  ),
                  el('p', { className: 'ts-connector-desc' }, geminiConnectorDesc),
                  el(
                    'a',
                    {
                      href: connectorsUrl,
                      target: '_blank',
                      rel: 'noopener noreferrer',
                      className: 'ts-btn-connector',
                      title: 'Manage directly in WordPress Connectors',
                    },
                    geminiConnectorBtnText
                  )
                )
                : el(
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
                      value: (typeof settings.gemini_api_key === 'string') ? settings.gemini_api_key : '',
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
              isGeminiConnected
                ? el(
                  'div',
                  { className: 'ts-input-group' },
                  el('label', null, el('span', null, 'Translation Model')),
                  el(
                    'select',
                    {
                      className: 'ts-form-select',
                      value: settings.gemini_model || 'gemini-3.5-flash-lite',
                      disabled: !enabledProviders.includes('gemini'),
                      onChange: (e) => setSettings({ ...settings, gemini_model: e.target.value }),
                    },
                    geminiModels.map((m) =>
                      el('option', { key: m.id, value: m.id }, m.name ? (m.name === m.id ? m.id : `${m.name}`) : m.id)
                    )
                  )
                )
                : null
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
                { className: 'ts-chrome-features-wrap' },
                el(
                  'div',
                  { className: 'ts-feature-item' },
                  el('div', { className: 'ts-feature-icon-circle blue' }, '🛡️'),
                  el(
                    'div',
                    { className: 'ts-feature-text' },
                    el('span', { className: 'ts-feature-title' }, 'On-Device Processing'),
                    el('span', { className: 'ts-feature-subtext' }, 'No API keys required. Operates directly in supporting browsers.')
                  )
                ),
                el(
                  'div',
                  { className: 'ts-feature-item' },
                  el('div', { className: 'ts-feature-icon-circle green' }, '🔒'),
                  el(
                    'div',
                    { className: 'ts-feature-text' },
                    el('span', { className: 'ts-feature-title' }, '100% Local Processing'),
                    el('span', { className: 'ts-feature-subtext' }, 'Your data stays on your device.')
                  )
                ),
                el(
                  'div',
                  { className: 'ts-feature-item' },
                  el('div', { className: 'ts-feature-icon-circle amber' }, '⚡'),
                  el(
                    'div',
                    { className: 'ts-feature-text' },
                    el('span', { className: 'ts-feature-title' }, 'Zero Latency & Zero Cost'),
                    el('span', { className: 'ts-feature-subtext' }, 'Fast, private and always available.')
                  )
                )
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

      // 3. Create Post Settings Card (Applied for Bulk Translation)
      el(
        'div',
        { className: 'ts-settings-card' },
        el(
          'div',
          { className: 'ts-settings-card-header' },
          el(
            'div',
            { className: 'ts-settings-card-title-group' },
            el('h3', null, '📄 Create Post Settings'),
            el('p', null, 'Configure default post status and URL slug handling applied during bulk translation.')
          )
        ),
        el(
          'div',
          { className: 'ts-params-grid' },

          // Post Status Setting
          (() => {
            const validStatuses = ['draft', 'publish'];
            const curStatus = validStatuses.includes(settings.post_status) ? settings.post_status : 'draft';
            return el(
              'div',
              { className: 'ts-param-card' },
              el(
                'div',
                { className: 'ts-param-header' },
                el('span', { className: 'ts-param-title' }, '📌 Post Status'),
                el('span', { className: 'ts-param-badge' }, curStatus.toUpperCase())
              ),
              el('p', { className: 'ts-param-desc' }, 'Status for created posts in bulk translation (Draft or Publish).'),
              el(
                'select',
                {
                  className: 'ts-form-select',
                  value: curStatus,
                  onChange: (e) => {
                    const val = String(e.target.value || '').trim().toLowerCase();
                    if (validStatuses.includes(val)) {
                      setSettings({ ...settings, post_status: val });
                    }
                  },
                },
                el('option', { value: 'draft' }, 'Draft (Default)'),
                el('option', { value: 'publish' }, 'Publish')
              )
            );
          })(),

          // Slug Translation Setting
          (() => {
            const validSlugTrans = ['slug_translate', 'title_based', 'keep_orignal'];
            const curSlugTrans = validSlugTrans.includes(settings.slug_translation) ? settings.slug_translation : 'slug_translate';
            return el(
              'div',
              { className: 'ts-param-card' },
              el(
                'div',
                { className: 'ts-param-header' },
                el('span', { className: 'ts-param-title' }, '🔗 Slug Translation'),
                el(
                  'span',
                  { className: 'ts-param-badge' },
                  curSlugTrans === 'keep_orignal'
                    ? 'Keep Original'
                    : curSlugTrans === 'title_based'
                      ? 'Title Based'
                      : 'Translate'
                )
              ),
              el('p', { className: 'ts-param-desc' }, 'Determines how post URL slugs are handled during bulk translation.'),
              el(
                'select',
                {
                  className: 'ts-form-select',
                  value: curSlugTrans,
                  onChange: (e) => {
                    const val = String(e.target.value || '').trim().toLowerCase();
                    if (validSlugTrans.includes(val)) {
                      setSettings({ ...settings, slug_translation: val });
                    }
                  },
                },
                el('option', { value: 'slug_translate' }, 'Translate Slug (Default)'),
                el('option', { value: 'title_based' }, 'Generate from Translated Title'),
                el('option', { value: 'keep_orignal' }, 'Keep Original Slug')
              )
            );
          })()
        )
      ),

      // 4. Custom AI Prompt Engineering Studio Card
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
              className: 'ts-btn ts-btn-primary button-primary',
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

