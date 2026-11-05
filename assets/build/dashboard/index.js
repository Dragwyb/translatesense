/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/components/CopyToClipbord/index.js"
/*!************************************************!*\
  !*** ./src/components/CopyToClipbord/index.js ***!
  \************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
const copyToClipboard = async ({
  value = '',
  onCopy = () => {},
  onClose = () => {},
  onSuccess = () => {},
  onError = () => {},
  resetDelay = 1000
} = {}) => {
  if (value == null || value === '') return false;
  try {
    const text = String(value);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      if (!copied) {
        console.error('Unable to copy text.');
      }
    }
    if (typeof onCopy === 'function') onCopy();
    if (typeof onClose === 'function') onClose();
    if (resetDelay > 0) {
      setTimeout(onSuccess, resetDelay);
    } else {
      onSuccess();
    }
    return true;
  } catch (error) {
    if (typeof onError === 'function') {
      onError(error);
    }
    return false;
  }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (copyToClipboard);

/***/ },

/***/ "./src/dashboard/DashboardApp.jsx"
/*!****************************************!*\
  !*** ./src/dashboard/DashboardApp.jsx ***!
  \****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DashboardApp: () => (/* binding */ DashboardApp)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _hooks_useDashboardData__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./hooks/useDashboardData */ "./src/dashboard/hooks/useDashboardData.js");
/* harmony import */ var _components_TopHeader__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./components/TopHeader */ "./src/dashboard/components/TopHeader.jsx");
/* harmony import */ var _components_RightSidebar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./components/RightSidebar */ "./src/dashboard/components/RightSidebar.jsx");
/* harmony import */ var _components_FooterBar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./components/FooterBar */ "./src/dashboard/components/FooterBar.jsx");
/* harmony import */ var _components_HomeGuidePanel__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./components/HomeGuidePanel */ "./src/dashboard/components/HomeGuidePanel.jsx");
/* harmony import */ var _components_SettingsTab__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./components/SettingsTab */ "./src/dashboard/components/SettingsTab.jsx");
/* harmony import */ var _components_BuilderConfigTab__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./components/BuilderConfigTab */ "./src/dashboard/components/BuilderConfigTab.jsx");
/* harmony import */ var _components_CacheTab__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./components/CacheTab */ "./src/dashboard/components/CacheTab.jsx");
/* harmony import */ var _components_XmlConfigModal__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./components/XmlConfigModal */ "./src/dashboard/components/XmlConfigModal.jsx");
/* harmony import */ var _components_DashboardIcons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./components/DashboardIcons */ "./src/dashboard/components/DashboardIcons.jsx");
/* harmony import */ var _services_dashboardService__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./services/dashboardService */ "./src/dashboard/services/dashboardService.js");
/* harmony import */ var _services_api_apiClient__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../services/api/apiClient */ "./src/services/api/apiClient.js");
/* harmony import */ var _services_api_endpoints__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../services/api/endpoints */ "./src/services/api/endpoints.js");

/**
 * TranslateSense Dashboard Application Root
 * 2-Column SaaS Layout with TopHeader, Tab Switcher, HomeGuidePanel, Settings,
 * Gutenberg/Elementor Builders, Cache Manager, RightSidebar, and FooterBar.
 */















function DashboardApp() {
  const {
    activeTab,
    changeTab,
    activeBuilders,
    widgetsData,
    settings,
    setSettings,
    languages,
    stats,
    activeProviders,
    providerModels,
    connectorsUrl,
    cacheCounts,
    setCacheCounts,
    loading,
    notice,
    showNotice,
    dismissNotice,
    loadData
  } = (0,_hooks_useDashboardData__WEBPACK_IMPORTED_MODULE_2__.useDashboardData)();
  const [xmlModal, setXmlModal] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)({
    isOpen: false,
    builder: 'gutenberg',
    widget: null,
    xmlCode: ''
  });
  const [isCreatingSandbox, setIsCreatingSandbox] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  const [isSavingSettings, setIsSavingSettings] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  const [isRefreshingCache, setIsRefreshingCache] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  const localizedData = typeof window !== 'undefined' && window.TranslateSenseData || {};

  // Global keyboard shortcut (Ctrl+S / Cmd+S) to save settings when on settings tab
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    const handleKeyDown = e => {
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
  const handleSaveSettings = async newSettings => {
    setIsSavingSettings(true);
    try {
      const payload = newSettings && newSettings.enabled_providers ? newSettings : settings;
      const res = await _services_dashboardService__WEBPACK_IMPORTED_MODULE_12__.saveSettings(payload);
      if (res && res.success !== false) {
        showNotice(res.message || 'Settings saved successfully!');
        loadData();
      } else {
        showNotice(res && res.message || 'Failed to save settings', 'error');
      }
    } catch (err) {
      showNotice('Error saving settings: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };
  const handleOpenXmlModal = async (builder, widget = null) => {
    let xmlCode = '';
    if (!widget) {
      try {
        const res = await _services_dashboardService__WEBPACK_IMPORTED_MODULE_12__.fetchXmlConfig(builder);
        xmlCode = res.xml || res.custom_xml || '';
      } catch {
        xmlCode = '';
      }
    }
    setXmlModal({
      isOpen: true,
      builder: builder || activeTab,
      widget,
      xmlCode
    });
  };
  const handleCloseXmlModal = () => {
    setXmlModal({
      isOpen: false,
      builder: 'gutenberg',
      widget: null,
      xmlCode: ''
    });
  };
  const handleSaveXml = async newXml => {
    try {
      const res = await _services_dashboardService__WEBPACK_IMPORTED_MODULE_12__.saveXmlConfig(xmlModal.builder, newXml);
      showNotice(res.message || 'XML configuration saved successfully!');
      handleCloseXmlModal();
      loadData();
    } catch (err) {
      showNotice('Error saving XML: ' + (err.message || 'Validation error'), 'error');
    }
  };
  const handleGenerateConfigSandbox = async (builder = activeTab, widgetSlug = '') => {
    setIsCreatingSandbox(true);
    try {
      const res = await (0,_services_api_apiClient__WEBPACK_IMPORTED_MODULE_13__.apiRequest)(_services_api_endpoints__WEBPACK_IMPORTED_MODULE_14__.ENDPOINTS.DASHBOARD.GENERATE_SANDBOX, {
        method: 'POST',
        data: {
          builder,
          widget_slug: widgetSlug
        }
      });
      if (res && res.editor_url) {
        showNotice(`Opening ${builder.toUpperCase()} Editor sandbox... Add widget with placeholder 'Translate This Content'.`);
        window.open(res.editor_url, '_blank');
      } else {
        showNotice('Sandbox generated, but no editor URL was returned.', 'info');
      }
    } catch (err) {
      showNotice('Failed to open mapping sandbox: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsCreatingSandbox(false);
    }
  };
  const handleRefreshCache = async () => {
    setIsRefreshingCache(true);
    try {
      const res = await _services_dashboardService__WEBPACK_IMPORTED_MODULE_12__.fetchCacheStats();
      if (res && res.counts) {
        setCacheCounts(res.counts);
      }
      showNotice('Cache statistics refreshed successfully!');
    } catch (err) {
      showNotice('Failed to refresh cache stats: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsRefreshingCache(false);
    }
  };
  const handleClearCache = async type => {
    try {
      const res = await _services_dashboardService__WEBPACK_IMPORTED_MODULE_12__.clearCache(type);
      if (res && res.counts) {
        setCacheCounts(res.counts);
      }
      showNotice(res.message || 'Cache cleared successfully!');
      loadData();
    } catch (err) {
      showNotice('Failed to clear cache: ' + (err.message || 'Unknown error'), 'error');
    }
  };
  if (loading) {
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      className: "translatesense-dashboard"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_TopHeader__WEBPACK_IMPORTED_MODULE_3__.TopHeader, {
      docsUrl: localizedData.docsUrl,
      supportUrl: "https://dragwyb.com/support/",
      pluginUrl: localizedData.pluginUrl
    }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      className: "ts-loading-placeholder"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      className: "ts-spinner"
    }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", null, "Loading TranslateSense Dashboard...")));
  }
  const totalCacheRecords = (cacheCounts.strings || 0) + (cacheCounts.translations || 0) + (cacheCounts.packages || 0) + (cacheCounts.logs || 0);
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "translatesense-dashboard"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_TopHeader__WEBPACK_IMPORTED_MODULE_3__.TopHeader, {
    docsUrl: localizedData.docsUrl,
    supportUrl: "https://dragwyb.com/support/",
    pluginUrl: localizedData.pluginUrl
  }), notice && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: `ts-notice-banner ${notice.type || 'info'}`
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }
  }, notice.type === 'error' ? _components_DashboardIcons__WEBPACK_IMPORTED_MODULE_11__.DashboardIcons.alert({
    size: 16
  }) : _components_DashboardIcons__WEBPACK_IMPORTED_MODULE_11__.DashboardIcons.check({
    size: 16
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, notice.message || notice.text)), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-notice-close",
    onClick: dismissNotice,
    "aria-label": "Close"
  }, _components_DashboardIcons__WEBPACK_IMPORTED_MODULE_11__.DashboardIcons.close({
    size: 14
  }))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-dashboard-layout"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("main", {
    className: "ts-main-column"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("nav", {
    className: "ts-tabs-card",
    "aria-label": "Dashboard Tabs"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: `ts-tab-btn ${activeTab === 'home' ? 'active' : ''}`,
    onClick: () => changeTab('home')
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-tab-icon",
    style: {
      display: 'inline-flex',
      marginRight: '6px'
    }
  }, _components_DashboardIcons__WEBPACK_IMPORTED_MODULE_11__.DashboardIcons.home({
    size: 14
  })), "Home"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: `ts-tab-btn ${activeTab === 'settings' ? 'active' : ''}`,
    onClick: () => changeTab('settings')
  }, "General Settings"), activeBuilders.gutenberg && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: `ts-tab-btn ${activeTab === 'gutenberg' ? 'active' : ''}`,
    onClick: () => changeTab('gutenberg')
  }, "Gutenberg Blocks", (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-tab-count"
  }, widgetsData.gutenberg ? widgetsData.gutenberg.length : 0)), activeBuilders.elementor && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: `ts-tab-btn ${activeTab === 'elementor' ? 'active' : ''}`,
    onClick: () => changeTab('elementor')
  }, "Elementor Widgets", (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-tab-count"
  }, widgetsData.elementor ? widgetsData.elementor.length : 0)), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: `ts-tab-btn ${activeTab === 'cache' ? 'active' : ''}`,
    onClick: () => changeTab('cache')
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-tab-icon",
    style: {
      display: 'inline-flex',
      marginRight: '6px'
    }
  }, _components_DashboardIcons__WEBPACK_IMPORTED_MODULE_11__.DashboardIcons.database({
    size: 14
  })), "Cache", (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-tab-count"
  }, totalCacheRecords.toLocaleString()))), activeTab === 'home' && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_HomeGuidePanel__WEBPACK_IMPORTED_MODULE_6__.HomeGuidePanel, {
    onNavigateTab: changeTab,
    activeBuilders: activeBuilders,
    activeProviders: activeProviders,
    languages: languages,
    cacheCounts: cacheCounts,
    polylangActive: localizedData.polylangActive !== false,
    bulkTranslateUrl: "edit.php"
  }), activeTab === 'settings' && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_SettingsTab__WEBPACK_IMPORTED_MODULE_7__.SettingsTab, {
    settings: settings,
    setSettings: setSettings,
    onSave: handleSaveSettings,
    languages: languages,
    showNotice: showNotice,
    activeProviders: activeProviders,
    connectorsUrl: connectorsUrl,
    providerModels: providerModels
  }), (activeTab === 'gutenberg' || activeTab === 'elementor') && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_BuilderConfigTab__WEBPACK_IMPORTED_MODULE_8__.BuilderConfigTab, {
    key: activeTab,
    activeTab: activeTab,
    widgets: widgetsData[activeTab] || [],
    onOpenXmlModal: handleOpenXmlModal,
    onGenerateSandbox: handleGenerateConfigSandbox,
    isCreatingSandbox: isCreatingSandbox
  }), activeTab === 'cache' && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_CacheTab__WEBPACK_IMPORTED_MODULE_9__.CacheTab, {
    cacheCounts: cacheCounts,
    onRefreshCache: handleRefreshCache,
    isRefreshing: isRefreshingCache,
    onClearCache: handleClearCache
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_RightSidebar__WEBPACK_IMPORTED_MODULE_4__.RightSidebar, {
    stats: stats
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_FooterBar__WEBPACK_IMPORTED_MODULE_5__.FooterBar, {
    activeTab: activeTab,
    onSaveSettings: () => handleSaveSettings(settings),
    isSaving: isSavingSettings,
    cacheCounts: cacheCounts,
    onRefreshCache: handleRefreshCache,
    isRefreshing: isRefreshingCache,
    onClearCache: handleClearCache,
    pluginUrl: localizedData.pluginUrl
  }), xmlModal.isOpen && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_XmlConfigModal__WEBPACK_IMPORTED_MODULE_10__.XmlConfigModal, {
    widget: xmlModal.widget,
    builder: xmlModal.builder,
    xmlCode: xmlModal.xmlCode,
    onClose: handleCloseXmlModal,
    onSave: handleSaveXml
  }));
}

/***/ },

/***/ "./src/dashboard/components/BuilderConfigTab.jsx"
/*!*******************************************************!*\
  !*** ./src/dashboard/components/BuilderConfigTab.jsx ***!
  \*******************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BuilderConfigTab: () => (/* binding */ BuilderConfigTab)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _WidgetCard__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./WidgetCard */ "./src/dashboard/components/WidgetCard.jsx");
