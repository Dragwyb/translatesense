/**
 * TranslateSense Dashboard Application Root
 * 2-Column SaaS Layout with TopHeader, Tab Switcher, HomeGuidePanel, Settings,
 * Gutenberg/Elementor Builders, Cache Manager, RightSidebar, and FooterBar.
 */

import { useState, useEffect } from '@wordpress/element';
import { useDashboardData } from './hooks/useDashboardData';
import { TopHeader } from './components/TopHeader';
import { RightSidebar } from './components/RightSidebar';
import { FooterBar } from './components/FooterBar';
import { HomeGuidePanel } from './components/HomeGuidePanel';
import { SettingsTab } from './components/SettingsTab';
import { BuilderConfigTab } from './components/BuilderConfigTab';
import { CacheTab } from './components/CacheTab';
import { XmlConfigModal } from './components/XmlConfigModal';
import { DashboardIcons } from './components/DashboardIcons';
import * as dashboardService from './services/dashboardService';
import { apiRequest } from '../services/api/apiClient';
import { ENDPOINTS } from '../services/api/endpoints';

export function DashboardApp() {
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
    loadData,
  } = useDashboardData();

  const [xmlModal, setXmlModal] = useState({
    isOpen: false,
    builder: 'gutenberg',
    widget: null,
    xmlCode: '',
  });

  const [isCreatingSandbox, setIsCreatingSandbox] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);

  const localizedData =
    (typeof window !== 'undefined' && window.TranslateSenseData) || {};

  // Global keyboard shortcut (Ctrl+S / Cmd+S) to save settings when on settings tab
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

  const handleSaveSettings = async (newSettings) => {
    setIsSavingSettings(true);
    try {
      const payload = newSettings && newSettings.enabled_providers ? newSettings : settings;
      const res = await dashboardService.saveSettings(payload);
      if (res && res.success !== false) {
        showNotice(res.message || 'Settings saved successfully!');
        loadData();
      } else {
        showNotice((res && res.message) || 'Failed to save settings', 'error');
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
        const res = await dashboardService.fetchXmlConfig(builder);
        xmlCode = res.xml || res.custom_xml || '';
      } catch {
        xmlCode = '';
      }
    }
    setXmlModal({
      isOpen: true,
      builder: builder || activeTab,
      widget,
      xmlCode,
    });
  };

  const handleCloseXmlModal = () => {
    setXmlModal({ isOpen: false, builder: 'gutenberg', widget: null, xmlCode: '' });
  };

  const handleSaveXml = async (newXml) => {
    try {
      const res = await dashboardService.saveXmlConfig(xmlModal.builder, newXml);
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
      const res = await apiRequest(ENDPOINTS.DASHBOARD.GENERATE_SANDBOX, {
        method: 'POST',
        data: { builder, widget_slug: widgetSlug },
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
      const res = await dashboardService.fetchCacheStats();
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

  const handleClearCache = async (type) => {
    try {
      const res = await dashboardService.clearCache(type);
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
    return (
      <div className="translatesense-dashboard">
        <TopHeader
          docsUrl={localizedData.docsUrl}
          supportUrl="https://dragwyb.com/support/"
          pluginUrl={localizedData.pluginUrl}
        />
        <div className="ts-loading-placeholder">
          <div className="ts-spinner" />
          <p>Loading TranslateSense Dashboard...</p>
        </div>
      </div>
    );
  }

  const totalCacheRecords =
    (cacheCounts.strings || 0) +
    (cacheCounts.translations || 0) +
    (cacheCounts.packages || 0) +
    (cacheCounts.logs || 0);

  return (
    <div className="translatesense-dashboard">
      {/* 1. Top Header Bar */}
      <TopHeader
        docsUrl={localizedData.docsUrl}
        supportUrl="https://dragwyb.com/support/"
        pluginUrl={localizedData.pluginUrl}
      />

      {/* 2. Notification Banner */}
      {notice && (
        <div className={`ts-notice-banner ${notice.type || 'info'}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {notice.type === 'error' ? (
              DashboardIcons.alert({ size: 16 })
            ) : (
              DashboardIcons.check({ size: 16 })
            )}
            <span>{notice.message || notice.text}</span>
          </div>
          <button
            type="button"
            className="ts-notice-close"
            onClick={dismissNotice}
            aria-label="Close"
          >
            {DashboardIcons.close({ size: 14 })}
          </button>
        </div>
      )}

      {/* 3. Two-Column Layout (Main Area + Right Sidebar) */}
      <div className="ts-dashboard-layout">
        {/* Left Main Column */}
        <main className="ts-main-column">
          {/* Tabs Card */}
          <nav className="ts-tabs-card" aria-label="Dashboard Tabs">
            <button
              type="button"
              className={`ts-tab-btn ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => changeTab('home')}
            >
              <span className="ts-tab-icon" style={{ display: 'inline-flex', marginRight: '6px' }}>
                {DashboardIcons.home({ size: 14 })}
              </span>
              Home
            </button>

            <button
              type="button"
              className={`ts-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => changeTab('settings')}
            >
              General Settings
            </button>

            {activeBuilders.gutenberg && (
              <button
                type="button"
                className={`ts-tab-btn ${activeTab === 'gutenberg' ? 'active' : ''}`}
                onClick={() => changeTab('gutenberg')}
              >
                Gutenberg Blocks
                <span className="ts-tab-count">
                  {widgetsData.gutenberg ? widgetsData.gutenberg.length : 0}
                </span>
              </button>
            )}

            {activeBuilders.elementor && (
              <button
                type="button"
                className={`ts-tab-btn ${activeTab === 'elementor' ? 'active' : ''}`}
                onClick={() => changeTab('elementor')}
              >
                Elementor Widgets
                <span className="ts-tab-count">
                  {widgetsData.elementor ? widgetsData.elementor.length : 0}
                </span>
              </button>
            )}

            <button
              type="button"
              className={`ts-tab-btn ${activeTab === 'cache' ? 'active' : ''}`}
              onClick={() => changeTab('cache')}
            >
              <span className="ts-tab-icon" style={{ display: 'inline-flex', marginRight: '6px' }}>
                {DashboardIcons.database({ size: 14 })}
              </span>
              Cache
              <span className="ts-tab-count">
                {totalCacheRecords.toLocaleString()}
              </span>
            </button>
          </nav>

          {/* Active Tab Content */}
          {activeTab === 'home' && (
            <HomeGuidePanel
              onNavigateTab={changeTab}
              activeBuilders={activeBuilders}
              activeProviders={activeProviders}
              languages={languages}
              cacheCounts={cacheCounts}
              polylangActive={localizedData.polylangActive !== false}
              bulkTranslateUrl="edit.php"
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              settings={settings}
              setSettings={setSettings}
              onSave={handleSaveSettings}
              languages={languages}
              showNotice={showNotice}
              activeProviders={activeProviders}
              connectorsUrl={connectorsUrl}
              providerModels={providerModels}
            />
          )}

          {(activeTab === 'gutenberg' || activeTab === 'elementor') && (
            <BuilderConfigTab
              key={activeTab}
              activeTab={activeTab}
              widgets={widgetsData[activeTab] || []}
              onOpenXmlModal={handleOpenXmlModal}
              onGenerateSandbox={handleGenerateConfigSandbox}
              isCreatingSandbox={isCreatingSandbox}
            />
          )}

          {activeTab === 'cache' && (
            <CacheTab
              cacheCounts={cacheCounts}
              onRefreshCache={handleRefreshCache}
              isRefreshing={isRefreshingCache}
              onClearCache={handleClearCache}
            />
          )}
        </main>

        {/* Right Sidebar */}
        <RightSidebar
          stats={stats}
        />
      </div>

      {/* 4. Footer Bar */}
      <FooterBar
        activeTab={activeTab}
        onSaveSettings={() => handleSaveSettings(settings)}
        isSaving={isSavingSettings}
        pluginUrl={localizedData.pluginUrl}
      />

      {/* XML Configuration Modal */}
      {xmlModal.isOpen && (
        <XmlConfigModal
          widget={xmlModal.widget}
          builder={xmlModal.builder}
          xmlCode={xmlModal.xmlCode}
          onClose={handleCloseXmlModal}
          onSave={handleSaveXml}
        />
      )}
    </div>
  );
}
