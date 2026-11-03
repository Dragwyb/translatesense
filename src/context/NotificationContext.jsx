import { createContext, useContext, useState, useCallback } from '@wordpress/element';

const NotificationContext = createContext({
  notice: null,
  showNotice: () => {},
  hideNotice: () => {},
});

export function NotificationProvider({ children }) {
  const [notice, setNotice] = useState(null);

  const hideNotice = useCallback(() => {
    setNotice(null);
  }, []);

  const showNotice = useCallback((message, type = 'success', duration = 5000) => {
    setNotice({ message, type });
    if (duration > 0) {
      setTimeout(() => {
        setNotice((current) => (current && current.message === message ? null : current));
      }, duration);
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ notice, showNotice, hideNotice }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  return useContext(NotificationContext);
}