/* harmony import */ var _WidgetTableRow__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./WidgetTableRow */ "./src/dashboard/components/WidgetTableRow.jsx");
/* harmony import */ var _PaginationBar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./PaginationBar */ "./src/dashboard/components/PaginationBar.jsx");
/* harmony import */ var _DashboardIcons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./DashboardIcons */ "./src/dashboard/components/DashboardIcons.jsx");

/**
 * BuilderConfigTab Component - Gutenberg Blocks & Elementor Widgets Manager
 */






function BuilderConfigTab({
  activeTab,
  widgets = [],
  onOpenXmlModal,
  onGenerateSandbox,
  isCreatingSandbox = false
}) {
  const [searchQuery, setSearchQuery] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)('');
  const [selectedCategory, setSelectedCategory] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)('all');
  const [selectedStatus, setSelectedStatus] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)('all');
  const [sortBy, setSortBy] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)('status');
  const [viewMode, setViewMode] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)('grid');
  const [currentPage, setCurrentPage] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(1);
  const pageSize = 12;

  // Derive unique categories
  const availableCategories = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    const set = new Set();
    widgets.forEach(w => {
      if (w.category && typeof w.category === 'string') {
        if (w.category.includes(',')) {
          const catArray = w.category.split(',');
          catArray.forEach(cat => set.add(cat.trim()));
        } else {
          set.add(w.category);
        }
      }
    });
    return Array.from(set).sort();
  }, [widgets]);

  // Filter and sort items
  const filteredWidgets = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    let items = [...widgets];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(w => w.name && w.name.toLowerCase().includes(q) || w.id && w.id.toLowerCase().includes(q));
    }
    if (selectedCategory !== 'all') {
      items = items.filter(w => w.category === selectedCategory);
    }
    if (selectedStatus !== 'all') {
      items = items.filter(w => {
        if (selectedStatus === 'supported') return w.status === 'supported' || w.status === 'custom';
        if (selectedStatus === 'custom') return w.status === 'custom';
        if (selectedStatus === 'unsupported') return w.status === 'unsupported';
        return true;
      });
    }
    items.sort((a, b) => {
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'fields_desc') return (b.field_count || 0) - (a.field_count || 0);
      if (sortBy === 'fields_asc') return (a.field_count || 0) - (b.field_count || 0);
      if (sortBy === 'status') {
        const order = {
          custom: 1,
          supported: 2,
          unsupported: 3
        };
        return (order[a.status] || 99) - (order[b.status] || 99);
      }
      return 0;
    });
    return items;
  }, [widgets, searchQuery, selectedCategory, selectedStatus, sortBy]);

  // Pagination
  const totalItems = filteredWidgets.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedWidgets = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredWidgets.slice(start, start + pageSize);
  }, [filteredWidgets, validCurrentPage, pageSize]);
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSortBy('status');
    setCurrentPage(1);
  };
  const isFiltered = searchQuery.trim() !== '' || selectedCategory !== 'all' || selectedStatus !== 'all' || sortBy !== 'status';
  const builderName = activeTab === 'gutenberg' ? 'Gutenberg' : 'Elementor';
  const unitName = activeTab === 'gutenberg' ? 'blocks' : 'widgets';
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-filter-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-filter-row-top"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-search-box"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-search-icon"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_5__.DashboardIcons.search()), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("input", {
    type: "text",
    className: "ts-search-input",
    placeholder: `Search ${builderName} ${unitName}...`,
    value: searchQuery,
    onChange: e => {
      setSearchQuery(e.target.value);
      setCurrentPage(1);
    }
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("select", {
    className: "ts-filter-select",
    value: selectedCategory,
    onChange: e => {
      setSelectedCategory(e.target.value);
      setCurrentPage(1);
    }
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "all"
  }, "All Categories"), availableCategories.map(cat => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    key: cat,
    value: cat
  }, cat.charAt(0).toUpperCase() + cat.slice(1)))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("select", {
    className: "ts-filter-select",
    value: selectedStatus,
    onChange: e => {
      setSelectedStatus(e.target.value);
      setCurrentPage(1);
    }
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "all"
  }, "All Statuses"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "supported"
  }, "Supported"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "custom"
  }, "Custom Config"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "unsupported"
  }, "Unsupported")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("select", {
    className: "ts-filter-select",
    value: sortBy,
    onChange: e => {
      setSortBy(e.target.value);
      setCurrentPage(1);
    }
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "name_asc"
  }, "Name (A to Z)"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "name_desc"
  }, "Name (Z to A)"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "fields_desc"
  }, "Fields (High to Low)"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "fields_asc"
  }, "Fields (Low to High)"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "status"
  }, "Status (Supported first)"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-filter-row-bottom"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-view-switcher-group"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-view-switcher"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: `ts-view-btn ${viewMode === 'grid' ? 'active' : ''}`,
    onClick: () => setViewMode('grid')
  }, "Grid"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: `ts-view-btn ${viewMode === 'list' ? 'active' : ''}`,
    onClick: () => setViewMode('list')
  }, "List")), isFiltered && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-reset-filter-btn",
    onClick: handleResetFilters
  }, "Reset")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-filter-actions-right"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn-action-primary",
    disabled: isCreatingSandbox,
    onClick: () => onGenerateSandbox && onGenerateSandbox(activeTab)
  }, isCreatingSandbox ? 'Opening...' : `Generate ${builderName} Config`), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn-action-outline",
    onClick: () => onOpenXmlModal && onOpenXmlModal(activeTab, null)
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    style: {
      display: 'inline-flex',
      marginRight: '6px'
    }
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_5__.DashboardIcons.pencil({
    size: 13
  })), `Edit ${builderName} Config`)))), viewMode === 'grid' ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-widget-grid"
  }, paginatedWidgets.length > 0 ? paginatedWidgets.map(widget => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_WidgetCard__WEBPACK_IMPORTED_MODULE_2__.WidgetCard, {
    key: widget.id,
    widget: widget,
    activeTab: activeTab,
    onEdit: w => onOpenXmlModal && onOpenXmlModal(activeTab, w),
    onGenerate: w => onGenerateSandbox && onGenerateSandbox(activeTab, w.id)
  })) : (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-empty-state",
    style: {
      gridColumn: '1 / -1',
      padding: '40px 20px',
      textAlign: 'center'
    }
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", null, "No matching ", unitName, " found for the selected filters."))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_PaginationBar__WEBPACK_IMPORTED_MODULE_4__.PaginationBar, {
    currentPage: validCurrentPage,
    totalPages: totalPages,
    totalItems: totalItems,
    pageSize: pageSize,
    activeTab: activeTab,
    onPageChange: setCurrentPage
  })) : (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-table-container"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("table", {
    className: "ts-list-table"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("thead", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("tr", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("th", {
    style: {
      width: '28%'
    }
  }, builderName.toUpperCase(), " ", unitName.toUpperCase()), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("th", {
    style: {
      width: '15%'
    }
  }, "CATEGORY"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("th", {
    style: {
      width: '28%'
    }
  }, "MAPPED FIELDS"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("th", {
    style: {
      width: '14%'
    }
  }, "STATUS"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("th", {
    style: {
      width: '15%',
      textAlign: 'right'
    }
  }, "ACTIONS"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("tbody", null, paginatedWidgets.length > 0 ? paginatedWidgets.map(widget => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_WidgetTableRow__WEBPACK_IMPORTED_MODULE_3__.WidgetTableRow, {
    key: widget.id,
    widget: widget,
    onEdit: w => onOpenXmlModal && onOpenXmlModal(activeTab, w),
    onGenerate: w => onGenerateSandbox && onGenerateSandbox(activeTab, w.id)
  })) : (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("tr", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("td", {
    colSpan: 5,
    style: {
      textAlign: 'center',
      padding: '30px'
    }
  }, "No matching ", unitName, " found.")))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_PaginationBar__WEBPACK_IMPORTED_MODULE_4__.PaginationBar, {
    currentPage: validCurrentPage,
    totalPages: totalPages,
    totalItems: totalItems,
    pageSize: pageSize,
    activeTab: activeTab,
    onPageChange: setCurrentPage
  })));
}

/***/ },

/***/ "./src/dashboard/components/CacheConfirmModal.jsx"
/*!********************************************************!*\
  !*** ./src/dashboard/components/CacheConfirmModal.jsx ***!
  \********************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CacheConfirmModal: () => (/* binding */ CacheConfirmModal)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./DashboardIcons */ "./src/dashboard/components/DashboardIcons.jsx");

/**
 * CacheConfirmModal Component - Clear Cache Confirmation Dialog
 */


function CacheConfirmModal({
  modal,
  isClearing,
  onClose,
  onConfirm
}) {
  if (!modal || !modal.isOpen) return null;
  const isTranslations = modal.type === 'translations';
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-modal-overlay",
    onClick: onClose
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-modal-container ts-cache-confirm-modal",
    onClick: e => e.stopPropagation()
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-modal-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-modal-header-icon danger"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.trash({
    size: 16
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", null, modal.title || 'Clear Cache')), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    className: "ts-modal-close",
    onClick: onClose,
    "aria-label": "Close"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.close({
    size: 16
  }))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-modal-body"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-alert-box"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-alert-icon"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.alert({
    size: 22
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-alert-content"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h4", {
    className: "ts-cache-alert-title"
  }, "Required Warning"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-cache-alert-text"
  }, modal.warning))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-impact-box"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    style: {
      margin: 0,
      fontSize: '13px',
      color: '#475569'
    }
  }, 'You are about to permanently remove ', (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("strong", {
    style: {
      color: '#0f172a'
    }
  }, `${(modal.count || 0).toLocaleString()} cached records`), ' from your database. This action is irreversible.'), isTranslations && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    style: {
      margin: '8px 0 0 0',
      fontSize: '12px',
      color: '#b45309',
      fontWeight: 500
    }
  }, "\uD83D\uDCA1 Tip: Keeping your translation cache preserves your API tokens for repeated texts and makes retranslating pages much faster."))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-modal-footer"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn ts-btn-secondary",
    disabled: isClearing,
    onClick: onClose
  }, "Cancel"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn ts-btn-danger",
    disabled: isClearing,
    onClick: onConfirm
  }, isClearing ? 'Clearing Cache...' : 'Yes, Confirm & Clear Cache'))));
}

/***/ },

/***/ "./src/dashboard/components/CacheTab.jsx"
/*!***********************************************!*\
  !*** ./src/dashboard/components/CacheTab.jsx ***!
  \***********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CacheTab: () => (/* binding */ CacheTab)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _CacheConfirmModal__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./CacheConfirmModal */ "./src/dashboard/components/CacheConfirmModal.jsx");
/* harmony import */ var _DashboardIcons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./DashboardIcons */ "./src/dashboard/components/DashboardIcons.jsx");

/**
 * CacheTab Component - Cache & Memory Management Panel
 */




