import type { ChatMessage, ErrorCode } from '@shared/api';
import type { ChatPersona } from '@shared/content/oracle';
import { create } from 'zustand';

import { ApiError, isApiError, streamChat } from '@/lib/api';
import { queryClient, qk } from '@/lib/queries';

export type UiMessage = { id: string; role: 'user' | 'assistant'; content: string; error?: string };

type Thread = { messages: UiMessage[]; streaming: boolean; remaining: number | null };

type ChatState = {
  threads: Record<ChatPersona, Thread>;
  send: (persona: ChatPersona, text: string) => Promise<void>;
  stop: (persona: ChatPersona) => void;
  reset: (persona: ChatPersona) => void;
};

const empty = (): Thread => ({ messages: [], streaming: false, remaining: null });
const controllers: Partial<Record<ChatPersona, AbortController>> = {};
let seq = 0;
const nextId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

const friendly = (code: ErrorCode | string, fallback: string) => {
  switch (code) {
    case 'LIMIT_REACHED':
      return "That's all the Oracle can pour for today. Come back tomorrow, amigo.";
    case 'AI_UNAVAILABLE':
    case 'NOT_CONFIGURED':
      return 'The Oracle is resting right now. Try again in a moment.';
    case 'NETWORK':
      return "Can't reach the Oracle — check your connection.";
    default:
      return fallback;
  }
};

/** Conversations live for the app session (not persisted — nothing chat-related is stored). */
export const useChats = create<ChatState>((set, get) => ({
  threads: { cantinero: empty(), mesa: empty() },

  send: async (persona, text) => {
    const trimmed = text.trim();
    if (!trimmed || get().threads[persona].streaming) return;
    const user: UiMessage = { id: nextId(), role: 'user', content: trimmed };
    const reply: UiMessage = { id: nextId(), role: 'assistant', content: '' };
    const update = (fn: (t: Thread) => Thread) => set((s) => ({ threads: { ...s.threads, [persona]: fn(s.threads[persona]) } }));
    update((t) => ({ ...t, streaming: true, messages: [...t.messages, user, reply] }));

    const history: ChatMessage[] = get()
      .threads[persona].messages.filter((m) => !m.error && m.content && m.id !== reply.id)
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    controllers[persona] = controller;
    const patchReply = (patch: Partial<UiMessage>) => update((t) => ({ ...t, messages: t.messages.map((m) => (m.id === reply.id ? { ...m, ...patch } : m)) }));
    let content = '';

    try {
      await streamChat(
        { persona, messages: history },
        (e) => {
          if ('delta' in e) {
            content += e.delta;
            patchReply({ content });
          } else if ('done' in e) {
            update((t) => ({ ...t, remaining: e.remaining }));
          } else if ('error' in e) {
            throw new ApiError(e.error, 0, e.code);
          }
        },
        controller.signal,
      );
      if (!content && !controller.signal.aborted) patchReply({ error: friendly('AI_UNAVAILABLE', '') });
    } catch (e) {
      const msg = isApiError(e) ? friendly(e.code, e.message) : 'Something went wrong.';
      patchReply({ error: msg });
    } finally {
      delete controllers[persona];
      update((t) => ({ ...t, streaming: false, messages: t.messages.filter((m) => m.id !== reply.id || m.content || m.error) }));
      // Keep the remaining-allowance badge on the Oracle hub in sync.
      void queryClient.invalidateQueries({ queryKey: qk.me });
    }
  },

  stop: (persona) => controllers[persona]?.abort(),
  reset: (persona) => {
    controllers[persona]?.abort();
    set((s) => ({ threads: { ...s.threads, [persona]: empty() } }));
  },
}));

