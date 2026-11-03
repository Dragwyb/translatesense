/**
 * AppProvider Context Wrapper
 */

import { NotificationProvider } from './NotificationContext';

export function AppProvider({ children }) {
  return <NotificationProvider>{children}</NotificationProvider>;
}