function CacheTab({
  cacheCounts = {},
  onClearCache
}) {
  const [modal, setModal] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)({
    isOpen: false,
    type: 'all',
    title: '',
    warning: '',
    count: 0
  });
  const [isClearing, setIsClearing] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  const totalCache = (cacheCounts.strings || 0) + (cacheCounts.translations || 0) + (cacheCounts.packages || 0) + (cacheCounts.logs || 0);
  const handleOpenModal = type => {
    let title = 'Clear Cache';
    let warning = 'Are you sure you want to proceed?';
    let count = 0;
    if (type === 'translations') {
      title = 'Clear Translations Cache (Memory)';
      warning = 'Removing this cache means repeated texts and previously translated sentences will call AI again, incurring additional token usage.';
      count = cacheCounts.translations || 0;
    } else if (type === 'strings') {
      title = 'Clear Central Source Strings Cache';
      warning = 'Removes extracted source strings from local memory index. Strings will be re-extracted when translating posts.';
      count = cacheCounts.strings || 0;
    } else if (type === 'logs') {
      title = 'Clear Translation Logs & Batches';
      warning = 'Permanently clears historical background batch logs, error reports, and translation execution time records.';
      count = cacheCounts.logs || 0;
    } else if (type === 'packages') {
      title = 'Clear Block & Widget Packages';
      warning = 'Post-level widget/block mappings will be cleared and regenerated automatically during the next translation..';
      count = cacheCounts.packages || 0;
    } else if (type === 'all') {
      title = 'Clear Entire TranslateSense Cache';
      warning = 'Permanently purges ALL translated sentences, extracted source strings, widget mapping packages, and bulk batch logs.';
      count = totalCache;
    }
    setModal({
      isOpen: true,
      type,
      title,
      warning,
      count
    });
  };
  const handleCloseModal = () => {
    setModal({
      isOpen: false,
      type: 'all',
      title: '',
      warning: '',
      count: 0
    });
  };
  const handleConfirmClear = async () => {
    setIsClearing(true);
    try {
      if (onClearCache) {
        await onClearCache(modal.type);
      }
    } finally {
      setIsClearing(false);
      handleCloseModal();
    }
  };
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-container"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-summary-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-summary-main"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-summary-label"
  }, "TOTAL CACHED DATABASE RECORDS"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-summary-number"
  }, totalCache.toLocaleString()), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-summary-sub"
  }, "Across Translation Memory, Source Strings, Bulk Logs & Widget Packages")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-summary-breakdown"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-summary-pill"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-pill-dot green"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-pill-lbl"
  }, "Translations:"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("strong", null, (cacheCounts.translations || 0).toLocaleString())), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-summary-pill"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-pill-dot blue"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-pill-lbl"
  }, "Strings:"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("strong", null, (cacheCounts.strings || 0).toLocaleString())), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-summary-pill"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-pill-dot purple"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-pill-lbl"
  }, "Packages:"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("strong", null, (cacheCounts.packages || 0).toLocaleString())), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-summary-pill"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-pill-dot orange"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-pill-lbl"
  }, "Logs:"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("strong", null, (cacheCounts.logs || 0).toLocaleString())))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-grid"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card highlight-token"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-top"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-icon green"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_3__.DashboardIcons.globe({
    size: 20
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", {
    className: "ts-cache-card-title"
  }, "Translations Cache"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-cache-card-sub"
  }, "AI Translation Memory"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: `ts-cache-status-badge ${cacheCounts.translations > 0 ? 'active' : 'empty'}`
  }, cacheCounts.translations > 0 ? 'Active & Caching' : 'Empty')), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-stat"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-cache-big-num"
  }, (cacheCounts.translations || 0).toLocaleString()), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-cache-unit"
  }, "translated string pairs")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-cache-card-desc"
  }, "Stores previously translated sentences mapped to target languages and MD5 hashes. Eliminates duplicate AI queries when retranslating pages or encountering repeated texts."), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-actions"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn-cache-danger",
    disabled: !cacheCounts.translations,
    onClick: () => handleOpenModal('translations')
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    style: {
      display: 'inline-flex',
      marginRight: '6px'
    }
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_3__.DashboardIcons.trash({
    size: 13
  })), "Clear Translations Cache"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-top"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-icon blue"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_3__.DashboardIcons.document({
    size: 20
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", {
    className: "ts-cache-card-title"
  }, "Strings Cache"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-cache-card-sub"
  }, "Central Translation Memory"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: `ts-cache-status-badge ${cacheCounts.strings > 0 ? 'active' : 'empty'}`
  }, cacheCounts.strings > 0 ? 'Active & Indexed' : 'Empty')), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-stat"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-cache-big-num"
  }, (cacheCounts.strings || 0).toLocaleString()), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-cache-unit"
  }, "unique source strings")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-cache-card-desc"
  }, "Stores normalized source strings extracted from your blocks and widgets with their respective MD5 hashes as central Translation Memory index references."), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-actions"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn-cache-danger",
    disabled: !cacheCounts.strings,
    onClick: () => handleOpenModal('strings')
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    style: {
      display: 'inline-flex',
      marginRight: '6px'
    }
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_3__.DashboardIcons.trash({
    size: 13
  })), "Clear Strings Cache"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-top"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-icon orange"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_3__.DashboardIcons.clock({
    size: 20
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", {
    className: "ts-cache-card-title"
  }, "Translation Logs & Queue"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-cache-card-sub"
  }, "Bulk History & Batches"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: `ts-cache-status-badge ${cacheCounts.logs > 0 ? 'active' : 'empty'}`
  }, cacheCounts.logs > 0 ? 'Logged' : 'No Logs')), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-stat"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-cache-big-num"
  }, (cacheCounts.logs || 0).toLocaleString()), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-cache-unit"
  }, "queue & history records")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-cache-card-desc"
  }, "Stores bulk translation batch entries, execution time statistics, completed/failed statuses, and background queue records for historical auditing."), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-actions"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn-cache-danger",
    disabled: !cacheCounts.logs,
    onClick: () => handleOpenModal('logs')
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    style: {
      display: 'inline-flex',
      marginRight: '6px'
    }
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_3__.DashboardIcons.trash({
    size: 13
  })), "Clear Translation Logs"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-top"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-icon purple"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_3__.DashboardIcons.package({
    size: 20
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", {
    className: "ts-cache-card-title"
  }, "Packages Cache"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-cache-card-sub"
  }, "Block & Widget Mapping Context"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: `ts-cache-status-badge ${cacheCounts.packages > 0 ? 'active' : 'empty'}`
  }, cacheCounts.packages > 0 ? 'Active & Linked' : 'Empty')), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-stat"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-cache-big-num"
  }, (cacheCounts.packages || 0).toLocaleString()), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-cache-unit"
  }, "mapped field packages")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-cache-card-desc"
  }, "Maintains associations between specific post IDs, editor types, widget keys, and string hashes. Allows instant reconstruction of translated layouts without reparsing."), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-cache-card-actions"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn-cache-danger",
    disabled: !cacheCounts.packages,
    onClick: () => handleOpenModal('packages')
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    style: {
      display: 'inline-flex',
      marginRight: '6px'
    }
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_3__.DashboardIcons.trash({
    size: 13
  })), "Clear Packages Cache")))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_CacheConfirmModal__WEBPACK_IMPORTED_MODULE_2__.CacheConfirmModal, {
    modal: modal,
    isClearing: isClearing,
    onClose: handleCloseModal,
    onConfirm: handleConfirmClear
  }));
}

/***/ },

/***/ "./src/dashboard/components/DashboardIcons.jsx"
/*!*****************************************************!*\
  !*** ./src/dashboard/components/DashboardIcons.jsx ***!
  \*****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DashboardIcons: () => (/* binding */ DashboardIcons)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);

/**
 * Dashboard Crisp SVG Icons
 */

const DashboardIcons = {
  search: ({
    size = 15,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("circle", {
    cx: 11,
    cy: 11,
    r: 8
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("line", {
    x1: 21,
    y1: 21,
    x2: 16.65,
    y2: 16.65
  })),
  pencil: ({
    size = 12,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
  })),
  eye: ({
    size = 15,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("circle", {
    cx: 12,
    cy: 12,
    r: 3
  })),
  eyeOff: ({
    size = 15,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("line", {
    x1: 1,
    y1: 1,
    x2: 23,
    y2: 23
  })),
  check: ({
    size = 14,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("polyline", {
    points: "20 6 9 17 4 12"
  })),
  alert: ({
    size = 15,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("circle", {
    cx: 12,
    cy: 12,
    r: 10
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("line", {
    x1: 12,
    y1: 8,
    x2: 12,
    y2: 12
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("line", {
    x1: 12,
    y1: 16,
    x2: 12.01,
    y2: 16
  })),
  globe: ({
    size = 20,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("circle", {
    cx: 12,
    cy: 12,
    r: 10
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("line", {
    x1: 2,
    y1: 12,
    x2: 22,
    y2: 12
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
  })),
  clock: ({
    size = 15,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("circle", {
    cx: 12,
    cy: 12,
    r: 10
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("polyline", {
    points: "12 6 12 12 16 14"
  })),
  document: ({
    size = 15,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("polyline", {
    points: "14 2 14 8 20 8"
  })),
  layers: ({
    size = 14,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("polygon", {
    points: "12 2 2 7 12 12 22 7 12 2"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("polyline", {
    points: "2 17 12 22 22 17"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("polyline", {
    points: "2 12 12 17 22 12"
  })),
  package: ({
    size = 14,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("polyline", {
    points: "3.27 6.96 12 12.01 20.73 6.96"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("line", {
    x1: 12,
    y1: 22.08,
    x2: 12,
    y2: 12
  })),
  chart: ({
    size = 15,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("line", {
    x1: 18,
    y1: 20,
    x2: 18,
    y2: 10
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("line", {
    x1: 12,
    y1: 20,
    x2: 12,
    y2: 4
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("line", {
    x1: 6,
    y1: 20,
    x2: 6,
    y2: 14
  })),
  spark: ({
    size = 14,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"
  })),
  chat: ({
    size = 15,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
  })),
  workflow: ({
    size = 15,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("rect", {
    x: 3,
    y: 3,
    width: 6,
    height: 6,
    rx: 1
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("rect", {
    x: 15,
    y: 15,
    width: 6,
    height: 6,
    rx: 1
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M6 9v3a3 3 0 0 0 3 3h6"
  })),
  home: ({
    size = 14,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("polyline", {
    points: "9 22 9 12 15 12 15 22"
  })),
  database: ({
    size = 14,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("ellipse", {
    cx: 12,
    cy: 5,
    rx: 9,
    ry: 3
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"
  })),
  trash: ({
    size = 13,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("polyline", {
    points: "3 6 5 6 21 6"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
  })),
  refresh: ({
    size = 14,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("polyline", {
    points: "23 4 23 10 17 10"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("polyline", {
    points: "1 20 1 14 7 14"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
  })),
  close: ({
    size = 14,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("line", {
    x1: 18,
    y1: 6,
    x2: 6,
    y2: 18
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("line", {
    x1: 6,
    y1: 6,
    x2: 18,
    y2: 18
  })),
  bolt: ({
    size = 16,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("polygon", {
    points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2"
  })),
  radioChecked: ({
    size = 18,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    className: `ts-radio-icon checked ${className}`,
    "aria-hidden": "true"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("circle", {
    cx: 12,
    cy: 12,
    r: 10,
    stroke: "#2563eb",
    strokeWidth: 2,
    fill: "rgba(37, 99, 235, 0.08)"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M8 12.5l2.5 2.5 5.5-5.5",
    stroke: "#2563eb",
    strokeWidth: 2.2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })),
  radioUnchecked: ({
    size = 18,
    className = ''
  } = {}) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    className: `ts-radio-icon unchecked ${className}`,
    "aria-hidden": "true"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("circle", {
    cx: 12,
    cy: 12,
    r: 7.5,
    fill: "#cbd5e1"
  }))
};

/***/ },

/***/ "./src/dashboard/components/FooterBar.jsx"
/*!************************************************!*\
  !*** ./src/dashboard/components/FooterBar.jsx ***!
  \************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FooterBar: () => (/* binding */ FooterBar)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./DashboardIcons */ "./src/dashboard/components/DashboardIcons.jsx");
/* harmony import */ var _CacheConfirmModal__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./CacheConfirmModal */ "./src/dashboard/components/CacheConfirmModal.jsx");

/**
 * FooterBar Component - Fixed/Sticky Footer Status & Actions
 */




function FooterBar({
  activeTab,
  onSaveSettings,
  isSaving,
  cacheCounts,
  onRefreshCache,
  isRefreshing = false,
  onClearCache,
  pluginUrl = ''
}) {
  const logoSrc = pluginUrl ? `${pluginUrl}assets/img/dragwyb.png` : 'assets/img/dragwyb.png';
  const [modal, setModal] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)({
    isOpen: false,
    type: 'all',
    title: '',
    warning: '',
    count: 0
  });
  const [isClearing, setIsClearing] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const handleOpenModal = type => {
    const title = 'Clear Entire TranslateSense Cache';
    const warning = 'Permanently purges ALL translated sentences, extracted source strings, widget mapping packages, and bulk batch logs.';
    const count = (cacheCounts.strings || 0) + (cacheCounts.translations || 0) + (cacheCounts.packages || 0) + (cacheCounts.logs || 0);
    ;
    setModal({
      isOpen: true,
      type,
      title,
      warning,
      count
    });
  };
  const handleCloseModal = () => {
    setModal({
      isOpen: false,
      type: 'all',
      title: '',
      warning: '',
      count: 0
    });
  };
  const handleConfirmClear = async () => {
    setIsClearing(true);
    try {
      if (onClearCache) {
        await onClearCache(modal.type);
      }
    } finally {
      setIsClearing(false);
      handleCloseModal();
    }
  };
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("footer", {
    className: "ts-footer-bar"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-footer-left"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-footer-logo"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("img", {
    className: "ts-footer-logo-img",
    src: logoSrc,
    alt: "Dragwyb Logo",
    onError: e => {
      e.target.style.display = 'none';
    }
  }), "Dragwyb"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, "Built with \u2764\uFE0F by Dragwyb")), activeTab === 'cache' && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-footer-right"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn ts-btn-secondary ts-btn-md",
    disabled: isRefreshing,
    onClick: onRefreshCache,
    title: "Refresh cache counts from database"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: `ts-refresh-icon ${isRefreshing ? 'spinning' : ''}`,
    style: {
      display: 'inline-flex',
      marginRight: '5px'
    }
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.refresh({
    size: 14
  })), isRefreshing ? 'Refreshing...' : 'Refresh Counts'), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn ts-btn-danger-outline ts-btn-md",
    onClick: () => handleOpenModal('all'),
    title: "Clear all stored strings, translations, packages, and logs"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    style: {
      display: 'inline-flex',
      marginRight: '5px'
    }
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.trash({
    size: 13
  })), "Clear All Caches")), activeTab === 'settings' && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-footer-right"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-save-status"
  }, "Tip: Press ", (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("kbd", {
    className: "ts-kbd-shortcut"
  }, "Ctrl + S")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    disabled: isSaving,
    onClick: onSaveSettings,
    className: "ts-btn ts-btn-primary button-primary"
  }, isSaving ? 'Saving...' : 'Save Settings'))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_CacheConfirmModal__WEBPACK_IMPORTED_MODULE_2__.CacheConfirmModal, {
    modal: modal,
    isClearing: isClearing,
    onClose: handleCloseModal,
    onConfirm: handleConfirmClear
  }));
}

/***/ },

/***/ "./src/dashboard/components/GuideMethodSelector.jsx"
/*!**********************************************************!*\
  !*** ./src/dashboard/components/GuideMethodSelector.jsx ***!
  \**********************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GuideMethodSelector: () => (/* binding */ GuideMethodSelector),
/* harmony export */   METHODS_CONFIG: () => (/* binding */ METHODS_CONFIG)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./DashboardIcons */ "./src/dashboard/components/DashboardIcons.jsx");

/**
 * GuideMethodSelector Component - Single Row Option Switcher
 */


const METHODS_CONFIG = [{
  id: 'gutenberg',
  label: 'Gutenberg'
}, {
  id: 'classic',
  label: 'Classic'
}, {
  id: 'elementor',
  label: 'Elementor'
}, {
  id: 'bulk',
  label: 'Bulk Translation'
}];
function GuideMethodSelector({
  activeTab,
  onChange
}) {
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
      if (nextBtn) nextBtn.focus();
    }
  };
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-guide-options-row",
    role: "radiogroup",
    "aria-label": "Translation method"
  }, METHODS_CONFIG.map((method, index) => {
    const isActive = activeTab === method.id;
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
      key: method.id,
      id: `ts-method-card-${method.id}`,
      type: "button",
      role: "radio",
      "aria-checked": isActive,
      tabIndex: isActive ? 0 : -1,
      className: `ts-method-card ${isActive ? 'active' : ''}`,
      onClick: () => onChange(method.id),
      onKeyDown: e => handleKeyDown(e, index),
      "aria-controls": `ts-guide-panel-${method.id}`
    }, isActive ? _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.radioChecked() : _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.radioUnchecked(), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-method-card-label"
    }, method.label));
  }));
}

/***/ },

/***/ "./src/dashboard/components/GuideStep.jsx"
/*!************************************************!*\
  !*** ./src/dashboard/components/GuideStep.jsx ***!
  \************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GuideStep: () => (/* binding */ GuideStep)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);

/**
 * GuideStep Component - Vertical Timeline Step Item
 */

function GuideStep({
  number,
  title,
  description,
  screenshot,
  note
}) {
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-timeline-step"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-timeline-axis"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-timeline-circle"
  }, number), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-timeline-track"
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-timeline-body"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h4", {
    className: "ts-timeline-title"
  }, title), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-timeline-desc"
  }, description), screenshot && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-screenshot-placeholder"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-screenshot-icon-box"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "dashicons dashicons-format-image"
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-screenshot-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-screenshot-label"
  }, "Screenshot Reference"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-screenshot-caption"
  }, screenshot))), note && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-timeline-note"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "dashicons dashicons-info ts-timeline-note-icon"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-timeline-note-text"
  }, note))));
}

