import { createContext, useCallback, useContext } from 'react';
import { cs } from './cs';
import { en } from './en';

/** Every UI string of the app, child (Czech) and admin (English) together. */
export const messages = { ...cs, ...en };
export type MessageKey = keyof typeof messages;
export type Messages = Record<MessageKey, string>;

export const MessagesContext = createContext<Messages>(messages);

/** `const t = useT(); t('app.name')` — a missing key is a type error. */
export function useT(): (key: MessageKey) => string {
  const catalog = useContext(MessagesContext);
  return useCallback((key: MessageKey) => catalog[key], [catalog]);
}
