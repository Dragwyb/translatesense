import { useState, useCallback, useRef } from '@wordpress/element';
import { getEvaluatedProviders } from '../../services/providers/providerService';
import { extractPostStrings, markPostTranslated, translatePostServer } from '../services/pageTranslationService';
import { getCoreInstance } from '../../services/core/coreService';
import { isEmailOrUrl } from '../../utils/validation';
import { formatMs } from '../../utils/formatting';

export function usePageTranslation(config = {}) {
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSourcePromptOpen, setIsSourcePromptOpen] = useState(null);
  const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '', errorObj: null });

  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('openai');

  const [extractedStrings, setExtractedStrings] = useState([]);
  const [strings, setStrings] = useState([]);
  const [sourcePageData, setSourcePageData] = useState(null);

  // Progress overlay state
  const [progress, setProgress] = useState({
    isOpen: false,
    percent: 0,
    status: '',
    subText: '',
    isExtracting: false,
  });

  // Stats
  const [translationStats, setTranslationStats] = useState({
    timeTaken: '0.0s',
    timeTakenMs: 0,
    totalChars: 0,
    translatedChars: 0,
    stringCount: 0,
  });

  const lastCompletedProviderRef = useRef('');
  const lastCompletedTargetLangRef = useRef('');

  const targetLang = config.targetLanguage || 'es';
  const sourceLang = config.sourceLanguage || config.defaultLanguage || 'en';
  const sourcePostId = config.sourcePostId || 0;
  const postId = config.postId || 0;
  const editorType = config.editorType || 'classic';

  // Load providers
  const loadProviders = useCallback(async () => {
    try {
      const list = await getEvaluatedProviders(sourceLang, targetLang);
      setProviders(list);

      const defaultProv = config.defaultProvider || '';
      let chosen = list.find((p) => p.isAvailable && p.id === defaultProv)?.id;
      if (!chosen) {
        chosen = list.find((p) => p.isAvailable)?.id || list[0]?.id || 'openai';
      }
      setSelectedProvider(chosen);
    } catch (err) {
      console.warn('[TranslateSense] Could not evaluate providers:', err);
    }
  }, [sourceLang, targetLang, config.defaultProvider]);

  // Check if translation is 100% completed in current session
  const isTranslationCompleted = useCallback(
    (providerId) => {
      const prov = providerId || selectedProvider;
      if (!prov || !Array.isArray(strings) || strings.length === 0) return false;
      if (
        lastCompletedProviderRef.current !== prov ||
        lastCompletedTargetLangRef.current !== targetLang
      ) {
        return false;
      }
      return strings.every((s) => s.translated && String(s.translated).trim() !== '');
    },
    [selectedProvider, strings, targetLang]
  );

  // Extract strings and run translation
  const extractAndTranslate = useCallback(
    async (chosenProvider) => {
      const prov = chosenProvider || selectedProvider;
      const core = getCoreInstance();

      setIsReviewModalOpen(true);

      // If translation already complete, directly open review modal
      if (isTranslationCompleted(prov)) {
        return;
      }

      if (!sourcePostId) return;

      setProgress({
        isOpen: false,
        percent: 0,
        status: 'Extracting strings...',
        subText: 'Initializing translation...',
        isExtracting: true,
      });

      // 1. Fetch sourcePageData if not present
      let pageData = sourcePageData;
      if (!pageData && core && typeof core.getPageContent === 'function') {
        try {
          pageData = await core.getPageContent(sourcePostId);
          setSourcePageData(pageData);
        } catch (e) {
          console.warn('[TranslateSense] Could not fetch source page data:', e);
        }
      }

      // 2. Fetch extracted strings
      let rawStrings = extractedStrings;
      if (!rawStrings || rawStrings.length === 0) {
        try {
          const res = await extractPostStrings(sourcePostId, editorType, targetLang);
          rawStrings = Array.isArray(res.strings) ? res.strings : [];
          rawStrings = rawStrings.filter((s) => !isEmailOrUrl(s.value || ''));

          setExtractedStrings(rawStrings);
        } catch (err) {
          setProgress({ isOpen: false, percent: 0, status: '', subText: '', isExtracting: false });
          setIsReviewModalOpen(false);
          alert('Extraction Error: ' + (err.message || 'Unknown error'));
          return;
        }
      }

      // 3. Prepare initial strings array checking Core cache
      const currentStrings = rawStrings.map((s) => {
        let translated = '';
        let status = 'Pending';
        if (core) {
          const cached = core.getTranslatedString(s.name, s.value, prov, s.name);
          if (cached && typeof cached === 'object' && cached.translate) {
            translated = cached.translate;
            status = 'Completed';
          } else if (typeof cached === 'string' && cached.trim() !== '') {
            translated = cached;
            status = 'Completed';
          }
        }
        return {
          ...s,
          providerTranslated: s.providerTranslated || translated || '',
          translated,
          status,
        };
      });

      setStrings(currentStrings);

      // Check if all already translated
      const allDone =
        currentStrings.length > 0 &&
        currentStrings.every((s) => s.translated && String(s.translated).trim() !== '');

      if (allDone) {
        lastCompletedProviderRef.current = prov;
        lastCompletedTargetLangRef.current = targetLang;
        setProgress({ isOpen: false, percent: 100, status: '', subText: '', isExtracting: false });
        setIsReviewModalOpen(true);
        return;
      }

      // 4. Perform translation batch
      const total = currentStrings.length;
      setProgress({
        isOpen: true,
        percent: 15,
        status: 'Translating strings...',
        subText: `0 of ${total} strings translated`,
        isExtracting: false,
      });

      const startTime = performance.now();
      const itemsToTranslate = currentStrings.map((s) => ({
        hash: s.hash,
        widget_id: s.name,
        field: s.key,
        source: s.source || s.value,
        content: s.value,
      }));

      try {
        if (core) {
          await core.translate(
            prov,
            {
              items: itemsToTranslate,
              sourceLang: sourceLang || 'en',
              targetLang,
              postId,
            },
            (result) => {
              setStrings((prevList) => {
                const nextList = prevList.map((item) => {
                  if (item.value === result.source || (result.hash && item.hash === result.hash)) {
                    if (core) {
                      core.saveSourceString(item.name, item.value, item.name);
                      core.saveTranslatedString(
                        item.name,
                        item.source,
                        item.value,
                        result.translated,
                        prov,
                        item.name
                      );
                    }
                    return {
                      ...item,
                      providerTranslated: result.translated,
                      translated: result.translated,
                      status: result.status || 'Completed',
                    };
                  }
                  return item;
                });

                const completedCount = nextList.filter(
                  (s) => s.translated && s.translated.trim() !== ''
                ).length;
                const pct = Math.min(100, Math.max(15, Math.round((completedCount / total) * 100)));

                setProgress({
                  isOpen: true,
                  percent: pct,
                  status: `Translating strings... (${pct}%)`,
                  subText: `${completedCount} of ${total} strings translated`,
                  isExtracting: false,
                });

                return nextList;
              });
            }
          );
        }

        const elapsedMs = performance.now() - startTime;
        const totalSourceChars = currentStrings.reduce(
          (sum, s) => sum + String(s.value || '').length,
          0
        );

        setTranslationStats({
          timeTaken: formatMs(elapsedMs),
          timeTakenMs: Math.round(elapsedMs),
          totalChars: totalSourceChars,
          translatedChars: totalSourceChars,
          stringCount: total,
        });

        setProgress({
          isOpen: true,
          percent: 100,
          status: '✓ Translation Completed (100%)',
          subText: `All ${total} strings translated successfully!`,
          isExtracting: false,
        });

        lastCompletedProviderRef.current = prov;
        lastCompletedTargetLangRef.current = targetLang;

        // Graceful delay before closing progress modal and opening review modal
        setTimeout(() => {
          setProgress((p) => ({ ...p, isOpen: false }));
          setIsReviewModalOpen(true);
        }, 3500);
      } catch (err) {
        setProgress((p) => ({ ...p, isOpen: false }));
        setIsReviewModalOpen(false);
        alert('Translation Batch Error: ' + (err.message || 'Error'));
      }
    },
    [
      selectedProvider,
      isTranslationCompleted,
      sourcePostId,
      sourcePageData,
      extractedStrings,
      editorType,
      targetLang,
      sourceLang,
      postId,
    ]
  );

  // Apply translations to active editor
  const applyTranslationsToPage = useCallback(async () => {
    const core = getCoreInstance();

    // 1. Sync strings to Core
    if (core) {
      strings.forEach((s) => {
        core.saveSourceString(s.name, s.value, s.name);
        core.saveTranslatedString(s.name, s.source || s.value, s.value, s.translated, selectedProvider, s.name);
      });
    }

    // 3. Apply via Editor registry
    const res = await core.applyToPageEditor(editorType, {
      strings,
      sourcePageData,
      options: {
        provider: selectedProvider,
      }
    });

    setIsReviewModalOpen(false);

    // 2. Mark translated on server
    if (postId) {
      const totalChars = translationStats.totalChars || strings.reduce((sum, s) => sum + String(s.value || '').length, 0);
      const totalStrs = translationStats.stringCount || strings.length;

      markPostTranslated({
        post_id: postId,
        status: 'success',
        total_characters: totalChars,
        total_strings: totalStrs,
        provider: selectedProvider || 'openai',
        time_take: translationStats.timeTakenMs || 0,
      }).catch((err) => console.warn('[TranslateSense] Could not update stats:', err));
    }

    return res;
  }, [strings, selectedProvider, postId, translationStats, editorType, sourcePageData]);

  return {
    isProviderModalOpen,
    setIsProviderModalOpen,
    isReviewModalOpen,
    setIsReviewModalOpen,
    isSourcePromptOpen,
    setIsSourcePromptOpen,
    errorModal,
    setErrorModal,
    providers,
    loadProviders,
    selectedProvider,
    setSelectedProvider,
    strings,
    setStrings,
    progress,
    translationStats,
    extractAndTranslate,
    applyTranslationsToPage,
    isTranslationCompleted,
    targetLang,
    sourceLang,
  };
}