/***/ },

/***/ "./src/dashboard/components/HomeGuidePanel.jsx"
/*!*****************************************************!*\
  !*** ./src/dashboard/components/HomeGuidePanel.jsx ***!
  \*****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   HomeGuidePanel: () => (/* binding */ HomeGuidePanel)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _TranslationGuide__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./TranslationGuide */ "./src/dashboard/components/TranslationGuide.jsx");
/* harmony import */ var _DashboardIcons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./DashboardIcons */ "./src/dashboard/components/DashboardIcons.jsx");

/**
 * HomeGuidePanel Component - Overview / Home Dashboard View
 */



function HomeGuidePanel({
  onNavigateTab,
  activeBuilders = {},
  languages = {},
  polylangActive = true,
  bulkTranslateUrl = 'edit.php'
}) {
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-guide-container"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-guide-hero"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-guide-hero-content"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-guide-hero-badge-wrap"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-guide-pill primary"
  }, "Documentation & Workflow Guide"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: `ts-guide-pill ${polylangActive ? 'success' : 'warning'}`
  }, polylangActive ? `Polylang Connected (${Object.keys(languages).length} Languages)` : 'Polylang Inactive')), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h2", {
    className: "ts-guide-hero-title"
  }, "Welcome to TranslateSense \uD83D\uDC4B"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-guide-hero-desc"
  }, "TranslateSense is a high-performance automated translation suite built for WordPress & Polylang. It preserves your exact layout and styling across Gutenberg, Classic Editor & Elementor while utilizing a 4-tier database cache to eliminate duplicate AI token costs."))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_TranslationGuide__WEBPACK_IMPORTED_MODULE_1__.TranslationGuide, null), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-guide-tips-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-guide-tips-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-tips-icon"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_2__.DashboardIcons.bolt()), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", {
    className: "ts-tips-title"
  }, "TranslateSense Architecture & Token Savings")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-guide-tips-grid"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-tip-box"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h4", null, "Database Translation Memory"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", null, "Every unique sentence is hashed (MD5) and cached in your MySQL database. If the same paragraph appears across 50 posts, AI is called only once, saving thousands of tokens.")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-tip-box"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h4", null, "Structural Tag Protection"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", null, "HTML tags, block comments, and shortcodes are shielded before translation, preventing AI from breaking your styling, links, or Elementor widgets.")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-tip-box"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h4", null, "Cache & Memory Management"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", null, "Use the Cache tab to inspect and clean your translation memory. Note that removing translation cache means repeated text will be sent to AI again.")))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-guide-quick-actions"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn ts-btn-secondary",
    onClick: () => onNavigateTab('settings')
  }, "Configure AI Settings"), activeBuilders.gutenberg && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn ts-btn-secondary",
    onClick: () => onNavigateTab('gutenberg')
  }, "View Gutenberg Blocks"), activeBuilders.elementor && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn ts-btn-secondary",
    onClick: () => onNavigateTab('elementor')
  }, "View Elementor Widgets"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn ts-btn-secondary",
    onClick: () => onNavigateTab('cache')
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    style: {
      display: 'inline-flex',
      marginRight: '6px'
    }
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_2__.DashboardIcons.database({
    size: 14
  })), "Manage Cache & Memory"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("a", {
    href: bulkTranslateUrl,
    className: "ts-btn ts-btn-secondary"
  }, "Go to Posts (Bulk Translate) \u2197")));
}

/***/ },

/***/ "./src/dashboard/components/PaginationBar.jsx"
/*!****************************************************!*\
  !*** ./src/dashboard/components/PaginationBar.jsx ***!
  \****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   PaginationBar: () => (/* binding */ PaginationBar)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);

/**
 * PaginationBar Component - Controls for Gutenberg Blocks & Elementor Widgets
 */

function PaginationBar({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  activeTab,
  onPageChange
}) {
  if (totalItems <= 0) return null;
  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalItems);
  const unit = activeTab === 'gutenberg' ? 'blocks' : 'widgets';
  const getRange = () => {
    if (totalPages <= 7) {
      return Array.from({
        length: totalPages
      }, (_, i) => i + 1);
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
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-pagination-bar"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-pagination-info"
  }, `Showing ${startIdx}–${endIdx} of ${totalItems} ${unit}`), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-pagination-controls"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-page-nav-btn",
    disabled: currentPage <= 1,
    onClick: () => onPageChange(currentPage - 1)
  }, "< Prev"), pages.map((p, idx) => p === '...' ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    key: `dots-${idx}`,
    className: "ts-page-dots"
  }, "...") : (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    key: p,
    type: "button",
    className: `ts-page-num-btn ${currentPage === p ? 'active' : ''}`,
    onClick: () => onPageChange(p)
  }, p)), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-page-nav-btn",
    disabled: currentPage >= totalPages,
    onClick: () => onPageChange(currentPage + 1)
  }, "Next >")));
}

/***/ },

/***/ "./src/dashboard/components/RightSidebar.jsx"
/*!***************************************************!*\
  !*** ./src/dashboard/components/RightSidebar.jsx ***!
  \***************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   RightSidebar: () => (/* binding */ RightSidebar)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./DashboardIcons */ "./src/dashboard/components/DashboardIcons.jsx");
/* harmony import */ var _utils_formatting__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../utils/formatting */ "./src/utils/formatting.js");

/**
 * RightSidebar Component - Translation Overview & Dragwyb Ecosystem
 */



function RightSidebar({
  stats = {}
}) {
  const totalPosts = stats.successful_translations ? Number(stats.successful_translations).toLocaleString() : 0;
  const totalStrings = stats.total_strings ? stats.total_strings >= 1000 ? (stats.total_strings / 1000).toFixed(1) + 'K' : stats.total_strings : 0;
  const totalCharacters = stats.total_characters ? stats.total_characters >= 1000 ? (stats.total_characters / 1000).toFixed(1) + 'K' : stats.total_characters : 0;
  const timeTaken = (0,_utils_formatting__WEBPACK_IMPORTED_MODULE_2__.formatMs)(stats.time_take) || '';
  const cachedCount = stats.cached_results ? `${Number(stats.cached_results).toLocaleString()} Strings` : 0;
  const packagesCount = stats.total_packages ? Number(stats.total_packages).toLocaleString() : 0;
  const providers = stats.providers && Object.keys(stats.providers).length > 0 ? Object.keys(stats.providers) : [];
  const adminUrl = typeof window !== 'undefined' && window.TranslateSenseData && window.TranslateSenseData.adminUrl || '';
  const getPluginUrl = name => {
    if (!adminUrl) return '#';
    return `${adminUrl}plugin-install.php?tab=plugin-information&plugin=${name}&TB_iframe=true&width=772&height=380`;
  };
  const providerBadge = name => {
    let badge = {};
    switch (name) {
      case 'chrome_ai':
        badge.name = 'Chrome Built-in';
        badge.class = 'red';
        break;
      case 'gemini':
        badge.name = 'Gemini';
        badge.class = 'blue';
        break;
      case 'openai':
        badge.name = 'OpenAI';
        badge.class = 'green';
        break;
    }
    return badge;
  };
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("aside", {
    className: "ts-sidebar",
    "aria-label": "Dashboard Sidebar"
  }, stats && Object.keys(stats).length > 0 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-sidebar-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", {
    className: "ts-sidebar-title"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-title-icon"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.chart()), "Translation Overview"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-overview-grid"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-overview-metric"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-metric-icon-box"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.document()), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-metric-details"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-metric-num"
  }, totalPosts), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-metric-sub"
  }, "Total Posts"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-overview-metric"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-metric-icon-box"
  }, "</>"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-metric-details"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-metric-num"
  }, totalStrings), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-metric-sub"
  }, "Strings"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-overview-metric"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-metric-icon-box"
  }, "A"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-metric-details"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-metric-num"
  }, totalCharacters), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-metric-sub"
  }, "Characters"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-overview-metric"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-metric-icon-box"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.clock()), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-metric-details"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-metric-num"
  }, timeTaken), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-metric-sub"
  }, "Time Taken")))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-sidebar-divider"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-overview-subgrid"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-subgrid-col"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-subgrid-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-subgrid-icon"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.layers()), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, cachedCount)), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-subgrid-lbl"
  }, "Translation Cache")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-subgrid-col"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-subgrid-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-subgrid-icon"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.package()), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, packagesCount)), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-subgrid-lbl"
  }, "Active Packages"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-sidebar-divider"
  }), providers && providers.length > 0 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-pills"
  }, providers.map(provider => {
    const providerData = providerBadge(provider);
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      className: "ts-provider-pill"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: `ts-dot ${providerData.class}`
    }), providerData.name);
  }))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-sidebar-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", {
    className: "ts-sidebar-title"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-title-icon"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.spark()), "More by Dragwyb"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-dragwyb-list"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("a", {
    href: getPluginUrl('smart-form-builder-by-dragwyb'),
    target: "_blank",
    rel: "noopener noreferrer",
    className: "ts-dragwyb-item thickbox open-plugin-details-modal",
    title: "Advanced contact forms and lead generation."
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-dragwyb-icon red"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.document()), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-dragwyb-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-dragwyb-title"
  }, "Smart Form Builder"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-dragwyb-desc"
  }, "Advanced contact forms and lead generation.")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-dragwyb-arrow"
  }, "\u203A")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("a", {
    href: getPluginUrl('dragwyb-click-to-chat'),
    target: "_blank",
    rel: "noopener noreferrer",
    className: "ts-dragwyb-item thickbox open-plugin-details-modal",
    title: "AI chatbot and customer support."
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-dragwyb-icon green"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.chat()), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-dragwyb-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-dragwyb-title"
  }, "Click to Chat"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-dragwyb-desc"
  }, "AI chatbot and customer support.")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-dragwyb-arrow"
  }, "\u203A")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("a", {
    href: getPluginUrl('dragwyb-ai-agent-workflows'),
    target: "_blank",
    rel: "noopener noreferrer",
    className: "ts-dragwyb-item thickbox open-plugin-details-modal",
    title: "Automate WordPress workflows with AI agents."
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-dragwyb-icon purple"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.workflow()), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-dragwyb-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-dragwyb-title"
  }, "AI Agent Workflows"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-dragwyb-desc"
  }, "Automate WordPress workflows with AI agents.")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-dragwyb-arrow"
  }, "\u203A")))));
}

/***/ },

/***/ "./src/dashboard/components/SettingsTab.jsx"
/*!**************************************************!*\
  !*** ./src/dashboard/components/SettingsTab.jsx ***!
  \**************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SettingsTab: () => (/* binding */ SettingsTab)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _DashboardIcons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./DashboardIcons */ "./src/dashboard/components/DashboardIcons.jsx");
/* harmony import */ var _components_CopyToClipbord__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../components/CopyToClipbord */ "./src/components/CopyToClipbord/index.js");

/**
 * SettingsTab Component - General Settings Panel
 */




