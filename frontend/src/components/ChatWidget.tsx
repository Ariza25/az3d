import React, { useEffect, useRef, useState } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  Store,
  Clock,
  CheckCheck,
  Lock,
} from 'lucide-react';
import { Tenant, ChatMessage } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface ChatWidgetProps {
  activeTenant: Tenant | null;
  onOpenLogin: () => void;
}

const QUICK_QUESTIONS = [
  'Qual o prazo de produção?',
  'Fazem impressão em outras cores?',
  'Como envio meu arquivo 3D?',
  'Vocês entregam para minha cidade?',
];

export const ChatWidget: React.FC<ChatWidgetProps> = ({ activeTenant, onOpenLogin }) => {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<number | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    if (!activeTenant?.id || !isAuthenticated) return;
    try {
      const response = await api.getCustomerChatConversation(activeTenant.id);
      setMessages(response.messages || []);
      setUnreadCount(0);
      setError(null);
    } catch (err: any) {
      console.error('Erro ao carregar mensagens do chat:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Carrega ao abrir o chat
  useEffect(() => {
    if (isOpen && isAuthenticated && activeTenant?.id) {
      setIsLoading(true);
      void loadMessages();

      // Polling a cada 4 segundos com o chat aberto
      const interval = window.setInterval(() => {
        void loadMessages();
      }, 4000);
      pollingRef.current = interval;

      return () => {
        clearInterval(interval);
      };
    }
  }, [isOpen, isAuthenticated, activeTenant?.id]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleToggle = () => {
    if (!isAuthenticated) {
      onOpenLogin();
      return;
    }
    setIsOpen((prev) => !prev);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || !activeTenant?.id || isSending) return;

    setIsSending(true);
    setError(null);
    setInputText('');

    // Adiciona otimisticamente na UI
    const optimisticMsg: ChatMessage = {
      id: Date.now(),
      conversation_id: 0,
      tenant_id: activeTenant.id,
      sender_id: user?.id || 0,
      sender_type: 'customer',
      sender_name: user?.name || 'Você',
      message: text,
      read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const created = await api.sendCustomerChatMessage(activeTenant.id, text);
      // Substitui otimista com mensagem confirmada do servidor
      setMessages((prev) =>
        prev.map((msg) => (msg.id === optimisticMsg.id ? created : msg))
      );
    } catch (err: any) {
      setError(err.message || 'Não foi possível enviar a mensagem.');
      // Remove otimista se falhou
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMsg.id));
      setInputText(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    setInputText(question);
  };

  const storeTitle = activeTenant?.name || 'AZ3D Studio';

  return (
    <>
      {/* Botão Flutuante (quando fechado) */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 animate-in fade-in zoom-in-95 duration-200">
          <button
            type="button"
            onClick={handleToggle}
            className="group flex items-center gap-3 rounded-full border border-laser-400/40 bg-chumbo-950/95 py-3 px-5 text-white shadow-2xl backdrop-blur-md transition-all hover:scale-105 hover:border-laser-400 hover:shadow-laser-500/20 active:scale-95"
            aria-label="Abrir chat online"
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-laser-400 text-chumbo-950 shadow-md">
              <MessageCircle className="h-5 w-5 stroke-[2.2]" />
              {/* Indicador de status online */}
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-chumbo-950 bg-emerald-500" />
              </span>
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Dúvidas? Fale conosco</span>
                <Sparkles className="h-3 w-3 text-laser-400" />
              </p>
              <p className="text-[10px] text-slate-400">Atendimento {storeTitle}</p>
            </div>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-laser-400 px-1.5 text-[10px] font-extrabold text-chumbo-950 shadow">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Janela de Chat Aberta */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[540px] max-h-[85vh] w-[92vw] max-w-[390px] flex-col overflow-hidden rounded-3xl border border-chumbo-700/90 bg-chumbo-950 shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-5 duration-200 sm:bottom-6 sm:right-6">
          {/* Header do Chat */}
          <div className="flex items-center justify-between border-b border-chumbo-800 bg-gradient-to-r from-chumbo-900 via-chumbo-900/90 to-chumbo-950 p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-laser-400/15 border border-laser-500/30 text-laser-400">
                <Store className="h-5 w-5" />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                  <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-chumbo-950 bg-emerald-500" />
                </span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white truncate max-w-[180px]">
                  {storeTitle}
                </h3>
                <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span>Atendimento Online</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-chumbo-800 hover:text-white transition-colors"
                aria-label="Fechar chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Área de Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
            {/* Mensagem de boas-vindas do tenant */}
            <div className="flex flex-col items-start gap-1 max-w-[85%]">
              <div className="rounded-2xl rounded-tl-none bg-chumbo-900 border border-chumbo-800 p-3 text-xs leading-relaxed text-slate-200 shadow-sm">
                <p>
                  Olá{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! Bem-vindo ao suporte de <strong>{storeTitle}</strong>.
                </p>
                <p className="mt-1.5 text-slate-300">
                  Tem alguma dúvida sobre materiais, impressão 3D, prazos de entrega ou orçamento personalizado? Envie sua mensagem abaixo!
                </p>
              </div>
              <span className="text-[10px] text-slate-500 ml-1">Mensagem automática</span>
            </div>

            {/* Histórico de Mensagens */}
            {messages.map((msg) => {
              const isMe = msg.sender_type === 'customer';
              const timeStr = msg.created_at
                ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 max-w-[85%] ${
                    isMe ? 'ml-auto items-end' : 'mr-auto items-start'
                  }`}
                >
                  <div
                    className={`rounded-2xl p-3 text-xs leading-relaxed shadow-md ${
                      isMe
                        ? 'rounded-tr-none bg-laser-400 text-chumbo-950 font-medium'
                        : 'rounded-tl-none bg-chumbo-900 border border-chumbo-800 text-slate-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 px-1">
                    <span>{timeStr}</span>
                    {isMe && <CheckCheck className="h-3 w-3 text-laser-400" />}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center justify-center py-4 text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5 animate-spin mr-2 text-laser-400" />
                <span>Atualizando conversa...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Dúvidas Rápidas (Chips) */}
          {messages.length === 0 && (
            <div className="px-3 pb-2 pt-1 border-t border-chumbo-800/60 overflow-x-auto">
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-1.5 px-1">
                Sugestões rápidas:
              </p>
              <div className="flex gap-1.5 flex-nowrap pb-1">
                {QUICK_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickQuestion(q)}
                    className="whitespace-nowrap rounded-xl border border-chumbo-700/80 bg-chumbo-900/90 px-2.5 py-1 text-[11px] text-slate-300 hover:border-laser-400 hover:text-white transition-all shrink-0"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Erro se houver */}
          {error && (
            <div className="mx-3 mb-2 p-2 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-[11px]">
              {error}
            </div>
          )}

          {/* Input de Envio ou Alerta de Login */}
          {isAuthenticated ? (
            <form
              onSubmit={handleSendMessage}
              className="border-t border-chumbo-800 bg-chumbo-900/60 p-3 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Escreva sua dúvida aqui..."
                disabled={isSending}
                className="flex-1 rounded-xl bg-chumbo-950 border border-chumbo-700/90 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-laser-400 transition-colors"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-laser-400 text-chumbo-950 font-bold transition-all hover:bg-laser-300 disabled:opacity-40 disabled:hover:bg-laser-400 shrink-0 shadow-md"
                aria-label="Enviar mensagem"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="border-t border-chumbo-800 bg-chumbo-900/90 p-4 text-center">
              <p className="text-xs text-slate-300 mb-2.5">
                Faça login para conversar diretamente com a loja.
              </p>
              <button
                type="button"
                onClick={onOpenLogin}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-laser-400 py-2.5 text-xs font-extrabold text-chumbo-950 hover:bg-laser-300 transition-all shadow-md"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Entrar para enviar mensagem</span>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};
