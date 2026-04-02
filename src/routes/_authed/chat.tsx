import { createFileRoute, Link } from "@tanstack/react-router";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { InputArea } from "@cloudflare/kumo";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import {
  PaperPlaneRightIcon,
  StopIcon,
  TrashIcon,
  ArrowSquareOutIcon,
  CopyIcon,
  CheckIcon,
  BrainIcon,
  CaretDownIcon,
} from "@phosphor-icons/react";
import { isToolUIPart } from "ai";
import type { ChatAgent } from "../../server";
import { ToolPartView } from "../../components/ToolPartView";
import { AppHeader } from "../../components/AppHeader";
import { CyberButton } from "../../components/CyberButton";
import { useGameUrl } from "../../hooks/useGameUrl";

export const Route = createFileRoute("/_authed/chat")({
  component: ChatPage,
});

function ChatPage() {
  const { user } = Route.useRouteContext();
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const agent = useAgent<ChatAgent>({
    agent: "ChatAgent",
    name: `user_${user?.id}`,
    onOpen: () => setConnected(true),
    onClose: () => setConnected(false),
  });

  const { messages, sendMessage, clearHistory, stop, status } = useAgentChat({
    agent,
  });

  const gameUrl = useGameUrl(messages);
  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");

    sendMessage({
      role: "user",
      parts: [{ type: "text", text }],
    });

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, isStreaming, sendMessage]);

  const copyGameUrl = async () => {
    if (gameUrl) {
      await navigator.clipboard.writeText(
        `${window.location.origin}${gameUrl}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const suggestedPrompts = [
    "Build me a Snake game",
    "Make a quiz about Cloudflare",
    "Create a drawing canvas",
    "Build a memory match game",
    "Make a bouncing balls simulation",
  ];

  return (
    <div className="flex flex-col h-screen bg-bg-deep">
      <AppHeader
        title="AI GAME JAM"
        actions={
          <>
            <Link to="/gallery">
              <CyberButton variant="secondary" size="sm">
                ARCHIVE
              </CyberButton>
            </Link>
            <CyberButton
              cyber="ghost"
              variant="secondary"
              size="sm"
              icon={<TrashIcon size={14} />}
              onClick={clearHistory}
            >
              CLEAR
            </CyberButton>
          </>
        }
      />

      <div className="flex-1 flex overflow-hidden max-w-6xl mx-auto w-full">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto px-5 py-6">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-20 h-20 border-2 border-cf-orange shadow-brutalist-cyan bg-bg-charcoal mb-6">
                  <span className="text-3xl text-cf-orange font-mono">
                    {">"}_
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mb-2 font-display tracking-wider uppercase text-glow-cyan">
                  INITIALIZE BUILD
                </h2>
                <p className="text-cf-light-gray mb-6 font-mono text-sm uppercase tracking-wide">
                  Enter command sequence for game generation
                </p>
                <div className="flex flex-wrap justify-center gap-3 max-w-lg mx-auto">
                  {suggestedPrompts.map((prompt) => (
                    <CyberButton
                      key={prompt}
                      size="sm"
                      disabled={isStreaming}
                      onClick={() =>
                        sendMessage({
                          role: "user",
                          parts: [{ type: "text", text: prompt }],
                        })
                      }
                      className="tracking-wide"
                    >
                      {prompt.toUpperCase()}
                    </CyberButton>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4 font-mono">
              {messages.map((message, index) => {
                const isUser = message.role === "user";
                const isLastAssistant =
                  message.role === "assistant" && index === messages.length - 1;

                return (
                  <div key={message.id} className="space-y-2">
                    {message.parts.map((part, i) => {
                      // Tool invocation parts
                      if (isToolUIPart(part)) {
                        return (
                          <ToolPartView key={part.toolCallId} part={part} />
                        );
                      }

                      // Reasoning parts
                      if (part.type === "reasoning") {
                        const reasoning = part as {
                          type: "reasoning";
                          text: string;
                          state?: "streaming" | "done";
                        };
                        if (!reasoning.text?.trim()) return null;
                        const isDone =
                          reasoning.state === "done" || !isStreaming;

                        return (
                          <div
                            key={`reasoning-${i}`}
                            className="flex justify-start"
                          >
                            <details
                              className="max-w-[80%] w-full group"
                              open={!isDone}
                            >
                              <summary className="flex items-center gap-2 cursor-pointer px-3 py-2 border-l-2 border-purple-500 bg-purple-500/10 text-xs font-mono uppercase select-none list-none [&::-webkit-details-marker]:hidden">
                                <BrainIcon
                                  size={14}
                                  className="text-purple-400"
                                />
                                <span className="text-purple-300 font-bold">
                                  REASONING
                                </span>
                                {isDone ? (
                                  <span className="text-purple-500">
                                    COMPLETE
                                  </span>
                                ) : (
                                  <span className="text-purple-300 animate-pulse">
                                    THINKING...
                                  </span>
                                )}
                                <CaretDownIcon
                                  size={12}
                                  className="ml-auto text-purple-500 transition-transform group-open:rotate-180"
                                />
                              </summary>
                              <pre className="mt-0 px-3 py-2 border-l-2 border-purple-500/50 bg-bg-charcoal text-sm text-slate-400 whitespace-pre-wrap overflow-auto max-h-64">
                                {reasoning.text}
                              </pre>
                            </details>
                          </div>
                        );
                      }

                      // Text parts
                      if (part.type === "text") {
                        const text = (part as { text: string }).text;
                        if (!text) return null;

                        if (isUser) {
                          return (
                            <div
                              key={`text-${i}`}
                              className="flex justify-start"
                            >
                              <div className="max-w-[80%] px-0 py-1 text-white font-mono leading-relaxed">
                                <span className="text-cf-orange mr-2">
                                  {">"}
                                </span>
                                {text}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={`text-${i}`} className="flex justify-start">
                            <div className="max-w-[80%] border-l-2 border-cf-orange bg-bg-charcoal text-slate-200 leading-relaxed">
                              <Streamdown
                                className="sd-theme p-3"
                                plugins={{ code }}
                                controls={false}
                                isAnimating={isLastAssistant && isStreaming}
                              >
                                {text}
                              </Streamdown>
                            </div>
                          </div>
                        );
                      }

                      // step-start, source, file, etc. — skip
                      return null;
                    })}
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-cf-dark-gray bg-bg-charcoal p-4">
            <div className="flex items-end gap-3 border-t-2 border-cf-mid-gray bg-black p-4">
              <span className="text-cf-orange font-mono text-lg">{">"}</span>
              <InputArea
                ref={textareaRef}
                value={input}
                onValueChange={setInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
                placeholder="ENTER_COMMAND_SEQUENCE..."
                disabled={!connected || isStreaming}
                rows={1}
                className="flex-1 ring-0! focus:ring-0! shadow-none! bg-transparent! outline-none! resize-none max-h-40 text-white font-mono placeholder:text-cf-mid-gray uppercase"
              />
              {isStreaming ? (
                <CyberButton
                  cyber="danger"
                  type="button"
                  variant="secondary"
                  shape="square"
                  icon={<StopIcon size={18} />}
                  onClick={stop}
                  aria-label="Stop generation"
                />
              ) : (
                <CyberButton
                  type="button"
                  variant="primary"
                  shape="square"
                  disabled={!input.trim() || !connected}
                  icon={<PaperPlaneRightIcon size={18} />}
                  onClick={send}
                  className="border-cf-orange text-cf-orange hover:bg-cf-orange hover:text-black disabled:border-cf-mid-gray disabled:text-cf-mid-gray"
                  aria-label="Send message"
                />
              )}
            </div>
          </div>
        </div>

        {gameUrl && (
          <div className="w-96 border-l-2 border-cf-mid-gray bg-bg-charcoal p-4 hidden lg:flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b-2 border-cf-mid-gray pb-2">
              <h3 className="font-bold text-white font-display tracking-wider uppercase text-sm text-glow-cyan">
                PREVIEW_UNIT
              </h3>
              <div className="flex gap-2">
                <CyberButton
                  cyber="secondary"
                  size="sm"
                  icon={
                    copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />
                  }
                  onClick={copyGameUrl}
                >
                  {copied ? "COPIED" : "COPY"}
                </CyberButton>
                <a href={gameUrl} target="_blank" rel="noopener noreferrer">
                  <CyberButton
                    size="sm"
                    icon={<ArrowSquareOutIcon size={14} />}
                  >
                    OPEN
                  </CyberButton>
                </a>
              </div>
            </div>
            <div className="flex-1 border-16 border-cf-dark-gray shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] bg-black overflow-hidden">
              <iframe
                src={gameUrl}
                className="w-full h-full border-0"
                sandbox="allow-scripts"
                title="Game Preview"
              />
            </div>
            <div className="mt-2 flex justify-between items-center">
              <span className="text-[10px] text-cf-light-gray font-mono uppercase">
                Status: RUNNING
              </span>
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-cf-orange box-glow-green"></div>
                <div className="w-2 h-2 bg-cf-orange box-glow-green"></div>
                <div className="w-2 h-2 bg-cf-mid-gray"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {gameUrl && (
        <a
          href={gameUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="lg:hidden fixed bottom-20 right-4 z-50"
        >
          <CyberButton
            variant="primary"
            size="lg"
            icon={<ArrowSquareOutIcon size={20} />}
            className="shadow-brutalist-cyan"
          >
            LAUNCH
          </CyberButton>
        </a>
      )}
    </div>
  );
}