function SettingsTab({
  settings,
  setSettings,
  languages = {},
  showNotice,
  activeProviders = {},
  connectorsUrl = 'options-connectors.php',
  providerModels = {}
}) {
  const [showOpenAiKey, setShowOpenAiKey] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  const [showGeminiKey, setShowGeminiKey] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  const enabledProviders = settings.enabled_providers || ['chrome_ai', 'openai', 'gemini'];
  const currentDefaultProvider = settings.provider || '';
  const getProviderStatus = id => {
    if (activeProviders && typeof activeProviders === 'object' && activeProviders[id]) {
      const meta = activeProviders[id];
      return {
        isConnected: meta.isConnected !== false,
        connectors: Boolean(meta.connectors),
        isProviderInstall: meta.isProviderInstall !== undefined ? Boolean(meta.isProviderInstall) : true,
        isProviderActive: meta.isProviderActive !== undefined ? Boolean(meta.isProviderActive) : true
      };
    }
    const isKeyConfigured = id === 'openai' ? Boolean(typeof settings.openai_api_key === 'string' ? settings.openai_api_key.trim() : settings.openai_api_key) : id === 'gemini' ? Boolean(typeof settings.gemini_api_key === 'string' ? settings.gemini_api_key.trim() : settings.gemini_api_key) : true;
    return {
      isConnected: isKeyConfigured,
      connectors: false,
      isProviderInstall: false,
      isProviderActive: false
    };
  };
  const openAiStatus = getProviderStatus('openai');
  const geminiStatus = getProviderStatus('gemini');
  const defaultOpenAiModels = [{
    id: 'gpt-4o-mini',
    name: 'gpt-4o-mini ( Fast & Cost-Effective )'
  }, {
    id: 'gpt-4o',
    name: 'gpt-4o ( Flagship Reasoning )'
  }, {
    id: 'gpt-3.5-turbo',
    name: 'gpt-3.5-turbo ( Legacy )'
  }];
  const defaultGeminiModels = [{
    id: 'gemini-2.0-flash',
    name: 'gemini-2.0-flash ( High Speed & Quality )'
  }, {
    id: 'gemini-1.5-flash',
    name: 'gemini-1.5-flash ( Fast & Efficient )'
  }, {
    id: 'gemini-1.5-pro',
    name: 'gemini-1.5-pro ( Deep Context )'
  }];
  const openAiModels = providerModels && Array.isArray(providerModels.openai) && providerModels.openai.length > 0 ? providerModels.openai : defaultOpenAiModels;
  const geminiModels = providerModels && Array.isArray(providerModels.gemini) && providerModels.gemini.length > 0 ? providerModels.gemini : providerModels && Array.isArray(providerModels.google) && providerModels.google.length > 0 ? providerModels.google : defaultGeminiModels;
  const toggleProvider = providerId => {
    let updated;
    if (enabledProviders.includes(providerId)) {
      if (enabledProviders.length === 1) {
        if (showNotice) showNotice('At least one translation provider must remain enabled.', 'error');
        return;
      }
      updated = enabledProviders.filter(p => p !== providerId);
    } else {
      updated = [...enabledProviders, providerId];
    }
    setSettings({
      ...settings,
      enabled_providers: updated
    });
  };
  const insertTag = tag => {
    const textarea = document.getElementById('ts-custom-prompt-editor');
    const currentVal = settings.custom_prompt !== undefined && settings.custom_prompt !== '' ? settings.custom_prompt : settings.default_prompt || '';
    if (!textarea) {
      setSettings({
        ...settings,
        custom_prompt: `${currentVal} ${tag}`
      });
      return;
    }
    const start = textarea.selectionStart || currentVal.length;
    const end = textarea.selectionEnd || currentVal.length;
    const newVal = currentVal.substring(0, start) + tag + currentVal.substring(end);
    setSettings({
      ...settings,
      custom_prompt: newVal
    });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };
  const copyPromptToClipboard = () => {
    const val = settings.custom_prompt !== undefined && settings.custom_prompt !== '' ? settings.custom_prompt : settings.default_prompt || '';
    (0,_components_CopyToClipbord__WEBPACK_IMPORTED_MODULE_3__["default"])({
      value: val,
      onSuccess: () => {
        if (showNotice) showNotice('Prompt template copied to clipboard!');
      }
    });
  };
  const getTemperatureLabel = temp => {
    const t = parseFloat(temp);
    if (t <= 0.25) return '0.0 - 0.25: Highly Precise & Literal (Best for UI & Technical Terms)';
    if (t <= 0.6) return '0.3 - 0.6: Balanced & Natural (Recommended)';
    return '0.7 - 1.0: Creative & Fluid (More expressive variation)';
  };
  const currentPromptVal = settings.custom_prompt !== undefined && settings.custom_prompt !== '' ? settings.custom_prompt : settings.default_prompt || '';
  const getProviderLogo = providerId => {
    const pluginUrl = typeof window !== 'undefined' && window.TranslateSenseData && window.TranslateSenseData.pluginUrl ? window.TranslateSenseData.pluginUrl : '';
    return pluginUrl ? `${pluginUrl}assets/img/providers/${providerId}.png` : '';
  };

  // Determine OpenAI badge tag class, label & action button
  let openAiTagClass = 'offline';
  let openAiTagText = 'Disabled';
  let openAiConnectorDesc = '';
  let openAiConnectorBtnText = '';
  if (enabledProviders.includes('openai')) {
    if (openAiStatus.connectors && openAiStatus.isProviderInstall) {
      if (!openAiStatus.isProviderActive) {
        openAiTagClass = 'setup-connector';
        openAiTagText = 'Activate Provider';
        openAiConnectorDesc = 'WordPress AI Connector plugin for OpenAI is installed but inactive.';
        openAiConnectorBtnText = 'Activate in WP Connectors ↗';
      } else if (!openAiStatus.isConnected) {
        openAiTagClass = 'key-needed';
        openAiTagText = 'API Key Needed';
        openAiConnectorDesc = 'WordPress AI Connector plugin is active. API key is needed.';
        openAiConnectorBtnText = 'Connect in WP Connectors ↗';
      } else {
        openAiTagClass = 'wp-connector';
        openAiTagText = 'WP Connector Active';
        openAiConnectorDesc = 'Managed natively via WordPress AI Client.';
        openAiConnectorBtnText = 'Manage in WP Connectors ↗';
      }
    } else {
      const hasOpenAiKey = Boolean(typeof settings.openai_api_key === 'string' ? settings.openai_api_key.trim() : settings.openai_api_key);
      openAiTagClass = hasOpenAiKey ? 'ready' : 'key-needed';
      openAiTagText = hasOpenAiKey ? 'Configured' : 'API Key Needed';
    }
  }

  // Determine Gemini badge tag class, label & action button
  let geminiTagClass = 'offline';
  let geminiTagText = 'Disabled';
  let geminiConnectorDesc = '';
  let geminiConnectorBtnText = '';
  if (enabledProviders.includes('gemini')) {
    if (geminiStatus.connectors && geminiStatus.isProviderInstall) {
      if (!geminiStatus.isProviderActive) {
        geminiTagClass = 'setup-connector';
        geminiTagText = 'Activate Provider';
        geminiConnectorDesc = 'WordPress AI Connector plugin for Google Gemini is installed but inactive.';
        geminiConnectorBtnText = 'Activate in WP Connectors ↗';
      } else if (!geminiStatus.isConnected) {
        geminiTagClass = 'key-needed';
        geminiTagText = 'API Key Needed';
        geminiConnectorDesc = 'WordPress AI Connector plugin is active. API key is needed.';
        geminiConnectorBtnText = 'Connect in WP Connectors ↗';
      } else {
        geminiTagClass = 'wp-connector';
        geminiTagText = 'WP Connector Active';
        geminiConnectorDesc = 'Managed natively via WordPress AI Client (Google).';
        geminiConnectorBtnText = 'Manage in WP Connectors ↗';
      }
    } else {
      const hasGeminiKey = Boolean(typeof settings.gemini_api_key === 'string' ? settings.gemini_api_key.trim() : settings.gemini_api_key);
      geminiTagClass = hasGeminiKey ? 'ready' : 'key-needed';
      geminiTagText = hasGeminiKey ? 'Configured' : 'API Key Needed';
    }
  }
  const isOpenAiConnected = openAiStatus.isConnected || Boolean(settings.openai_api_key);
  const isGeminiConnected = geminiStatus.isConnected || Boolean(settings.gemini_api_key);
  const curStatus = ['draft', 'publish'].includes(settings.post_status) ? settings.post_status : 'draft';
  const curSlugMode = ['keep_orignal', 'title_based', 'slug_translate'].includes(settings.slug_translation) ? settings.slug_translation : 'slug_translate';
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-settings-panel"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-settings-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-settings-card-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-settings-globe-icon"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_2__.DashboardIcons.globe()), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-settings-card-title-group"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", null, "AI Translation Engines & Models"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", null, "Configure active translation engines, API authentication keys, and target neural models."))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-default-engine-wrap"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-default-engine-label"
  }, "Default Engine:"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-default-engine-select-box"
  }, currentDefaultProvider && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("img", {
    src: getProviderLogo(currentDefaultProvider),
    alt: currentDefaultProvider,
    className: "ts-default-engine-logo",
    onError: e => {
      e.target.style.display = 'none';
    }
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("select", {
    className: "ts-default-engine-select",
    value: currentDefaultProvider,
    onChange: e => setSettings({
      ...settings,
      provider: e.target.value
    })
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: ""
  }, "\u2014 Select Default \u2014"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "chrome_ai"
  }, "Chrome Built-in AI"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "openai"
  }, "OpenAI (ChatGPT)"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "gemini"
  }, "Google Gemini AI"))))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-providers-grid"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: `ts-provider-card openai ${enabledProviders.includes('openai') ? 'enabled' : ''} ${currentDefaultProvider === 'openai' ? 'default-provider' : ''}`
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-card-top"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-icon"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("img", {
    src: getProviderLogo('openai'),
    alt: "OpenAI",
    className: "ts-provider-logo-img",
    onError: e => {
      e.target.style.display = 'none';
      if (e.target.parentNode) e.target.parentNode.textContent = 'AI';
    }
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h4", {
    className: "ts-provider-name"
  }, "OpenAI (ChatGPT)"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: `ts-provider-tag ${openAiTagClass}`
  }, openAiTagText))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("label", {
    className: "ts-modern-switch",
    title: "Enable/Disable OpenAI"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("input", {
    type: "checkbox",
    checked: enabledProviders.includes('openai'),
    onChange: () => toggleProvider('openai')
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-modern-slider"
  }))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-provider-desc"
  }, "Industry standard high-accuracy neural machine translation with strict HTML tags and attribute preservation."), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-body"
  }, openAiStatus.connectors && openAiStatus.isProviderInstall ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-connector-box"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-connector-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-connector-icon"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_2__.DashboardIcons.bolt({
    size: 12
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-connector-title"
  }, "WordPress AI Connector")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-connector-desc"
  }, openAiConnectorDesc), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("a", {
    href: connectorsUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "ts-btn-connector"
  }, openAiConnectorBtnText)) : (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-input-group"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("label", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, "OpenAI API Key"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("a", {
    href: "https://platform.openai.com/api-keys",
    target: "_blank",
    rel: "noopener noreferrer",
    className: "ts-input-link"
  }, "Get Key \u2197")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-input-password-wrap"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("input", {
    type: showOpenAiKey ? 'text' : 'password',
    className: "ts-form-input",
    value: typeof settings.openai_api_key === 'string' ? settings.openai_api_key : '',
    placeholder: "sk-proj-...",
    disabled: !enabledProviders.includes('openai'),
    onChange: e => setSettings({
      ...settings,
      openai_api_key: e.target.value.trim()
    })
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-pw-toggle-btn",
    title: showOpenAiKey ? 'Hide key' : 'Show key',
    onClick: () => setShowOpenAiKey(!showOpenAiKey)
  }, showOpenAiKey ? _DashboardIcons__WEBPACK_IMPORTED_MODULE_2__.DashboardIcons.eyeOff() : _DashboardIcons__WEBPACK_IMPORTED_MODULE_2__.DashboardIcons.eye()))), isOpenAiConnected && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-input-group"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("label", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, "Translation Model")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("select", {
    className: "ts-form-select",
    value: settings.openai_model || openAiModels[0] && openAiModels[0].id || 'gpt-4o-mini',
    disabled: !enabledProviders.includes('openai'),
    onChange: e => setSettings({
      ...settings,
      openai_model: e.target.value
    })
  }, openAiModels.map(m => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    key: m.id,
    value: m.id
  }, m.name ? m.name === m.id ? m.id : m.name : m.id)))))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: `ts-provider-card gemini ${enabledProviders.includes('gemini') ? 'enabled' : ''} ${currentDefaultProvider === 'gemini' ? 'default-provider' : ''}`
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-card-top"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-icon"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("img", {
    src: getProviderLogo('gemini'),
    alt: "Google Gemini AI",
    className: "ts-provider-logo-img",
    onError: e => {
      e.target.style.display = 'none';
      if (e.target.parentNode) e.target.parentNode.textContent = 'AI';
    }
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h4", {
    className: "ts-provider-name"
  }, "Google Gemini AI"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: `ts-provider-tag ${geminiTagClass}`
  }, geminiTagText))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("label", {
    className: "ts-modern-switch",
    title: "Enable/Disable Gemini"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("input", {
    type: "checkbox",
    checked: enabledProviders.includes('gemini'),
    onChange: () => toggleProvider('gemini')
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-modern-slider"
  }))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-provider-desc"
  }, "Ultra-fast contextual multilingual models by Google with massive token windows and excellent localization fluency."), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-body"
  }, geminiStatus.connectors && geminiStatus.isProviderInstall ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-connector-box"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-connector-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-connector-icon"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_2__.DashboardIcons.bolt({
    size: 12
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-connector-title"
  }, "WordPress AI Connector")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-connector-desc"
  }, geminiConnectorDesc), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("a", {
    href: connectorsUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "ts-btn-connector"
  }, geminiConnectorBtnText)) : (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-input-group"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("label", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, "Gemini API Key"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("a", {
    href: "https://aistudio.google.com/app/apikey",
    target: "_blank",
    rel: "noopener noreferrer",
    className: "ts-input-link"
  }, "Get Key \u2197")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-input-password-wrap"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("input", {
    type: showGeminiKey ? 'text' : 'password',
    className: "ts-form-input",
    value: typeof settings.gemini_api_key === 'string' ? settings.gemini_api_key : '',
    placeholder: "AIzaSy...",
    disabled: !enabledProviders.includes('gemini'),
    onChange: e => setSettings({
      ...settings,
      gemini_api_key: e.target.value.trim()
    })
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-pw-toggle-btn",
    title: showGeminiKey ? 'Hide key' : 'Show key',
    onClick: () => setShowGeminiKey(!showGeminiKey)
  }, showGeminiKey ? _DashboardIcons__WEBPACK_IMPORTED_MODULE_2__.DashboardIcons.eyeOff() : _DashboardIcons__WEBPACK_IMPORTED_MODULE_2__.DashboardIcons.eye()))), isGeminiConnected && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-input-group"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("label", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, "Translation Model")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("select", {
    className: "ts-form-select",
    value: settings.gemini_model || 'gemini-2.0-flash',
    disabled: !enabledProviders.includes('gemini'),
    onChange: e => setSettings({
      ...settings,
      gemini_model: e.target.value
    })
  }, geminiModels.map(m => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    key: m.id,
    value: m.id
  }, m.name ? m.name === m.id ? m.id : m.name : m.id)))))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: `ts-provider-card chrome_ai ${enabledProviders.includes('chrome_ai') ? 'enabled' : ''} ${currentDefaultProvider === 'chrome_ai' ? 'default-provider' : ''}`
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-card-top"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-icon"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("img", {
    src: getProviderLogo('chrome_ai'),
    alt: "Chrome Built-in AI",
    className: "ts-provider-logo-img",
    onError: e => {
      e.target.style.display = 'none';
      if (e.target.parentNode) e.target.parentNode.textContent = 'AI';
    }
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h4", {
    className: "ts-provider-name"
  }, "Chrome Built-in AI"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-provider-tag local"
  }, "Local & Free"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("label", {
    className: "ts-modern-switch",
    title: "Enable/Disable Chrome Built-in AI"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("input", {
    type: "checkbox",
    checked: enabledProviders.includes('chrome_ai'),
    onChange: () => toggleProvider('chrome_ai')
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-modern-slider"
  }))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-provider-desc"
  }, "100% private on-device local translation using Chrome 128+ built-in Translation API. Zero cloud latency and zero API cost."), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-body"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-chrome-features-wrap"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-feature-item"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-feature-icon-circle blue"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "dashicons dashicons-shield"
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-feature-text"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-feature-title"
  }, "On-Device Processing"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-feature-subtext"
  }, "No API keys required. Operates directly in supporting browsers."))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-feature-item"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-feature-icon-circle green"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "dashicons dashicons-lock"
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-feature-text"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-feature-title"
  }, "100% Local Processing"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-feature-subtext"
  }, "Your data stays on your device."))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-feature-item"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-feature-icon-circle amber"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_2__.DashboardIcons.bolt({
    size: 14
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-feature-text"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-feature-title"
  }, "Zero Latency & Zero Cost"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-feature-subtext"
  }, "Fast, private and always available.")))))))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-settings-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-settings-card-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-settings-card-title-group"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", null, "AI Performance & Execution Controls"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", null, "Tune batching concurrency, token allocation, timeouts, and translation creativity."))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-params-grid"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-param-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-param-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-param-title"
  }, "Batch Size"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-param-badge"
  }, `${settings.batch_size || 25} items`)), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-param-desc"
  }, "Translatable strings packaged per single AI request."), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("input", {
    type: "range",
    min: 1,
    max: 50,
    step: 1,
    className: "ts-param-slider",
    value: settings.batch_size || 25,
    onChange: e => setSettings({
      ...settings,
      batch_size: parseInt(e.target.value, 10)
    })
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-param-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-param-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-param-title"
  }, "Timeout Wait"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-param-badge"
  }, `${settings.response_timeout || 30}s`)), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-param-desc"
  }, "Maximum wait limit before retrying API translation."), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("input", {
    type: "range",
    min: 5,
    max: 120,
    step: 5,
    className: "ts-param-slider",
    value: settings.response_timeout || 30,
    onChange: e => setSettings({
      ...settings,
      response_timeout: parseInt(e.target.value, 10)
    })
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-param-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-param-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-param-title"
  }, "Max Tokens"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-param-badge"
  }, (settings.max_tokens || 4096).toLocaleString())), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-param-desc"
  }, "Max output tokens allocated for JSON translated responses."), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("input", {
    type: "range",
    min: 512,
    max: 16384,
    step: 512,
    className: "ts-param-slider",
    value: settings.max_tokens || 4096,
    onChange: e => setSettings({
      ...settings,
      max_tokens: parseInt(e.target.value, 10)
    })
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-param-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-param-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-param-title"
  }, "Temperature"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-param-badge"
  }, (settings.temperature !== undefined ? parseFloat(settings.temperature) : 0.2).toFixed(2))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-param-desc"
  }, getTemperatureLabel(settings.temperature !== undefined ? settings.temperature : 0.2)), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("input", {
    type: "range",
    min: 0,
    max: 1,
    step: 0.05,
    className: "ts-param-slider",
    value: settings.temperature !== undefined ? settings.temperature : 0.2,
    onChange: e => setSettings({
      ...settings,
      temperature: parseFloat(e.target.value)
    })
  })))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-settings-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-settings-card-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-settings-card-title-group"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", null, "Create Post Settings"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", null, "Configure default post status and URL slug handling applied during bulk translation."))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-params-grid"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-param-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-param-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-param-title"
  }, "Post Status"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-param-badge"
  }, curStatus.toUpperCase())), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-param-desc"
  }, "Status for created posts in bulk translation (Draft or Publish)."), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("select", {
    className: "ts-form-select",
    value: curStatus,
    onChange: e => {
      const val = String(e.target.value || '').trim().toLowerCase();
      if (['draft', 'publish'].includes(val)) {
        setSettings({
          ...settings,
          post_status: val
        });
      }
    }
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "draft"
  }, "Draft (Default)"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "publish"
  }, "Publish"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-param-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-param-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-param-title"
  }, "Slug Translation"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-param-badge"
  }, curSlugMode === 'keep_orignal' ? 'KEEP ORIGINAL' : curSlugMode === 'title_based' ? 'TITLE BASED' : 'TRANSLATE SLUG')), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-param-desc"
  }, "How URL permalinks/slugs are generated for translated posts."), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("select", {
    className: "ts-form-select",
    value: curSlugMode,
    onChange: e => {
      const val = String(e.target.value || '').trim().toLowerCase();
      if (['keep_orignal', 'title_based', 'slug_translate'].includes(val)) {
        setSettings({
          ...settings,
          slug_translation: val
        });
      }
    }
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "slug_translate"
  }, "Translate Slug (Default)"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "title_based"
  }, "Generate from Translated Title"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
    value: "keep_orignal"
  }, "Keep Original Slug"))))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-settings-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-settings-card-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-settings-card-title-group"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", null, "AI Prompt Engineering Studio"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", null, "Customize system instructions, tone, and HTML formatting constraints delivered to OpenAI and Gemini."))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-prompt-studio"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-chips-container"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-chips-title"
  }, "Click to insert token:"), ['{source_lang}', '{target_lang}', '{count}', '{json_strings}'].map(token => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    key: token,
    type: "button",
    className: "ts-chip-btn",
    title: `Insert ${token} into prompt template`,
    onClick: () => insertTag(token)
  }, `+ ${token}`))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-prompt-editor-wrap"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("textarea", {
    id: "ts-custom-prompt-editor",
    className: "ts-prompt-textarea",
    value: currentPromptVal,
    placeholder: "Enter custom prompt instructions...",
    onChange: e => setSettings({
      ...settings,
      custom_prompt: e.target.value
    }),
    spellCheck: "false"
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-prompt-footer"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, `${currentPromptVal.length} characters • ${currentPromptVal.split('\n').length} lines`), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-prompt-actions"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn ts-btn-secondary ts-btn-md",
    onClick: copyPromptToClipboard
  }, "Copy Prompt"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn ts-btn-primary ts-btn-sm",
    onClick: () => setSettings({
      ...settings,
      custom_prompt: ''
    })
  }, "Reset to Default"))))), languages && Object.keys(languages).length > 0 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-settings-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-settings-card-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-settings-card-title-group"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", null, "Multilingual Setup (Polylang)"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", null, "Active languages detected from Polylang integration for full-site automatic and editor translations.")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("a", {
    href: "admin.php?page=mlang",
    className: "ts-btn ts-btn-secondary ts-btn-md"
  }, "Manage Languages \u2197")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-lang-tags-container"
  }, Object.keys(languages).map(key => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    key: languages[key].slug || languages[key].code,
    className: `ts-lang-tag ${languages[key].is_default ? 'default' : ''}`
  }, languages[key].flag ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("img", {
    src: languages[key].flag,
    alt: languages[key].name || languages[key].slug
  }) : (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-lang-fallback"
  }, languages[key].code ? languages[key].code.toUpperCase() : ''), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, languages[key].name || languages[key].slug), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    style: {
      opacity: 0.6,
      fontSize: '11px',
      fontFamily: 'monospace'
    }
  }, `(${languages[key].slug || languages[key].code})`), languages[key].is_default && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-lang-badge-default"
  }, "DEFAULT"))))));
}

