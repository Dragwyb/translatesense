import { useState, useEffect, useCallback } from '@wordpress/element';
import * as dashboardService from '../services/dashboardService';

export function useDashboardData() {
  const localizedData =
    (typeof window !== 'undefined' && window.TranslateSenseData) || {};

  const getInitialTab = () => {
    if (typeof window === 'undefined') return 'home';
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    if (urlTab === 'translatesense') return 'home';
    const validTabs = ['home', 'settings', 'gutenberg', 'elementor', 'cache'];
    return urlTab && validTabs.includes(urlTab) ? urlTab : 'home';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [activeBuilders, setActiveBuilders] = useState(
    localizedData.activeBuilders || { gutenberg: true, elementor: false }
  );
  const [widgetsData, setWidgetsData] = useState({ gutenberg: [], elementor: [] });
  const [xmlConfigs, setXmlConfigs] = useState({ all: '', gutenberg: '', elementor: '' });
  const [settings, setSettings] = useState({
    openai_api_key: '',
    openai_model: 'gpt-4o-mini',
    gemini_api_key: '',
    gemini_model: 'gemini-2.0-flash',
    enabled_providers: ['chrome_ai', 'openai', 'gemini'],
    batch_size: 5,
  });
  const [languages, setLanguages] = useState(localizedData.languages || {});
  const [stats, setStats] = useState({});
  const [activeProviders, setActiveProviders] = useState(localizedData.activeProviders || {});
  const [providerModels, setProviderModels] = useState(localizedData.providerModels || {});
  const [connectorsUrl] = useState(localizedData.connectorsUrl || 'options-connectors.php');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [cacheCounts, setCacheCounts] = useState({
    strings: 0,
    translations: 0,
    logs: 0,
    packages: 0,
  });

  const showNotice = useCallback((message, type = 'success', duration = 5000) => {
    setNotice({ message, type });
    if (duration > 0) {
      setTimeout(() => {
        setNotice((current) => (current && current.message === message ? null : current));
      }, duration);
    }
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const changeTab = useCallback((tab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [widgetsRes, settingsRes, xmlGutenbergRes, xmlElementorRes, cacheRes] =
        await Promise.allSettled([
          dashboardService.fetchWidgets(),
          dashboardService.fetchSettings(),
          dashboardService.fetchXmlConfig('gutenberg'),
          dashboardService.fetchXmlConfig('elementor'),
          dashboardService.fetchCacheStats(),
        ]);

      if (widgetsRes.status === 'fulfilled' && widgetsRes.value) {
        setWidgetsData(widgetsRes.value);
      }

      if (settingsRes.status === 'fulfilled' && settingsRes.value) {
        if (settingsRes.value.settings) {
          setSettings((prev) => ({ ...prev, ...settingsRes.value.settings }));
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

      const xmlObj = { all: '', gutenberg: '', elementor: '' };
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
      console.warn('[TranslateSense] Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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
    loadData,
  };
}

