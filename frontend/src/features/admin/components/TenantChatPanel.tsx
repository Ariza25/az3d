import React, { useEffect, useRef, useState } from 'react';
import {
  MessageSquare,
  Search,
  Send,
  User,
  Clock,
  CheckCheck,
  Sparkles,
  Inbox,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { ChatConversation, ChatMessage } from '../../../types';
import { api } from '../../../services/api';

interface TenantChatPanelProps {
  tenantId?: number;
}

const CANNED_REPLIES = [
  'Olá! Como posso ajudar você hoje?',
  'Trabalhamos com PLA, PETG e ABS em diversas cores.',
  'O prazo médio de fabricação é de 2 a 4 dias úteis.',
  'Pode nos enviar seu modelo 3D (STL) para analisarmos o orçamento!',
];

export const TenantChatPanel: React.FC<TenantChatPanelProps> = ({ tenantId }) => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<number | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async (silent = false) => {
    if (!silent) setIsLoadingList(true);
    try {
      const data = await api.getTenantChatConversations(tenantId);
      setConversations(data || []);
      // Se tiver conversas e nenhuma selecionada ainda, seleciona a primeira
      if (!selectedId && data && data.length > 0) {
        setSelectedId(data[0].id);
      }
    } catch (err: any) {
      console.error('Erro ao carregar conversas do lojista:', err);
      if (!silent) setError('Não foi possível carregar as conversas.');
    } finally {
      if (!silent) setIsLoadingList(false);
    }
  };

  const loadConversationMessages = async (convId: number, silent = false) => {
    if (!silent) setIsLoadingMessages(true);
    try {
      const response = await api.getTenantChatMessages(convId, tenantId);
      setMessages(response.messages || []);
      // Atualiza o contador de não lidas localmente
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread_tenant_count: 0 } : c))
      );
    } catch (err: any) {
      console.error('Erro ao carregar mensagens:', err);
    } finally {
      if (!silent) setIsLoadingMessages(false);
    }
  };

  // Carga inicial e Polling de conversas
  useEffect(() => {
    void loadConversations();

    const interval = window.setInterval(() => {
      void loadConversations(true);
    }, 4000);
    pollingRef.current = interval;

    return () => {
      clearInterval(interval);
    };
  }, [tenantId]);

  // Carga de mensagens ao selecionar conversa
  useEffect(() => {
    if (selectedId) {
      void loadConversationMessages(selectedId);

      const msgInterval = window.setInterval(() => {
        void loadConversationMessages(selectedId, true);
      }, 4000);

      return () => {
        clearInterval(msgInterval);
      };
    } else {
      setMessages([]);
    }
  }, [selectedId, tenantId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = replyText.trim();
    if (!text || !selectedId || isSending) return;

    setIsSending(true);
    setReplyText('');

    const optimistic: ChatMessage = {
      id: Date.now(),
      conversation_id: selectedId,
      tenant_id: tenantId || 1,
      sender_id: 0,
      sender_type: 'tenant',
      sender_name: 'Você (Loja)',
      message: text,
      read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const created = await api.sendTenantChatMessage(selectedId, text, tenantId);
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? created : m)));
      // Atualiza última mensagem na lista
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? { ...c, last_message: text, last_message_at: new Date().toISOString() }
            : c
        )
      );
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar resposta');
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setReplyText(text);
    } finally {
      setIsSending(false);
    }
  };

  const selectedConversation = conversations.find((c) => c.id === selectedId);

  const filteredConversations = conversations.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (c.customer_name && c.customer_name.toLowerCase().includes(q)) ||
      (c.customer_email && c.customer_email.toLowerCase().includes(q)) ||
      (c.last_message && c.last_message.toLowerCase().includes(q))
    );
  });

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/60 dark:backdrop-blur-md overflow-hidden">
      {/* Header do Painel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 p-5 dark:border-chumbo-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-600/10 border border-cyan-500/20 text-cyan-600 dark:bg-laser-400/15 dark:border-laser-500/30 dark:text-laser-400">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              Atendimento & Dúvidas dos Clientes
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Converse em tempo real com clientes compradores que acessam sua loja
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadConversations()}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-chumbo-700 dark:bg-chumbo-950/60 dark:text-slate-300 dark:hover:bg-chumbo-800 transition-colors w-fit"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Atualizar</span>
        </button>
      </div>

      {error && (
        <div className="m-4 p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Layout 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[560px]">
        {/* Coluna Esquerda: Lista de Conversas (4 colunas) */}
        <div className="lg:col-span-4 border-r border-slate-200 dark:border-chumbo-800 flex flex-col bg-slate-50/50 dark:bg-chumbo-950/40">
          {/* Busca */}
          <div className="p-3 border-b border-slate-200 dark:border-chumbo-800">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente ou mensagem..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 dark:border-chumbo-700 dark:bg-chumbo-900 dark:text-white dark:focus:border-laser-400"
              />
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-chumbo-800/60">
            {isLoadingList ? (
              <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <Clock className="h-4 w-4 animate-spin text-laser-400" />
                <span>Carregando conversas...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-12 text-center px-4 text-slate-400 flex flex-col items-center gap-2">
                <Inbox className="h-8 w-8 text-slate-500 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-300">Nenhuma conversa encontrada</p>
                <p className="text-[11px] text-slate-500">
                  Quando um cliente enviar dúvidas na loja, elas aparecerão aqui.
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === selectedId;
                const timeAgo = conv.last_message_at
                  ? new Date(conv.last_message_at).toLocaleDateString([], {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedId(conv.id)}
                    className={`w-full text-left p-3.5 transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-cyan-50/80 border-l-4 border-cyan-600 dark:bg-laser-400/10 dark:border-laser-400'
                        : 'hover:bg-slate-100 dark:hover:bg-chumbo-800/60'
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 text-slate-800 font-bold uppercase dark:from-chumbo-800 dark:to-chumbo-700 dark:text-slate-200 shadow-sm">
                      {conv.customer_name ? conv.customer_name.charAt(0) : <User className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <strong className="truncate text-xs font-bold text-slate-900 dark:text-white">
                          {conv.customer_name || 'Cliente'}
                        </strong>
                        <span className="text-[10px] text-slate-400 shrink-0">{timeAgo}</span>
                      </div>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {conv.last_message || 'Iniciou o atendimento'}
                      </p>
                      {conv.customer_email && (
                        <span className="block truncate text-[10px] text-slate-400 mt-0.5">
                          {conv.customer_email}
                        </span>
                      )}
                    </div>
                    {conv.unread_tenant_count > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-laser-400 px-1.5 text-[10px] font-extrabold text-chumbo-950 shadow shrink-0">
                        {conv.unread_tenant_count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Coluna Direita: Conversa Selecionada (8 colunas) */}
        <div className="lg:col-span-8 flex flex-col bg-white dark:bg-chumbo-950/60 min-h-[480px]">
          {selectedConversation ? (
            <>
              {/* Header do Chat */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-chumbo-800 p-4 bg-slate-50/50 dark:bg-chumbo-900/40">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-laser-400/20 text-laser-400 font-bold uppercase">
                    {selectedConversation.customer_name?.charAt(0) || 'C'}
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {selectedConversation.customer_name || 'Cliente Comprador'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedConversation.customer_email || 'E-mail não informado'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
                {isLoadingMessages ? (
                  <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                    <Clock className="h-4 w-4 animate-spin text-laser-400" />
                    <span>Carregando histórico...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Nenhuma mensagem enviada ainda. Envie uma saudação abaixo!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isTenant = msg.sender_type === 'tenant';
                    const timeStr = msg.created_at
                      ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '';

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col gap-1 max-w-[80%] ${
                          isTenant ? 'ml-auto items-end' : 'mr-auto items-start'
                        }`}
                      >
                        <div
                          className={`rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${
                            isTenant
                              ? 'rounded-tr-none bg-cyan-600 text-white font-medium dark:bg-laser-400 dark:text-chumbo-950 font-semibold'
                              : 'rounded-tl-none bg-slate-100 text-slate-900 dark:bg-chumbo-900 dark:border dark:border-chumbo-800 dark:text-slate-100'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 px-1">
                          <span>{timeStr}</span>
                          {isTenant && <CheckCheck className="h-3 w-3 text-cyan-600 dark:text-laser-400" />}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Respostas Rápidas Sugeridas */}
              <div className="px-4 py-2 border-t border-slate-200 dark:border-chumbo-800/80 bg-slate-50/40 dark:bg-chumbo-900/30 overflow-x-auto">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-laser-400" />
                    <span>Respostas rápidas:</span>
                  </span>
                  {CANNED_REPLIES.map((canned, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setReplyText(canned)}
                      className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:border-cyan-500 hover:text-cyan-700 dark:border-chumbo-700 dark:bg-chumbo-900 dark:text-slate-300 dark:hover:border-laser-400 dark:hover:text-white transition-all shrink-0"
                    >
                      {canned}
                    </button>
                  ))}
                </div>
              </div>

              {/* Formulário de Envio */}
              <form
                onSubmit={handleSendReply}
                className="border-t border-slate-200 dark:border-chumbo-800 p-3.5 bg-slate-50 dark:bg-chumbo-900/60 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Escreva sua resposta ao cliente..."
                  disabled={isSending}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-600 dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white dark:focus:border-laser-400 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || isSending}
                  className="flex h-11 items-center gap-2 rounded-xl bg-cyan-600 px-5 text-xs font-extrabold text-white transition-all hover:bg-cyan-500 disabled:opacity-40 dark:bg-laser-400 dark:text-chumbo-950 dark:hover:bg-laser-300 shrink-0 shadow-md"
                >
                  <span>{isSending ? 'Enviando...' : 'Enviar'}</span>
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <MessageSquare className="h-12 w-12 text-slate-400 stroke-[1.2] mb-3" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Nenhuma conversa selecionada
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Selecione uma conversa na lista ao lado para ver o histórico e responder às dúvidas dos clientes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