/***/ },

/***/ "./src/dashboard/components/TopHeader.jsx"
/*!************************************************!*\
  !*** ./src/dashboard/components/TopHeader.jsx ***!
  \************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TopHeader: () => (/* binding */ TopHeader)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);

/**
 * TopHeader Component - Modern SaaS Header Bar
 */

function TopHeader({
  docsUrl = 'https://docs.dragwyb.com/',
  supportUrl = 'https://dragwyb.com/support/',
  pluginUrl = ''
}) {
  const logoSrc = pluginUrl ? `${pluginUrl}assets/img/logo.png` : 'assets/img/logo.png';
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("header", {
    className: "ts-top-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-top-brand"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-brand-logo-wrap"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("img", {
    src: logoSrc,
    alt: "TranslateSense Logo",
    onError: e => {
      e.target.style.display = 'none';
    }
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h1", {
    className: "ts-brand-title"
  }, "TranslateSense")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-top-actions"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("a", {
    href: docsUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "ts-header-action-btn"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-header-btn-text"
  }, "Documentation"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-external-arrow"
  }, "\u2197")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("a", {
    href: supportUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "ts-header-action-btn"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-header-btn-text"
  }, "Support"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-external-arrow"
  }, "\u2197"))));
}

/***/ },

/***/ "./src/dashboard/components/TranslationGuide.jsx"
/*!*******************************************************!*\
  !*** ./src/dashboard/components/TranslationGuide.jsx ***!
  \*******************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GUIDES_DATA: () => (/* binding */ GUIDES_DATA),
/* harmony export */   TranslationGuide: () => (/* binding */ TranslationGuide)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _GuideMethodSelector__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./GuideMethodSelector */ "./src/dashboard/components/GuideMethodSelector.jsx");
/* harmony import */ var _GuideStep__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./GuideStep */ "./src/dashboard/components/GuideStep.jsx");

/**
 * TranslationGuide Component - Interactive Step-by-Step Translation Walkthrough
 */




const GUIDES_DATA = {
  gutenberg: {
    id: 'gutenberg',
    title: 'Gutenberg Block Editor Translation',
    description: 'Follow these simple steps to translate your Gutenberg posts and pages while preserving all blocks and formatting.',
    importantNote: 'The generated translation is not applied to the page until you click Apply To Page.',
    steps: [{
      number: 1,
      title: 'Open Language Creation',
      description: 'Navigate to Pages → All Pages and click the + (Add Language) icon in the page row.',
      screenshot: 'Pages list showing the + (Add Language) icon in Polylang columns'
    }, {
      number: 2,
      title: 'Automatic Translation Popup',
      description: 'Continue using the Automatic Translation – Translate Page Content popup by clicking Continue to Translate.',
      screenshot: 'Automatic Translation dialog with Continue to Translate button'
    }, {
      number: 3,
      title: 'Open Page in Gutenberg',
      description: 'If the popup does not appear or was closed, open the translated page in Gutenberg.'
    }, {
      number: 4,
      title: 'Locate TranslateSense Metabox',
      description: 'Locate the TranslateSense metabox in the right sidebar, above the Polylang language metabox.',
      screenshot: 'Right editor sidebar with TranslateSense metabox above Polylang'
    }, {
      number: 5,
      title: 'Click Auto Translate',
      description: 'Click Auto Translate to initialize content block extraction.'
    }, {
      number: 6,
      title: 'Select AI Provider & Start',
      description: 'Select an AI provider and click Start Translation.'
    }, {
      number: 7,
      title: 'Wait for Translation',
      description: 'Wait for translation to finish. Translatable content is mapped and cached strings are reused.'
    }, {
      number: 8,
      title: 'Apply Generated Translation',
      description: 'Click Apply To Page to apply the generated translation.',
      note: 'The generated translation is not applied to the page until you click Apply To Page.'
    }]
  },
  classic: {
    id: 'classic',
    title: 'Classic Editor (WYSIWYG) Translation',
    description: 'Translate traditional WordPress content, WooCommerce descriptions, and custom post types using the Classic Editor.',
    importantNote: 'Classic Editor support includes WooCommerce content and supported custom post types.',
    steps: [{
      number: 1,
      title: 'Open Content Listing',
      description: 'Open the relevant content listing and click + (Add Language).'
    }, {
      number: 2,
      title: 'Continue via Popup',
      description: 'Continue using the initial automatic translation popup.'
    }, {
      number: 3,
      title: 'Open in Classic Editor',
      description: 'If the popup does not appear or was closed, open the translated content in the Classic Editor.'
    }, {
      number: 4,
      title: 'Locate Auto Translate Button',
      description: 'Locate Auto Translate above the Add Media button in the WYSIWYG editor.',
      screenshot: 'Classic Editor toolbar showing Auto Translate above Add Media'
    }, {
      number: 5,
      title: 'Click Auto Translate',
      description: 'Click Auto Translate.'
    }, {
      number: 6,
      title: 'Select AI Provider & Start',
      description: 'Select an AI provider and click Start Translation.'
    }, {
      number: 7,
      title: 'Wait for Translation',
      description: 'Wait for translation to finish.'
    }, {
      number: 8,
      title: 'Apply Translation',
      description: 'Click Apply To Page.',
      note: 'Classic Editor support includes WooCommerce content and supported custom post types.'
    }]
  },
  elementor: {
    id: 'elementor',
    title: 'Elementor Page Builder Translation',
    description: 'Translate visual Elementor layouts, custom widgets, and styled sections seamlessly without losing design hierarchy.',
    importantNote: 'The generated translation is not applied to the page until you click Apply To Page.',
    steps: [{
      number: 1,
      title: 'Navigate to Pages',
      description: 'Navigate to Pages → All Pages and click + (Add Language).'
    }, {
      number: 2,
      title: 'Continue via Popup',
      description: 'Continue using the initial automatic translation popup.'
    }, {
      number: 3,
      title: 'Open Page in Elementor',
      description: 'If the popup does not appear or was closed, open page in Elementor Editor.'
    }, {
      number: 4,
      title: 'Locate Header Button',
      description: 'Locate Auto Translate in the Elementor editor header.',
      screenshot: 'Elementor header panel with TranslateSense Auto Translate button'
    }, {
      number: 5,
      title: 'Click Auto Translate',
      description: 'Click Auto Translate.'
    }, {
      number: 6,
      title: 'Select AI Provider & Start',
      description: 'Select an AI provider and click Start Translation.'
    }, {
      number: 7,
      title: 'Wait for Translation',
      description: 'Wait for translation to finish.'
    }, {
      number: 8,
      title: 'Apply Generated Translation',
      description: 'Click Apply To Page.',
      note: 'The generated translation is not applied to the page until you click Apply To Page.'
    }]
  },
  bulk: {
    id: 'bulk',
    title: 'Bulk Translation (Batch Queue)',
    description: 'Translate multiple posts and pages in a single batch with real-time background progress monitoring.',
    importantNote: 'Translations are queued and processed safely in the background. You can monitor live progress and cancel or skip at any time.',
    steps: [{
      number: 1,
      title: 'Navigate to Content Listing',
      description: 'Navigate to Pages → All Pages or Posts → All Posts.'
    }, {
      number: 2,
      title: 'Select Multiple Items',
      description: 'Select multiple pages or posts using the table checkboxes.'
    }, {
      number: 3,
      title: 'Click Bulk Translation Button',
      description: 'Click Bulk Translation, available above and below the list table after the page filter options.',
      screenshot: 'List table navigation showing the Translate button'
    }, {
      number: 4,
      title: 'Select Target Languages',
      description: 'Select one or more target languages.'
    }, {
      number: 5,
      title: 'Choose Provider Step',
      description: 'Click Next: Choose Provider.'
    }, {
      number: 6,
      title: 'Select AI Provider',
      description: 'Select an AI provider in the provider modal.'
    }, {
      number: 7,
      title: 'Start Bulk Translation',
      description: 'Click Start Bulk Translation.'
    }, {
      number: 8,
      title: 'Progress Modal Appears',
      description: 'The bulk translation progress modal appears.'
    }, {
      number: 9,
      title: 'Monitor Live Progress',
      description: 'Monitor live translation progress in the modal.'
    }, {
      number: 10,
      title: 'Review Summary Breakdown',
      description: 'Review successful, failed and incomplete translations after completion.',
      note: 'Translations are linked in Polylang automatically. Taxonomies, categories, and post meta are synchronized.'
    }]
  }
};
function TranslationGuide() {
  const [activeMethod, setActiveMethod] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)('gutenberg');
  const guide = GUIDES_DATA[activeMethod] || GUIDES_DATA.gutenberg;
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("section", {
    className: "translatesense-guide",
    "aria-label": "Translation Workflow Guides"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-guide-section-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", {
    className: "ts-guide-main-heading"
  }, "How to Translate"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-guide-main-desc"
  }, "Choose a translation method to view its step-by-step guide.")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_GuideMethodSelector__WEBPACK_IMPORTED_MODULE_2__.GuideMethodSelector, {
    activeTab: activeMethod,
    onChange: setActiveMethod
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    id: `ts-guide-panel-${guide.id}`,
    role: "region",
    "aria-labelledby": `ts-method-card-${guide.id}`,
    className: "ts-guide-panel",
    tabIndex: 0
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-guide-panel-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h4", {
    className: "ts-guide-panel-title"
  }, guide.title), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-guide-panel-desc"
  }, guide.description)), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-timeline-container"
  }, guide.steps.map(step => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_GuideStep__WEBPACK_IMPORTED_MODULE_3__.GuideStep, {
    key: step.number,
    number: step.number,
    title: step.title,
    description: step.description,
    screenshot: step.screenshot,
    note: step.note
  }))), guide.importantNote && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-guide-footer-note"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-footer-note-badge"
  }, "NOTE: "), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-footer-note-text"
  }, guide.importantNote))));
}

