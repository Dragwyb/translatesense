/**
 * TranslateSense - React Admin Dashboard
 * 2-column SaaS layout with Translation Overview sidebar, Providers, Dragwyb ecosystem,
 * smart pagination, category/status filters, XML sandbox & modal generation.
 */

(function () {
  const { createElement: el, useState, useEffect, useMemo } = window.wp.element;

  const getPluginUrl = (name) => {
    if (!window.TranslateSenseData || !window.TranslateSenseData.adminUrl) {
      return '#';
    }

    const adminUrl = window.TranslateSenseData.adminUrl;

    return adminUrl + 'plugin-install.php?tab=plugin-information&plugin=' + name + '&TB_iframe=true&width=772&height=380';
  }
  // Crisp Modern SVG Icons
  const Icons = {
    search: (size = 15) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('circle', { cx: 11, cy: 11, r: 8 }),
      el('line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 })
    ),
    pencil: (size = 12) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('path', { d: 'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' })
    ),
    eye: (size = 15) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' }),
      el('circle', { cx: 12, cy: 12, r: 3 })
    ),
    eyeOff: (size = 15) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('path', { d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24' }),
      el('line', { x1: 1, y1: 1, x2: 23, y2: 23 })
    ),
    check: (size = 14) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('polyline', { points: '20 6 9 17 4 12' })
    ),
    alert: (size = 15) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('circle', { cx: 12, cy: 12, r: 10 }),
      el('line', { x1: 12, y1: 8, x2: 12, y2: 12 }),
      el('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 })
    ),
    globe: (size = 20) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('circle', { cx: 12, cy: 12, r: 10 }),
      el('line', { x1: 2, y1: 12, x2: 22, y2: 12 }),
      el('path', { d: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' })
    ),
    clock: (size = 15) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('circle', { cx: 12, cy: 12, r: 10 }),
      el('polyline', { points: '12 6 12 12 16 14' })
    ),
    document: (size = 15) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
      el('polyline', { points: '14 2 14 8 20 8' })
    ),
    layers: (size = 14) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('polygon', { points: '12 2 2 7 12 12 22 7 12 2' }),
      el('polyline', { points: '2 17 12 22 22 17' }),
      el('polyline', { points: '2 12 12 17 22 12' })
    ),
    package: (size = 14) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('path', { d: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' }),
      el('polyline', { points: '3.27 6.96 12 12.01 20.73 6.96' }),
      el('line', { x1: 12, y1: 22.08, x2: 12, y2: 12 })
    ),
    chart: (size = 15) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('line', { x1: 18, y1: 20, x2: 18, y2: 10 }),
      el('line', { x1: 12, y1: 20, x2: 12, y2: 4 }),
      el('line', { x1: 6, y1: 20, x2: 6, y2: 14 })
    ),
    bolt: (size = 13) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('polygon', { points: '13 2 3 14 12 14 11 22 21 10 12 10 13 2' })
    ),
    chat: (size = 15) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' })
    ),
    workflow: (size = 15) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('rect', { x: 3, y: 3, width: 6, height: 6, rx: 1 }),
      el('rect', { x: 15, y: 15, width: 6, height: 6, rx: 1 }),
      el('path', { d: 'M6 9v3a3 3 0 0 0 3 3h6' })
    ),
    shield: (size = 14) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' })
    ),
    lock: (size = 14) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('rect', { x: 3, y: 11, width: 18, height: 11, rx: 2, ry: 2 }),
      el('path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' })
    ),
    spark: (size = 14) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('path', { d: 'm12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z' })
    ),
    close: (size = 14) => el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
      el('line', { x1: 6, y1: 6, x2: 18, y2: 18 })
    ),
  };

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
    const [viewMode, setViewMode] = useState('list'); // 'list' (default) or 'grid'
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
    const [stats, setStats] = useState({
      total_packages: 482,
      cached_results: 152,
      total_posts: 125,
      total_characters: 125400,
      time_taken: '12m 35s',
    });
    const [activeProviders, setActiveProviders] = useState((window.TranslateSenseData && window.TranslateSenseData.activeProviders) || {});
    const [providerModels, setProviderModels] = useState((window.TranslateSenseData && window.TranslateSenseData.providerModels) || {});
    const [connectorsUrl, setConnectorsUrl] = useState((window.TranslateSenseData && window.TranslateSenseData.connectorsUrl) || 'options-connectors.php');
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [sortBy, setSortBy] = useState('name_asc');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10; // Exactly 7 items per page as shown in screenshot

    const [selectedWidget, setSelectedWidget] = useState(null);
    const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
    const [modalTargetBuilder, setModalTargetBuilder] = useState('gutenberg');
    const [notice, setNotice] = useState(null);
    const [isCreatingSandbox, setIsCreatingSandbox] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // Tab Change handler that updates URL query param
    const handleTabChange = (newTab) => {
      setActiveTab(newTab);
      if (['gutenberg', 'elementor'].includes(newTab)) {
        setSearchQuery('');
        setSelectedCategory('all');
        setSelectedStatus('all');
        setSortBy('name_asc');
        setCurrentPage(1);
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
          setStats((prev) => ({ ...prev, ...settingsRes.stats }));
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

    const handleSaveXml = async (newXml, builder = modalTargetBuilder, widgetId = '') => {
      try {
        const payload = { builder, custom_xml: newXml };
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

    const handleSaveSettings = async (newSettings) => {
      setIsSavingSettings(true);
      try {
        const payload = (newSettings && newSettings.enabled_providers) ? newSettings : settings;
        const res = await window.wp.apiFetch({
          path: '/translatesense/v1/settings',
          method: 'POST',
          data: payload,
        });
        showNotice(res.message || 'Settings saved successfully!');
        fetchData();
      } catch (err) {
        showNotice('Error saving settings: ' + (err.message || 'Unknown error'), 'error');
      } finally {
        setIsSavingSettings(false);
      }
    };

    // Global keyboard shortcut (Ctrl+S / Cmd+S) for rapid save when on settings tab
    useEffect(() => {
      const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          if (activeTab === 'settings') {
            e.preventDefault();
            handleSaveSettings(settings);
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, settings]);

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

    // Calculate unique categories for active tab
    const availableCategories = useMemo(() => {
      const items = widgetsData[activeTab] || [];
      const cats = new Set();
      items.forEach((item) => {
        if (item.category && typeof item.category === 'string') {
          if (item.category.includes(',')) {
            const catArray = item.category.split(',');
            catArray.forEach((cat) => cats.add(cat.trim()));
          } else {
            cats.add(item.category);
          }
        }
      });
      return Array.from(cats).sort((a, b) => a.localeCompare(b));
    }, [widgetsData, activeTab]);

    // Filter and sort items for active tab
    const filteredWidgets = useMemo(() => {
      let items = [...(widgetsData[activeTab] || [])];

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        items = items.filter((item) =>
          (item.name && item.name.toLowerCase().includes(q)) ||
          (item.id && item.id.toLowerCase().includes(q))
        );
      }

      if (selectedCategory && selectedCategory !== 'all') {
        items = items.filter((item) => item.category === selectedCategory);
      }

      if (selectedStatus && selectedStatus !== 'all') {
        items = items.filter((item) => item.status === selectedStatus);
      }

      items.sort((a, b) => {
        const nameA = (a.name || a.id || '').toLowerCase();
        const nameB = (b.name || b.id || '').toLowerCase();

        if (sortBy === 'name_desc') return nameB.localeCompare(nameA);
        if (sortBy === 'fields_desc') return (b.field_count || 0) - (a.field_count || 0) || nameA.localeCompare(nameB);
        if (sortBy === 'fields_asc') return (a.field_count || 0) - (b.field_count || 0) || nameA.localeCompare(nameB);
        if (sortBy === 'status') {
          const rank = { custom: 1, supported: 2, unsupported: 3 };
          return (rank[a.status] || 4) - (rank[b.status] || 4) || nameA.localeCompare(nameB);
        }
        return nameA.localeCompare(nameB); // Default name_asc
      });

      return items;
    }, [widgetsData, activeTab, searchQuery, selectedCategory, selectedStatus, sortBy]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredWidgets.length / pageSize) || 1;
    const paginatedWidgets = useMemo(() => {
      const start = (currentPage - 1) * pageSize;
      return filteredWidgets.slice(start, start + pageSize);
    }, [filteredWidgets, currentPage, pageSize]);

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

      // 1. Top Header Bar
      el(TopHeader),

      // 2. Notification Banner
      notice &&
      el(
        'div',
        { className: `ts-notice-banner ${notice.type}` },
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          notice.type === 'error' ? Icons.alert(16) : Icons.check(16),
          el('span', null, notice.text)
        ),
        el('button', { className: 'ts-notice-close', onClick: () => setNotice(null), 'aria-label': 'Close' }, Icons.close(14))
      ),

      // 3. Two-Column Layout (Main Area + Right Sidebar)
      el(
        'div',
        { className: 'ts-dashboard-layout' },

        // Left Main Column
        el(
          'main',
          { className: 'ts-main-column' },

          // Tabs Card
          el(
            'nav',
            { className: 'ts-tabs-card' },
            activeBuilders.gutenberg &&
            el(
              'button',
              {
                type: 'button',
                className: `ts-tab-btn ${activeTab === 'settings' ? 'active' : ''}`,
                onClick: () => handleTabChange('settings'),
              },
              'General Settings'
            ),
            el(
              'button',
              {
                type: 'button',
                className: `ts-tab-btn ${activeTab === 'gutenberg' ? 'active' : ''}`,
                onClick: () => handleTabChange('gutenberg'),
              },
              'Gutenberg Blocks',
              el('span', { className: 'ts-tab-count' }, widgetsData.gutenberg ? widgetsData.gutenberg.length : 0)
            ),
            activeBuilders.elementor &&
            el(
              'button',
              {
                type: 'button',
                className: `ts-tab-btn ${activeTab === 'elementor' ? 'active' : ''}`,
                onClick: () => handleTabChange('elementor'),
              },
              'Elementor Widgets',
              el('span', { className: 'ts-tab-count' }, widgetsData.elementor ? widgetsData.elementor.length : 0)
            ),
          ),

          // Content of Tab
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

              // Search & Filter Card
              el(
                'div',
                { className: 'ts-filter-card' },

                // Row 1: Search + 3 Dropdowns
                el(
                  'div',
                  { className: 'ts-filter-row-top' },
                  el(
                    'div',
                    { className: 'ts-search-box' },
                    el('span', { className: 'ts-search-icon' }, Icons.search()),
                    el('input', {
                      type: 'text',
                      className: 'ts-search-input',
                      placeholder: `Search ${activeTab === 'gutenberg' ? 'Gutenberg blocks' : 'Elementor widgets'}...`,
                      value: searchQuery,
                      onChange: (e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      },
                    })
                  ),
                  el(
                    'select',
                    {
                      className: 'ts-filter-select',
                      value: selectedCategory,
                      onChange: (e) => {
                        setSelectedCategory(e.target.value);
                        setCurrentPage(1);
                      },
                    },
                    el('option', { value: 'all' }, 'All Categories'),
                    availableCategories.map((cat) =>
                      el('option', { key: cat, value: cat }, cat.charAt(0).toUpperCase() + cat.slice(1))
                    )
                  ),
                  el(
                    'select',
                    {
                      className: 'ts-filter-select',
                      value: selectedStatus,
                      onChange: (e) => {
                        setSelectedStatus(e.target.value);
                        setCurrentPage(1);
                      },
                    },
                    el('option', { value: 'all' }, 'All Statuses'),
                    el('option', { value: 'supported' }, 'Supported'),
                    el('option', { value: 'custom' }, 'Custom Config'),
                    el('option', { value: 'unsupported' }, 'Unsupported')
                  ),
                  el(
                    'select',
                    {
                      className: 'ts-filter-select',
                      value: sortBy,
                      onChange: (e) => {
                        setSortBy(e.target.value);
                        setCurrentPage(1);
                      },
                    },
                    el('option', { value: 'name_asc' }, 'Name (A to Z)'),
                    el('option', { value: 'name_desc' }, 'Name (Z to A)'),
                    el('option', { value: 'fields_desc' }, 'Fields (High to Low)'),
                    el('option', { value: 'fields_asc' }, 'Fields (Low to High)'),
                    el('option', { value: 'status' }, 'Status (Supported first)')
                  )
                ),

                // Row 2: View Switcher (Left) + Actions (Right)
                el(
                  'div',
                  { className: 'ts-filter-row-bottom' },
                  el(
                    'div',
                    { className: 'ts-view-switcher-group' },
                    el(
                      'div',
                      { className: 'ts-view-switcher' },
                      el(
                        'button',
                        {
                          type: 'button',
                          className: `ts-view-btn ${viewMode === 'grid' ? 'active' : ''}`,
                          onClick: () => setViewMode('grid'),
                        },
                        'Grid'
                      ),
                      el(
                        'button',
                        {
                          type: 'button',
                          className: `ts-view-btn ${viewMode === 'list' ? 'active' : ''}`,
                          onClick: () => setViewMode('list'),
                        },
                        'List'
                      )
                    ),
                    (searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all' || sortBy !== 'name_asc') &&
                    el(
                      'button',
                      {
                        type: 'button',
                        className: 'ts-reset-filter-btn',
                        onClick: () => {
                          setSearchQuery('');
                          setSelectedCategory('all');
                          setSelectedStatus('all');
                          setSortBy('name_asc');
                          setCurrentPage(1);
                        },
                      },
                      'Reset'
                    )
                  ),
                  el(
                    'div',
                    { className: 'ts-filter-actions-right' },
                    el(
                      'button',
                      {
                        type: 'button',
                        className: 'ts-btn-action-primary',
                        disabled: isCreatingSandbox,
                        onClick: () => handleGenerateConfigSandbox(activeTab),
                      },
                      isCreatingSandbox ? 'Opening...' : `Generate ${activeTab === 'gutenberg' ? 'Gutenberg' : 'Elementor'} Config`
                    ),
                    el(
                      'button',
                      {
                        type: 'button',
                        className: 'ts-btn-action-outline',
                        onClick: () => {
                          setSelectedWidget(null);
                          setModalTargetBuilder(activeTab);
                          setIsXmlModalOpen(true);
                        },
                      },
                      el('span', { style: { display: 'inline-flex', marginRight: '6px' } }, Icons.pencil(13)),
                      `Edit ${activeTab === 'gutenberg' ? 'Gutenberg' : 'Elementor'} Config`
                    )
                  )
                )
              ),

              // Table / Grid Content
              viewMode === 'grid'
                ? el(
                  'div',
                  null,
                  el(
                    'div',
                    { className: 'ts-widget-grid' },
                    paginatedWidgets.length > 0
                      ? paginatedWidgets.map((widget) =>
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
                  ),
                  el(PaginationBar, {
                    currentPage,
                    totalPages,
                    totalItems: filteredWidgets.length,
                    pageSize,
                    activeTab,
                    onPageChange: (p) => setCurrentPage(p),
                  })
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
                        el('th', { style: { width: '32%' } }, 'BLOCK / WIDGET NAME'),
                        el('th', { style: { width: '20%' } }, 'CATEGORY'),
                        el('th', { style: { width: '22%' } }, 'MAPPED FIELDS'),
                        el('th', { style: { width: '14%' } }, 'STATUS'),
                        el('th', { style: { width: '12%', textAlign: 'right' } }, 'ACTIONS')
                      )
                    ),
                    el(
                      'tbody',
                      null,
                      paginatedWidgets.length > 0
                        ? paginatedWidgets.map((widget) =>
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
                  ),
                  el(PaginationBar, {
                    currentPage,
                    totalPages,
                    totalItems: filteredWidgets.length,
                    pageSize,
                    activeTab,
                    onPageChange: (p) => setCurrentPage(p),
                  })
                )
            )
        ),

        // Right Sidebar Column
        el(RightSidebar, {
          stats,
          activeProviders,
          settings,
        })
      ),

      // 4. Modern Bottom Footer Bar
      el(FooterBar, {
        activeTab,
        onSaveSettings: () => handleSaveSettings(settings),
        isSaving: isSavingSettings,
      }),

      // 5. XML Config Modal
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

  // Top Header Component
  function TopHeader() {
    const docsUrl = (window.TranslateSenseData && window.TranslateSenseData.docsUrl) || 'https://docs.dragwyb.com/';
    const supportUrl = 'https://dragwyb.com/support/';
    const pluginUrl = (window.TranslateSenseData && window.TranslateSenseData.pluginUrl) ? window.TranslateSenseData.pluginUrl : '';

    return el(
      'header',
      { className: 'ts-top-header' },
      el(
        'div',
        { className: 'ts-top-brand' },
        el(
          'div',
          { className: 'ts-brand-logo-wrap' },
          el('img', { src: pluginUrl + 'assets/img/logo.png', alt: 'TranslateSense Logo' })
        ),
        el('h1', { className: 'ts-brand-title' }, 'TranslateSense')
      ),
      el(
        'div',
        { className: 'ts-top-actions' },
        el(
          'a',
          {
            href: docsUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'ts-header-action-btn',
          },

          el('span', { className: 'ts-header-btn-text' }, 'Documentation'),
          el('span', { className: 'ts-external-arrow' }, '↗')
        ),
        el(
          'a',
          {
            href: supportUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'ts-header-action-btn',
          },

          el('span', { className: 'ts-header-btn-text' }, 'Support'),
          el('span', { className: 'ts-external-arrow' }, '↗')
        )
      )
    );
  }

  // Right Sidebar Component
  function RightSidebar({ stats = {}, activeProviders = {}, settings = {} }) {
    const totalPosts = stats.total_posts ? Number(stats.total_posts).toLocaleString() : '125';
    const totalStrings = stats.cached_results
      ? (stats.cached_results >= 1000 ? (stats.cached_results / 1000).toFixed(1) + 'K' : stats.cached_results)
      : '8.4K';
    const totalCharacters = stats.total_characters
      ? (stats.total_characters >= 1000 ? (stats.total_characters / 1000).toFixed(1) + 'K' : stats.total_characters)
      : '125.4K';
    const timeTaken = stats.time_taken || '12m 35s';
    const cachedCount = stats.cached_results ? `${Number(stats.cached_results).toLocaleString()} Strings` : '152 Strings';
    const packagesCount = stats.total_packages ? Number(stats.total_packages).toLocaleString() : '482';

    return el(
      'aside',
      { className: 'ts-sidebar' },

      // Card 1: Translation Overview
      el(
        'div',
        { className: 'ts-sidebar-card' },
        el(
          'h3',
          { className: 'ts-sidebar-title' },
          el('span', { className: 'ts-title-icon' }, Icons.chart(15)),
          'Translation Overview'
        ),
        el(
          'div',
          { className: 'ts-overview-grid' },
          el(
            'div',
            { className: 'ts-overview-metric' },
            el('div', { className: 'ts-metric-icon-box' }, Icons.document(15)),
            el(
              'div',
              { className: 'ts-metric-details' },
              el('div', { className: 'ts-metric-num' }, totalPosts),
              el('div', { className: 'ts-metric-sub' }, 'Total Posts')
            )
          ),
          el(
            'div',
            { className: 'ts-overview-metric' },
            el('div', { className: 'ts-metric-icon-box' }, '</>'),
            el(
              'div',
              { className: 'ts-metric-details' },
              el('div', { className: 'ts-metric-num' }, totalStrings),
              el('div', { className: 'ts-metric-sub' }, 'Strings')
            )
          ),
          el(
            'div',
            { className: 'ts-overview-metric' },
            el('div', { className: 'ts-metric-icon-box' }, 'A'),
            el(
              'div',
              { className: 'ts-metric-details' },
              el('div', { className: 'ts-metric-num' }, totalCharacters),
              el('div', { className: 'ts-metric-sub' }, 'Characters')
            )
          ),
          el(
            'div',
            { className: 'ts-overview-metric' },
            el('div', { className: 'ts-metric-icon-box' }, Icons.clock(15)),
            el(
              'div',
              { className: 'ts-metric-details' },
              el('div', { className: 'ts-metric-num' }, timeTaken),
              el('div', { className: 'ts-metric-sub' }, 'Time Taken')
            )
          )
        ),
        el('div', { className: 'ts-sidebar-divider' }),
        el(
          'div',
          { className: 'ts-overview-subgrid' },
          el(
            'div',
            { className: 'ts-subgrid-col' },
            el('div', { className: 'ts-subgrid-header' }, el('span', { className: 'ts-subgrid-icon' }, Icons.layers(14)), el('span', null, cachedCount)),
            el('div', { className: 'ts-subgrid-lbl' }, 'Translation Cache')
          ),
          el(
            'div',
            { className: 'ts-subgrid-col' },
            el('div', { className: 'ts-subgrid-header' }, el('span', { className: 'ts-subgrid-icon' }, Icons.package(14)), el('span', null, packagesCount)),
            el('div', { className: 'ts-subgrid-lbl' }, 'Active Packages')
          )
        )
      ),

      // Card 2: Translation Providers
      el(
        'div',
        { className: 'ts-sidebar-card' },
        el(
          'h3',
          { className: 'ts-sidebar-title' },
          el('span', { className: 'ts-title-icon' }, Icons.bolt(14)),
          'Translation Providers'
        ),
        el(
          'div',
          { className: 'ts-provider-pills' },
          el(
            'div',
            { className: 'ts-provider-pill' },
            el('span', { className: 'ts-dot green' }),
            'OpenAI'
          ),
          el(
            'div',
            { className: 'ts-provider-pill' },
            el('span', { className: 'ts-dot blue' }),
            'Gemini'
          ),
          el(
            'div',
            { className: 'ts-provider-pill' },
            el('span', { className: 'ts-dot purple' }),
            'Chrome'
          )
        )
      ),

      // Card 3: More by Dragwyb
      el(
        'div',
        { className: 'ts-sidebar-card' },
        el(
          'h3',
          { className: 'ts-sidebar-title' },
          el('span', { className: 'ts-title-icon' }, Icons.spark(14)),
          'More by Dragwyb'
        ),
        el(
          'div',
          { className: 'ts-dragwyb-list' },
          el(
            'a',
            {
              href: getPluginUrl('smart-form-builder-by-dragwyb'),
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'ts-dragwyb-item thickbox open-plugin-details-modal',
            },
            el('div', { className: 'ts-dragwyb-icon red' }, Icons.document(15)),
            el(
              'div',
              { className: 'ts-dragwyb-info' },
              el('div', { className: 'ts-dragwyb-title' }, 'Dragwyb Forms'),
              el('div', { className: 'ts-dragwyb-desc' }, 'Advanced contact forms and lead generation.')
            ),
            el('span', { className: 'ts-dragwyb-arrow' }, '›')
          ),
          el(
            'a',
            {
              href: getPluginUrl('dragwyb-click-to-chat'),
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'ts-dragwyb-item thickbox open-plugin-details-modal',
            },
            el('div', { className: 'ts-dragwyb-icon green' }, Icons.chat(15)),
            el(
              'div',
              { className: 'ts-dragwyb-info' },
              el('div', { className: 'ts-dragwyb-title' }, 'Dragwyb Click to Chat'),
              el('div', { className: 'ts-dragwyb-desc' }, 'AI chatbot and customer support.')
            ),
            el('span', { className: 'ts-dragwyb-arrow' }, '›')
          ),
          el(
            'a',
            {
              href: getPluginUrl('dragwyb-ai-agent-workflows'),
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'ts-dragwyb-item thickbox open-plugin-details-modal',
            },
            el('div', { className: 'ts-dragwyb-icon purple' }, Icons.workflow(15)),
            el(
              'div',
              { className: 'ts-dragwyb-info' },
              el('div', { className: 'ts-dragwyb-title' }, 'AI Agent Workflows'),
              el('div', { className: 'ts-dragwyb-desc' }, 'Automate WordPress workflows with AI agents.')
            ),
            el('span', { className: 'ts-dragwyb-arrow' }, '›')
          )
        )
      )
    );
  }

  // Footer Bar Component
  function FooterBar({ activeTab, onSaveSettings, isSaving }) {
    return el(
      'footer',
      { className: 'ts-footer-bar' },
      el(
        'div',
        { className: 'ts-footer-left' },
        el(
          'span',
          { className: 'ts-footer-logo' },
          el('span', { className: 'ts-footer-logo-d' }, 'D'),
          'Dragwyb'
        ),
        el('span', null, 'Built with ❤️ by Dragwyb')
      ),
      activeTab === 'settings' &&
      el(
        'div',
        { className: 'ts-footer-right' },
        el(
          'div',
          { className: 'ts-save-status' },
          'Tip: Press ',
          el('kbd', { className: 'ts-kbd-shortcut' }, 'Ctrl + S')
        ),
        el(
          'button',
          {
            type: 'button',
            disabled: isSaving,
            onClick: onSaveSettings,
            className: 'ts-btn ts-btn-primary button-primary',
          },
          isSaving ? 'Saving...' : 'Save Settings'
        )
      )
    );
  }

  // Pagination Controls Bar
  function PaginationBar({ currentPage, totalPages, totalItems, pageSize, activeTab, onPageChange }) {
    if (totalItems <= 0) return null;

    const startIdx = (currentPage - 1) * pageSize + 1;
    const endIdx = Math.min(currentPage * pageSize, totalItems);
    const unit = activeTab === 'gutenberg' ? 'blocks' : 'widgets';

    const getRange = () => {
      if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }
      if (currentPage <= 4) {
        return [1, 2, 3, 4, 5, '...', totalPages];
      }
      if (currentPage >= totalPages - 3) {
        return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
      }
      return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
    };

    const pages = getRange();

    return el(
      'div',
      { className: 'ts-pagination-bar' },
      el(
        'div',
        { className: 'ts-pagination-info' },
        `Showing ${startIdx}–${endIdx} of ${totalItems} ${unit}`
      ),
      el(
        'div',
        { className: 'ts-pagination-controls' },
        el(
          'button',
          {
            type: 'button',
            className: 'ts-page-nav-btn',
            disabled: currentPage <= 1,
            onClick: () => onPageChange(currentPage - 1),
          },
          '< Prev'
        ),
        pages.map((p, idx) =>
          p === '...'
            ? el('span', { key: `dots-${idx}`, className: 'ts-page-dots' }, '...')
            : el(
              'button',
              {
                key: p,
                type: 'button',
                className: `ts-page-num-btn ${currentPage === p ? 'active' : ''}`,
                onClick: () => onPageChange(p),
              },
              p
            )
        ),
        el(
          'button',
          {
            type: 'button',
            className: 'ts-page-nav-btn',
            disabled: currentPage >= totalPages,
            onClick: () => onPageChange(currentPage + 1),
          },
          'Next >'
        )
      )
    );
  }

  // Table Row Component (List View)
  function WidgetTableRow({ widget, onEdit, onGenerate }) {
    const isSupported = widget.status !== 'unsupported';
    const fieldCount = widget.field_count || 0;

    return el(
      'tr',
      null,
      // Column 1: BLOCK / WIDGET NAME
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
      // Column 2: CATEGORY
      el(
        'td',
        null,
        el('span', { className: 'ts-category-text' }, widget.category || 'standard')
      ),
      // Column 3: MAPPED FIELDS
      el(
        'td',
        null,
        el(
          'span',
          { className: `ts-mapped-badge ${fieldCount > 0 ? 'active' : 'empty'}` },

          `${fieldCount} Translate ${fieldCount === 1 ? 'field' : 'fields'}`
        )
      ),
      // Column 4: STATUS
      el(
        'td',
        null,
        widget.status === 'supported'
          ? el('span', { className: 'ts-table-status supported' }, 'Supported')
          : widget.status === 'custom'
            ? el('span', { className: 'ts-table-status custom' }, 'Supported')
            : el('span', { className: 'ts-table-status unsupported' }, 'Unsupported')
      ),
      // Column 5: ACTIONS
      el(
        'td',
        { style: { textAlign: 'right' } },
        isSupported
          ? el(
            'button',
            {
              type: 'button',
              className: 'ts-table-btn edit',
              onClick: () => onEdit(widget),
              title: 'Edit XML rule directly',
            },
            el('span', { style: { display: 'inline-flex', marginRight: '5px' } }, Icons.pencil(12)),
            'Edit Config'
          )
          : el(
            'button',
            {
              type: 'button',
              className: 'ts-table-btn generate',
              onClick: () => onGenerate(widget),
              title: 'Generate XML configuration rule',
            },
            'Generate'
          )
      )
    );
  }

  // Widget Card Component (Grid View)
  function WidgetCard({ widget, activeTab, onEdit, onGenerate }) {
    const isSupported = widget.status !== 'unsupported';
    const fieldCount = widget.field_count || 0;

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
          { className: `ts-table-status ${widget.status}` },
          widget.status === 'supported' ? 'Supported' : widget.status === 'custom' ? 'Custom' : 'Unsupported'
        )
      ),
      el(
        'div',
        { className: 'ts-card-meta' },
        el('span', { style: { fontWeight: 600, color: '#334155' } }, widget.category || 'standard'),
        el(
          'span',
          { className: `ts-mapped-badge ${fieldCount > 0 ? 'active' : 'empty'}` },
          `${fieldCount} Translate ${fieldCount === 1 ? 'field' : 'fields'}`
        )
      ),
      el(
        'div',
        { className: 'ts-card-actions' },
        isSupported
          ? el(
            'button',
            {
              type: 'button',
              className: 'ts-table-btn edit',
              style: { width: '100%' },
              onClick: () => onEdit(widget),
            },
            el('span', { style: { display: 'inline-flex', marginRight: '5px' } }, Icons.pencil(12)), 'Edit Config'
          )
          : el(
            'button',
            {
              type: 'button',
              className: 'ts-table-btn generate',
              style: { width: '100%' },
              onClick: () => onGenerate(widget),
            },
            'Generate'
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
          el('button', { className: 'ts-modal-close', onClick: onClose, 'aria-label': 'Close' }, Icons.close(16))
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
            'Save Config'
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
        await onSave(settings);
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
          openAiTagText = 'Activate Provider';
          openAiConnectorDesc = 'WordPress AI Connector plugin for OpenAI is installed but inactive. Please activate it in WordPress Connectors.';
          openAiConnectorBtnText = 'Activate in WP Connectors ↗';
        } else if (!openAiStatus.isConnected) {
          openAiTagClass = 'key-needed';
          openAiTagText = 'API Key Needed';
          openAiConnectorDesc = 'WordPress AI Connector plugin is active. API key is needed. Configure your OpenAI credentials directly in WordPress Connectors.';
          openAiConnectorBtnText = 'Connect in WP Connectors ↗';
        } else {
          openAiTagClass = 'wp-connector';
          openAiTagText = 'WP Connector Active';
          openAiConnectorDesc = 'Managed natively via WordPress 7.0+ AI Client. Global credentials and connections are handled securely by core.';
          openAiConnectorBtnText = 'Manage in WP Connectors ↗';
        }
      } else {
        const hasOpenAiKey = Boolean(typeof settings.openai_api_key === 'string' ? settings.openai_api_key.trim() : settings.openai_api_key);
        openAiTagClass = hasOpenAiKey ? 'ready' : 'key-needed';
        openAiTagText = hasOpenAiKey ? 'Configured' : 'API Key Needed';
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
          geminiTagText = 'Activate Provider';
          geminiConnectorDesc = 'WordPress AI Connector plugin for Google Gemini is installed but inactive. Please activate it in WordPress Connectors.';
          geminiConnectorBtnText = 'Activate in WP Connectors ↗';
        } else if (!geminiStatus.isConnected) {
          geminiTagClass = 'key-needed';
          geminiTagText = 'API Key Needed';
          geminiConnectorDesc = 'WordPress AI Connector plugin is active. API key is needed. Configure your Google Gemini credentials directly in WordPress Connectors.';
          geminiConnectorBtnText = 'Connect in WP Connectors ↗';
        } else {
          geminiTagClass = 'wp-connector';
          geminiTagText = 'WP Connector Active';
          geminiConnectorDesc = 'Managed natively via WordPress 7.0+ AI Client (Google). Global credentials and connections are handled securely by core.';
          geminiConnectorBtnText = 'Manage in WP Connectors ↗';
        }
      } else {
        const hasGeminiKey = Boolean(typeof settings.gemini_api_key === 'string' ? settings.gemini_api_key.trim() : settings.gemini_api_key);
        geminiTagClass = hasGeminiKey ? 'ready' : 'key-needed';
        geminiTagText = hasGeminiKey ? 'Configured' : 'API Key Needed';
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
            el('div', { className: 'ts-settings-globe-icon' }, Icons.globe(22)),
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
                      if (e.target.parentNode) e.target.parentNode.textContent = 'AI';
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
                    el('span', { className: 'ts-connector-icon' }, Icons.bolt(12)),
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
                      showOpenAiKey ? Icons.eyeOff(15) : Icons.eye(15)
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
                      if (e.target.parentNode) e.target.parentNode.textContent = 'AI';
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
                    el('span', { className: 'ts-connector-icon' }, Icons.bolt(12)),
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
                      showGeminiKey ? Icons.eyeOff(15) : Icons.eye(15)
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
                      if (e.target.parentNode) e.target.parentNode.textContent = 'AI';
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
                    'Local & Free'
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
                  el('div', { className: 'ts-feature-icon-circle blue' }, Icons.shield(14)),
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
                  el('div', { className: 'ts-feature-icon-circle green' }, Icons.lock(14)),
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
                  el('div', { className: 'ts-feature-icon-circle amber' }, Icons.bolt(14)),
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
            el('h3', null, 'AI Performance & Execution Controls'),
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
              el('span', { className: 'ts-param-title' }, 'Batch Size'),
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
              el('span', { className: 'ts-param-title' }, 'Timeout Wait'),
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
              el('span', { className: 'ts-param-title' }, 'Max Tokens'),
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
              el('span', { className: 'ts-param-title' }, 'Temperature'),
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
            el('h3', null, 'Create Post Settings'),
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
                el('span', { className: 'ts-param-title' }, 'Post Status'),
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
                el('span', { className: 'ts-param-title' }, 'Slug Translation'),
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
            el('h3', null, 'AI Prompt Engineering Studio'),
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
              { className: 'ts-prompt-actions' },
              el(
                'button',
                {
                  type: 'button',
                  className: 'ts-btn ts-btn-secondary ts-btn-sm',
                  onClick: copyPromptToClipboard,
                },
                'Copy Prompt'
              ),
              el(
                'button',
                {
                  type: 'button',
                  className: 'ts-btn ts-btn-secondary ts-btn-sm',
                  onClick: () => setSettings({ ...settings, custom_prompt: '' }),
                },
                'Reset to Default'
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
            el('h3', null, 'Multilingual Setup (Polylang)'),
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
              l.flag ? el('img', { src: l.flag }) : el('span', { className: 'ts-lang-fallback' }, l.code ? l.code.toUpperCase() : ''),
              el('span', null, l.name || l.slug),
              el('span', { style: { opacity: 0.6, fontSize: '11px', fontFamily: 'monospace' } }, `(${l.slug || l.code})`),
              l.is_default && el('span', { className: 'ts-lang-badge-default' }, 'DEFAULT')
            )
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