/***/ },

/***/ "./src/dashboard/components/WidgetCard.jsx"
/*!*************************************************!*\
  !*** ./src/dashboard/components/WidgetCard.jsx ***!
  \*************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   WidgetCard: () => (/* binding */ WidgetCard)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./DashboardIcons */ "./src/dashboard/components/DashboardIcons.jsx");

/**
 * WidgetCard Component - Grid View for Blocks / Widgets
 */


function WidgetCard({
  widget,
  activeTab,
  onEdit,
  onGenerate
}) {
  const isSupported = widget.status !== 'unsupported';
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-widget-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-card-top"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", {
    className: "ts-card-title"
  }, widget.name), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-card-slug"
  }, widget.id)), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: `ts-table-status ${widget.status}`
  }, widget.status === 'supported' ? 'Supported' : widget.status === 'custom' ? 'Custom' : 'Unsupported')), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-card-meta"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, `Category: ${widget.category || 'Standard'}`), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, "\u2022"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: `ts-badge ts-badge-translate ${widget.field_count > 0 ? '' : 'empty'}`
  }, `${widget.field_count || 0} Translate ${widget.field_count === 1 ? 'Field' : 'Fields'}`), widget.no_translate_count > 0 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-badge ts-badge-no-translate"
  }, `${widget.no_translate_count} No Translate`), (widget.xpaths && widget.xpaths.length > 0 || widget.xpath) && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-badge ts-badge-xpath",
    title: widget.xpaths && widget.xpaths.length > 0 ? widget.xpaths.map(x => x.type ? `[${x.type}] ${x.value}` : x.value).join('\n') : `XPath: ${widget.xpath}`
  }, widget.xpaths && widget.xpaths.length > 0 && `${widget.xpaths.length} XPaths`)), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-card-actions"
  }, isSupported ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-table-btn edit",
    style: {
      width: '100%'
    },
    onClick: () => onEdit(widget)
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    style: {
      display: 'inline-flex',
      marginRight: '5px'
    }
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.pencil({
    size: 12
  })), "Edit Config") : (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-table-btn generate",
    style: {
      width: '100%'
    },
    onClick: () => onGenerate(widget)
  }, "Generate")));
}

/***/ },

/***/ "./src/dashboard/components/WidgetTableRow.jsx"
/*!*****************************************************!*\
  !*** ./src/dashboard/components/WidgetTableRow.jsx ***!
  \*****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   WidgetTableRow: () => (/* binding */ WidgetTableRow)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./DashboardIcons */ "./src/dashboard/components/DashboardIcons.jsx");

/**
 * WidgetTableRow Component - List View for Blocks / Widgets
 */


function WidgetTableRow({
  widget,
  onEdit,
  onGenerate
}) {
  const isSupported = widget.status !== 'unsupported';
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("tr", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("td", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-table-name-col"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-table-widget-title"
  }, widget.name), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-table-widget-slug"
  }, widget.id))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("td", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-category-text"
  }, widget.category || 'standard')), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("td", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      flexWrap: 'wrap'
    }
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: `ts-badge ts-badge-translate ${widget.field_count > 0 ? '' : 'empty'}`
  }, `${widget.field_count || 0} Translate ${widget.field_count === 1 ? 'field' : 'fields'}`), widget.no_translate_count > 0 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-badge ts-badge-no-translate"
  }, `${widget.no_translate_count} No Translate`), (widget.xpaths && widget.xpaths.length > 0 || widget.xpath) && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-badge ts-badge-xpath",
    title: widget.xpaths && widget.xpaths.length > 0 ? widget.xpaths.map(x => x.type ? `[${x.type}] ${x.value}` : x.value).join('\n') : `XPath: ${widget.xpath}`
  }, widget.xpaths && widget.xpaths.length > 0 && `${widget.xpaths.length} XPaths`))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("td", null, widget.status === 'supported' ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-table-status supported"
  }, "Supported") : widget.status === 'custom' ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-table-status custom"
  }, "Supported") : (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-table-status unsupported"
  }, "Unsupported")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("td", {
    style: {
      textAlign: 'right'
    }
  }, isSupported ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-table-btn edit",
    onClick: () => onEdit(widget),
    title: "Edit XML rule directly"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    style: {
      display: 'inline-flex',
      marginRight: '5px'
    }
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_1__.DashboardIcons.pencil({
    size: 12
  })), "Edit Config") : (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-table-btn generate",
    onClick: () => onGenerate(widget),
    title: "Generate XML configuration rule"
  }, "Generate")));
}

/***/ },

/***/ "./src/dashboard/components/XmlConfigModal.jsx"
/*!*****************************************************!*\
  !*** ./src/dashboard/components/XmlConfigModal.jsx ***!
  \*****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   XmlConfigModal: () => (/* binding */ XmlConfigModal)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _DashboardIcons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./DashboardIcons */ "./src/dashboard/components/DashboardIcons.jsx");

/**
 * XmlConfigModal Component - Edit & Generate XML Rule Modal
 */



function injectXpathsIntoXml(xmlStr, xpathsText, builderType) {
  if (!xmlStr || builderType !== 'gutenberg') return xmlStr;
  const lines = (xpathsText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const blockRegex = /(<gutenberg-block\b[^>]*>)([\s\S]*?)(<\/gutenberg-block>)/i;
  const match = xmlStr.match(blockRegex);
  if (!match) return xmlStr;
  let openTag = match[1].replace(/\s+xpath=(?:"[^"]*"|'[^']*')/i, '');
  if (!/\btranslate=/i.test(openTag)) {
    openTag = openTag.replace(/>$/, ' translate="1">');
  }
  let inner = match[2];
  inner = inner.replace(/^\s*<xpath\b[^>]*>[\s\S]*?<\/xpath>\s*/gim, '');
  const xpathTags = lines.map(line => {
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
function XmlConfigModal({
  widget,
  builder = 'gutenberg',
  xmlCode = '',
  onClose,
  onSave
}) {
  const isGutenberg = builder === 'gutenberg';
  const [editorCode, setEditorCode] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(xmlCode || '');
  const getInitialXpaths = () => {
    if (widget && widget.xpaths && widget.xpaths.length > 0) {
      return widget.xpaths.map(x => {
        if (typeof x === 'string') return x;
        const attrs = Object.keys(x).filter(k => k !== 'value').map(k => `${k}="${x[k]}"`).join(' ');
        return attrs ? `<xpath ${attrs}>${x.value}</xpath>` : x.value;
      }).join('\n');
    }
    if (widget && widget.xpath) {
      return widget.xpath;
    }
    return '';
  };
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
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
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-modal-overlay",
    onClick: onClose
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-modal-container",
    onClick: e => e.stopPropagation()
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-modal-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", null, widget ? `Configure XML: ${widget.name} (${builder.toUpperCase()})` : `Edit ${builder.toUpperCase()} Custom XML Configuration`), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    className: "ts-modal-close",
    onClick: onClose,
    "aria-label": "Close"
  }, _DashboardIcons__WEBPACK_IMPORTED_MODULE_2__.DashboardIcons.close({
    size: 16
  }))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-modal-body"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    style: {
      fontSize: '13px',
      color: '#64748b',
      marginTop: 0
    }
  }, isGutenberg ? 'Specify translation mappings and child <xpath> tags for GUTENBERG. When saved, this updates the active configuration.' : `Specify translation mappings for ${builder.toUpperCase()}. When saved, this updates the active configuration.`), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("textarea", {
    className: "ts-xml-editor",
    style: {
      height: '380px'
    },
    value: editorCode,
    onChange: e => setEditorCode(e.target.value),
    spellCheck: "false"
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-modal-footer"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn ts-btn-secondary",
    onClick: onClose
  }, "Cancel"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-btn ts-btn-primary button-primary",
    onClick: () => onSave(editorCode)
  }, "Save Config"))));
}

/***/ },

/***/ "./src/dashboard/hooks/useDashboardData.js"
/*!*************************************************!*\
  !*** ./src/dashboard/hooks/useDashboardData.js ***!
  \*************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   useDashboardData: () => (/* binding */ useDashboardData)
/* harmony export */ });
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _services_dashboardService__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../services/dashboardService */ "./src/dashboard/services/dashboardService.js");


function useDashboardData() {
  const localizedData = typeof window !== 'undefined' && window.TranslateSenseData || {};
  const getInitialTab = () => {
    if (typeof window === 'undefined') return 'home';
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    if (urlTab === 'translatesense') return 'home';
    const validTabs = ['home', 'settings', 'gutenberg', 'elementor', 'cache'];
    return urlTab && validTabs.includes(urlTab) ? urlTab : 'home';
  };
  const [activeTab, setActiveTab] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(getInitialTab);
  const [activeBuilders, setActiveBuilders] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(localizedData.activeBuilders || {
    gutenberg: true,
    elementor: false
  });
  const [widgetsData, setWidgetsData] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)({
    gutenberg: [],
    elementor: []
  });
  const [xmlConfigs, setXmlConfigs] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)({
    all: '',
    gutenberg: '',
    elementor: ''
  });
  const [settings, setSettings] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)({
    openai_api_key: '',
    openai_model: 'gpt-4o-mini',
    gemini_api_key: '',
    gemini_model: 'gemini-2.0-flash',
    enabled_providers: ['chrome_ai', 'openai', 'gemini'],
    batch_size: 5
  });
  const [languages, setLanguages] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(localizedData.languages || {});
  const [stats, setStats] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)({});
  const [activeProviders, setActiveProviders] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(localizedData.activeProviders || {});
  const [providerModels, setProviderModels] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(localizedData.providerModels || {});
  const [connectorsUrl] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(localizedData.connectorsUrl || 'options-connectors.php');
  const [loading, setLoading] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(true);
  const [notice, setNotice] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  const [cacheCounts, setCacheCounts] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)({
    strings: 0,
    translations: 0,
    logs: 0,
    packages: 0
  });
  const showNotice = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)((message, type = 'success', duration = 5000) => {
    setNotice({
      message,
      type
    });
    if (duration > 0) {
      setTimeout(() => {
        setNotice(current => current && current.message === message ? null : current);
      }, duration);
    }
  }, []);
  const dismissNotice = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => setNotice(null), []);
  const changeTab = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(tab => {
    setActiveTab(tab);
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url);
    }
  }, []);
  const loadData = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async () => {
    try {
      const [widgetsRes, settingsRes, xmlGutenbergRes, xmlElementorRes, cacheRes] = await Promise.allSettled([_services_dashboardService__WEBPACK_IMPORTED_MODULE_1__.fetchWidgets(), _services_dashboardService__WEBPACK_IMPORTED_MODULE_1__.fetchSettings(), _services_dashboardService__WEBPACK_IMPORTED_MODULE_1__.fetchXmlConfig('gutenberg'), _services_dashboardService__WEBPACK_IMPORTED_MODULE_1__.fetchXmlConfig('elementor'), _services_dashboardService__WEBPACK_IMPORTED_MODULE_1__.fetchCacheStats()]);
      if (widgetsRes.status === 'fulfilled' && widgetsRes.value) {
        setWidgetsData(widgetsRes.value);
      }
      if (settingsRes.status === 'fulfilled' && settingsRes.value) {
        if (settingsRes.value.settings) {
          setSettings(prev => ({
            ...prev,
            ...settingsRes.value.settings
          }));
        }
        if (settingsRes.value.languages) {
          setLanguages(settingsRes.value.languages);
        }
        if (settingsRes.value.activeBuilders) {
          setActiveBuilders(settingsRes.value.activeBuilders);
        }
        if (settingsRes.value.active_providers) {
          setActiveProviders(settingsRes.value.active_providers);
        }
        if (settingsRes.value.provider_models) {
          setProviderModels(settingsRes.value.provider_models);
        }
        if (settingsRes.value.stats) {
          setStats(settingsRes.value.stats);
        }
      }
      const xmlObj = {
        all: '',
        gutenberg: '',
        elementor: ''
      };
      if (xmlGutenbergRes.status === 'fulfilled' && xmlGutenbergRes.value && xmlGutenbergRes.value.xml) {
        xmlObj.gutenberg = xmlGutenbergRes.value.xml;
      }
      if (xmlElementorRes.status === 'fulfilled' && xmlElementorRes.value && xmlElementorRes.value.xml) {
        xmlObj.elementor = xmlElementorRes.value.xml;
      }
      setXmlConfigs(xmlObj);
      if (cacheRes.status === 'fulfilled' && cacheRes.value && cacheRes.value.counts) {
        setCacheCounts(cacheRes.value.counts);
      }
    } catch (err) {
      showNotice('Something went wrong while fetching the data.', 'error');
      console.warn('[TranslateSense] Dashboard data fetch error:', err);
    } finally {
      loading && setLoading(false);
    }
  }, []);
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    loadData();
  }, [loadData]);
  return {
    activeTab,
    changeTab,
    activeBuilders,
    setActiveBuilders,
    widgetsData,
    setWidgetsData,
    xmlConfigs,
    setXmlConfigs,
    settings,
    setSettings,
    languages,
    stats,
    activeProviders,
    providerModels,
    connectorsUrl,
    cacheCounts,
    setCacheCounts,
    loading,
    notice,
    showNotice,
    dismissNotice,
    loadData
  };
}

/***/ },

/***/ "./src/dashboard/services/dashboardService.js"
/*!****************************************************!*\
  !*** ./src/dashboard/services/dashboardService.js ***!
  \****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   clearCache: () => (/* binding */ clearCache),
/* harmony export */   fetchCacheStats: () => (/* binding */ fetchCacheStats),
/* harmony export */   fetchSettings: () => (/* binding */ fetchSettings),
/* harmony export */   fetchWidgets: () => (/* binding */ fetchWidgets),
/* harmony export */   fetchXmlConfig: () => (/* binding */ fetchXmlConfig),
/* harmony export */   openMappingSandbox: () => (/* binding */ openMappingSandbox),
/* harmony export */   saveSettings: () => (/* binding */ saveSettings),
/* harmony export */   saveXmlConfig: () => (/* binding */ saveXmlConfig)
/* harmony export */ });
/* harmony import */ var _services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../services/api/apiClient */ "./src/services/api/apiClient.js");
/* harmony import */ var _services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../services/api/endpoints */ "./src/services/api/endpoints.js");
/**
 * Dashboard Service
 * Handles all REST API requests for the Dashboard application
 */




/**
 * Fetch builder widgets mapping data
 */
async function fetchWidgets() {
  return await (0,_services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.WIDGETS, {
    method: 'GET'
  });
}

/**
 * Fetch XML configurations for builders
 * @param {'all'|'gutenberg'|'elementor'} builder
 */
async function fetchXmlConfig(builder = 'all') {
  return await (0,_services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.XML_CONFIG, {
    method: 'GET',
    params: {
      builder
    }
  });
}

/**
 * Save XML configuration for a builder
 * @param {'all'|'gutenberg'|'elementor'} builder
 * @param {string} xml
 */
async function saveXmlConfig(builder, xml) {
  return await (0,_services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.XML_CONFIG, {
    method: 'POST',
    data: {
      builder,
      xml
    }
  });
}

/**
 * Fetch plugin settings
 */
async function fetchSettings() {
  return await (0,_services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.SETTINGS, {
    method: 'GET'
  });
}

/**
 * Save plugin settings
 * @param {Object} settings
 */
async function saveSettings(settings) {
  return await (0,_services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.SETTINGS, {
    method: 'POST',
    data: settings
  });
}

/**
 * Create a mapping test post sandbox
 * @param {string} builder
 * @param {string} widgetId
 */
async function openMappingSandbox(builder, widgetId) {
  return await (0,_services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.OPEN_MAPPING_SANDBOX, {
    method: 'POST',
    data: {
      builder,
      widget_id: widgetId
    }
  });
}

/**
 * Fetch cache statistics
 */
async function fetchCacheStats() {
  return await (0,_services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.CACHE_STATS, {
    method: 'GET'
  });
}

/**
 * Clear specific or all cache
 * @param {'translations'|'strings'|'packages'|'logs'|'all'} type
 */
async function clearCache(type) {
  return await (0,_services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.CLEAR_CACHE, {
    method: 'POST',
    data: {
      type
    }
  });
}

/***/ },

/***/ "./src/services/api/apiClient.js"
/*!***************************************!*\
  !*** ./src/services/api/apiClient.js ***!
  \***************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ApiError: () => (/* binding */ ApiError),
/* harmony export */   apiRequest: () => (/* binding */ apiRequest),
/* harmony export */   getApiConfig: () => (/* binding */ getApiConfig)
/* harmony export */ });
/**
 * Centralized API Client for TranslateSense
 */

/**
 * Get localized configuration and nonce
 * @returns {{ restUrl: string, nonce: string }}
 */
function getApiConfig() {
  if (typeof window === 'undefined') {
    return {
      restUrl: '/wp-json/translatesense/v1/',
      nonce: ''
    };
  }
  const globalConfig = window.TranslateSenseData || window.TranslateSenseBulkData || window.TranslateSenseEditorData || {};
  let restUrl = globalConfig.restUrl || '/wp-json/translatesense/v1/';
  if (!restUrl.endsWith('/')) {
    restUrl += '/';
  }
  const nonce = globalConfig.nonce || window.wpApiSettings && window.wpApiSettings.nonce || '';
  return {
    restUrl,
    nonce
  };
}

/**
 * Standardized API error
 */
class ApiError extends Error {
  constructor(message, status = 500, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Performs a REST API request to TranslateSense
 *
 * @param {string} endpoint - API endpoint (without leading slash or namespace)
 * @param {Object} [options={}] - Request options
 * @param {string} [options.method='GET']
 * @param {Object|null} [options.data=null] - Request body (for POST/PUT)
 * @param {Object} [options.params={}] - Query parameters (for GET)
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<any>}
 */
async function apiRequest(endpoint, options = {}) {
  const {
    method = 'GET',
    data = null,
    params = {},
    signal
  } = options;
  const {
    restUrl,
    nonce
  } = getApiConfig();

  // If wp.apiFetch is available and we're in the WordPress admin
  if (typeof window !== 'undefined' && window.wp && typeof window.wp.apiFetch === 'function') {
    try {
      const cleanEndpoint = endpoint.replace(/^\/+/, '');
      const path = `/translatesense/v1/${cleanEndpoint}`;
      const fetchOptions = {
        path,
        method,
        signal
      };
      if (data && method !== 'GET') {
        fetchOptions.data = data;
      }

      // Append query params if GET
      if (params && Object.keys(params).length > 0) {
        const queryStr = new URLSearchParams(params).toString();
        fetchOptions.path = `${path}?${queryStr}`;
      }
      return await window.wp.apiFetch(fetchOptions);
    } catch (err) {
      const message = err.message || err.code || 'API request failed';
      const status = err.status || err.data && err.data.status || 500;
      console.error(message, status, err);
    }
  }

  // Fallback to native fetch
  let fullUrl = `${restUrl}${endpoint.replace(/^\/+/, '')}`;
  if (params && Object.keys(params).length > 0) {
    const queryStr = new URLSearchParams(params).toString();
    fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryStr;
  }
  const headers = {
    'Content-Type': 'application/json',
    'X-WP-Nonce': nonce
  };
  const fetchConfig = {
    method,
    headers,
    signal
  };
  if (data && method !== 'GET') {
    fetchConfig.body = JSON.stringify(data);
  }
  let response;
  try {
    response = await fetch(fullUrl, fetchConfig);
  } catch (netErr) {
    console.error(`Network error: ${netErr.message}`, 0, netErr);
  }
  let resData;
  try {
    resData = await response.json();
  } catch {
    resData = null;
  }
  if (!response.ok) {
    const errorMsg = resData && (resData.message || resData.error) || `HTTP Error ${response.status}: ${response.statusText}`;
    console.error(errorMsg, response.status, resData);
  }
  return resData;
}

/***/ },

/***/ "./src/services/api/endpoints.js"
/*!***************************************!*\
  !*** ./src/services/api/endpoints.js ***!
  \***************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ENDPOINTS: () => (/* binding */ ENDPOINTS)
/* harmony export */ });
/**
 * TranslateSense REST API Endpoints
 */

const ENDPOINTS = {
  WIDGETS: 'widgets',
  XML_CONFIG: 'xml-config',
  SETTINGS: 'settings',
  CACHE_STATS: 'cache-stats',
  CLEAR_CACHE: 'clear-cache',
  OPEN_MAPPING_SANDBOX: 'open-mapping-sandbox',
  EXTRACT_STRINGS: 'extract-strings',
  TRANSLATE_BATCH: 'translate-batch',
  TRANSLATE_POST: 'translate-post',
  BULK_START: 'bulk-start',
  BULK_STATUS: 'bulk-status',
  BULK_UPDATE_JOB: 'bulk-update-job',
  BULK_SKIP_POST: 'bulk-skip-post',
  BULK_ACTIVE_BATCHES: 'bulk-active-batches',
  MARK_TRANSLATED: 'mark-translated'
};

/***/ },

/***/ "./src/utils/formatting.js"
/*!*********************************!*\
  !*** ./src/utils/formatting.js ***!
  \*********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   formatDuration: () => (/* binding */ formatDuration),
/* harmony export */   formatMs: () => (/* binding */ formatMs),
/* harmony export */   formatNumber: () => (/* binding */ formatNumber)
/* harmony export */ });
/**
 * Formatting utilities for TranslateSense
 */

/**
 * Format numbers with compact K/M notation or locale string
 * @param {number} num
 * @returns {string}
 */
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const n = Number(num);
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return n.toLocaleString();
}

/**
 * Format seconds into mm:ss or Xm Ys
 * @param {number} seconds
 * @param {boolean} humanReadable
 * @returns {string}
 */
function formatDuration(seconds, humanReadable = false) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (humanReadable) {
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Format elapsed milliseconds into human time
 * @param {number} ms
 * @returns {string}
 */
function formatMs(ms) {
  if (ms >= 60000) {
    const m = Math.floor(ms / 60000);
    const s = Math.round(ms % 60000 / 1000);
    return `${m}m ${s}s`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

/***/ },

/***/ "./src/styles/dashboard.scss"
/*!***********************************!*\
  !*** ./src/styles/dashboard.scss ***!
  \***********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ },

/***/ "react"
/*!************************!*\
  !*** external "React" ***!
  \************************/
(module) {

module.exports = window["React"];

/***/ },

/***/ "@wordpress/element"
/*!*********************************!*\
  !*** external ["wp","element"] ***!
  \*********************************/
(module) {

module.exports = window["wp"]["element"];

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			const e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = (module) => {
/******/ 		const getter = module && module.__esModule ?
/******/ 			() => (module['default']) :
/******/ 			() => (module);
/******/ 		__webpack_require__.d(getter, { a: getter });
/******/ 		return getter;
/******/ 	};
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	// define getter/value functions for harmony exports
/******/ 	__webpack_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	__webpack_require__.o = (obj, prop) => (Object.hasOwn(obj, prop));
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = (exports) => {
/******/ 		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/ 	
/************************************************************************/
let __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!*********************************!*\
  !*** ./src/dashboard/index.jsx ***!
  \*********************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _DashboardApp__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./DashboardApp */ "./src/dashboard/DashboardApp.jsx");
/* harmony import */ var _styles_dashboard_scss__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../styles/dashboard.scss */ "./src/styles/dashboard.scss");

/**
 * TranslateSense Dashboard Entry Point
 */




function initDashboard() {
  const rootEl = document.getElementById('translatesense-admin-root');
  if (rootEl && !rootEl._tsReactRoot) {
    const root = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.createRoot)(rootEl);
    rootEl._tsReactRoot = root;
    root.render((0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_DashboardApp__WEBPACK_IMPORTED_MODULE_2__.DashboardApp, null));
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}
})();

/******/ })()
;
//# sourceMappingURL=index.js.map