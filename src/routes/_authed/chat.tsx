import { createFileRoute, Link } from "@tanstack/react-router";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button, InputArea, Badge, Surface } from "@cloudflare/kumo";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import {
  PaperPlaneRightIcon,
  StopIcon,
  TrashIcon,
  ChatCircleDotsIcon,
  CircleIcon,
  ArrowSquareOutIcon,
  CopyIcon,
  CheckIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  GearIcon
} from "@phosphor-icons/react";
import { isToolUIPart, getToolName, type UIMessage } from "ai";
import type { ChatAgent } from "../../server";

export const Route = createFileRoute("/_authed/chat")({
  component: ChatPage
});

// ── Tool rendering ────────────────────────────────────────────────────

function formatToolName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function ToolPartView({ part }: { part: UIMessage["parts"][number] }) {
  if (!isToolUIPart(part)) return null;
  const toolName = getToolName(part);
  const isGame = toolName === "generateGame";
  const displayName = isGame
    ? "GENERATE_GAME"
    : formatToolName(toolName).toUpperCase().replace(/ /g, "_");

  if (part.state === "input-streaming") {
    return (
      <div className="flex justify-start">
        <Surface className="max-w-[80%] px-4 py-2.5 rounded-none border border-[#3c3e40] bg-[#111] font-mono">
          <div className="flex items-center gap-2">
            <GearIcon size={14} className="text-[#f48120] animate-spin" />
            <span className="text-xs text-[#f48120] font-mono uppercase">
              {">"} BUILDING {displayName}...
            </span>
          </div>
        </Surface>
      </div>
    );
  }

  if (part.state === "input-available") {
    return (
      <div className="flex justify-start">
        <Surface className="max-w-[80%] px-4 py-2.5 rounded-none border border-[#3c3e40] bg-[#111] font-mono">
          <div className="flex items-center gap-2">
            {isGame ? (
              <RocketLaunchIcon
                size={14}
                className="text-[#d9650d] animate-pulse"
              />
            ) : (
              <GearIcon size={14} className="text-[#f48120] animate-spin" />
            )}
            <span className="text-xs text-[#f48120] font-mono uppercase">
              {isGame
                ? "{'>'} DEPLOYING ARCHIVE..."
                : `{'>'} EXECUTING ${displayName}...`}
            </span>
          </div>
        </Surface>
      </div>
    );
  }

  if (part.state === "output-available") {
    return (
      <div className="flex justify-start">
        <Surface className="max-w-[80%] px-4 py-2.5 rounded-none border border-[#3c3e40] bg-[#111] font-mono">
          <div className="flex items-center gap-2">
            {isGame ? (
              <CheckCircleIcon size={14} className="text-[#ffb020]" />
            ) : (
              <GearIcon size={14} className="text-[#f48120]" />
            )}
            <span className="text-xs font-bold text-[#ffb020] font-mono uppercase">
              {isGame ? "[ARCHIVE DEPLOYED]" : `[${displayName}]`}
            </span>
            <Badge
              variant="secondary"
              className="rounded-none border border-[#ffb020] text-[#ffb020] bg-black font-mono text-[10px]"
            >
              OK
            </Badge>
          </div>
        </Surface>
      </div>
    );
  }

  return null;
}

// ── Main chat ─────────────────────────────────────────────────────────

function ChatPage() {
  const { user } = Route.useRouteContext();
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [gameUrl, setGameUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const agent = useAgent<ChatAgent>({
    agent: "ChatAgent",
    name: `user_${user?.id}`,
    onOpen: () => setConnected(true),
    onClose: () => setConnected(false)
  });

  const { messages, sendMessage, clearHistory, stop, status } = useAgentChat({
    agent
  });

  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  // Extract game URL from tool output
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role === "assistant") {
        for (const part of msg.parts) {
          if (isToolUIPart(part) && part.state === "output-available") {
            const output = part.output as { url?: string } | undefined;
            if (output?.url) {
              setGameUrl(output.url);
            }
          }
        }
      }
    }
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");

    sendMessage({
      role: "user",
      parts: [{ type: "text", text }]
    });

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, isStreaming, sendMessage]);

  const copyGameUrl = async () => {
    if (gameUrl) {
      await navigator.clipboard.writeText(
        `${window.location.origin}${gameUrl}`
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
    "Make a bouncing balls simulation"
  ];

  const showThinking =
    isStreaming &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "user";

  return (
    <div className="flex flex-col h-screen bg-[#050505]">
      {/* Header - System Status Bar */}
      <header className="px-5 py-3 bg-[#111] border-b-2 border-[#f48120]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-white font-display text-glow-cyan tracking-widest uppercase">
              AI GAME JAM
            </h1>
            <Badge
              variant="secondary"
              className="rounded-none border border-[#8e8e8e] bg-black text-[#8e8e8e] font-mono text-[10px] uppercase"
            >
              <ChatCircleDotsIcon size={10} weight="bold" className="mr-1" />
              BUILDER_V1.0
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-mono text-xs uppercase">
              <CircleIcon
                size={8}
                weight="fill"
                className={
                  connected ? "text-[#f48120] box-glow-green" : "text-[#d9650d]"
                }
              />
              <span className={connected ? "text-[#f48120]" : "text-[#d9650d]"}>
                {connected ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <Link to="/gallery">
              <Button
                variant="secondary"
                size="sm"
                className="rounded-none border-2 border-[#3c3e40] bg-black text-[#f48120] hover:bg-[#f48120] hover:text-black hover:border-[#f48120] font-mono uppercase text-xs"
              >
                ARCHIVE
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              icon={<TrashIcon size={14} />}
              onClick={clearHistory}
              className="rounded-none border-2 border-[#3c3e40] bg-black text-[#8e8e8e] hover:text-[#d9650d] hover:border-[#d9650d] font-mono uppercase text-xs"
            >
              CLEAR
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden max-w-6xl mx-auto w-full">
        {/* Chat Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-6">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-20 h-20 border-2 border-[#f48120] shadow-brutalist-cyan bg-[#111] mb-6">
                  <span className="text-3xl text-[#f48120] font-mono">
                    {">"}_
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mb-2 font-display tracking-wider uppercase text-glow-cyan">
                  INITIALIZE BUILD
                </h2>
                <p className="text-[#8e8e8e] mb-6 font-mono text-sm uppercase tracking-wide">
                  Enter command sequence for game generation
                </p>
                <div className="flex flex-wrap justify-center gap-3 max-w-lg mx-auto">
                  {suggestedPrompts.map((prompt) => (
                    <Button
                      key={prompt}
                      variant="outline"
                      size="sm"
                      disabled={isStreaming}
                      onClick={() => {
                        sendMessage({
                          role: "user",
                          parts: [{ type: "text", text: prompt }]
                        });
                      }}
                      className="rounded-none border-2 border-[#3c3e40] bg-black text-[#f48120] hover:bg-[#f48120] hover:text-black hover:border-[#f48120] font-mono text-xs uppercase tracking-wide"
                    >
                      {prompt.toUpperCase()}
                    </Button>
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
                    {/* Tool parts */}
                    {message.parts.filter(isToolUIPart).map((part) => (
                      <ToolPartView key={part.toolCallId} part={part} />
                    ))}

                    {/* Text parts */}
                    {message.parts
                      .filter((part) => part.type === "text")
                      .map((part, i) => {
                        const text = (part as { text: string }).text;
                        if (!text) return null;

                        if (isUser) {
                          return (
                            <div key={i} className="flex justify-start">
                              <div className="max-w-[80%] px-0 py-1 text-white font-mono leading-relaxed">
                                <span className="text-[#f48120] mr-2">
                                  {">"}
                                </span>
                                {text}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={i} className="flex justify-start">
                            <div className="max-w-[80%] border-l-2 border-[#f48120] bg-[#111] text-slate-200 leading-relaxed">
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
                      })}
                  </div>
                );
              })}

              {/* Thinking indicator — shown while waiting for first assistant chunk */}
              {showThinking && (
                <div className="flex justify-start">
                  <Surface className="max-w-[80%] px-4 py-2.5 rounded-none border border-[#3c3e40] bg-[#111]">
                    <div className="flex items-center gap-2">
                      <GearIcon
                        size={14}
                        className="text-[#f48120] animate-spin"
                      />
                      <span className="text-xs text-[#f48120] font-mono uppercase">
                        Processing...
                      </span>
                    </div>
                  </Surface>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-[#1d1f20] bg-[#111] p-4">
            {/* Terminal Input Line */}
            <div className="flex items-end gap-3 border-t-2 border-[#3c3e40] bg-black p-4">
              <span className="text-[#f48120] font-mono text-lg">{">"}</span>
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
                className="flex-1 ring-0! focus:ring-0! shadow-none! bg-transparent! outline-none! resize-none max-h-40 text-white font-mono placeholder:text-[#3c3e40] uppercase"
              />
              {isStreaming ? (
                <Button
                  type="button"
                  variant="secondary"
                  shape="square"
                  icon={<StopIcon size={18} />}
                  onClick={stop}
                  className="rounded-none border-2 border-[#d9650d] bg-black text-[#d9650d] hover:bg-[#d9650d] hover:text-black"
                  aria-label="Stop generation"
                />
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  shape="square"
                  disabled={!input.trim() || !connected}
                  icon={<PaperPlaneRightIcon size={18} />}
                  onClick={send}
                  className="rounded-none border-2 border-[#f48120] bg-black text-[#f48120] hover:bg-[#f48120] hover:text-black disabled:border-[#3c3e40] disabled:text-[#3c3e40]"
                  aria-label="Send message"
                />
              )}
            </div>
          </div>
        </div>

        {/* Game Preview Panel - Arcade Cabinet Style */}
        {gameUrl && (
          <div className="w-96 border-l-2 border-[#3c3e40] bg-[#111] p-4 hidden lg:flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b-2 border-[#3c3e40] pb-2">
              <h3 className="font-bold text-white font-display tracking-wider uppercase text-sm text-glow-cyan">
                PREVIEW_UNIT
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={
                    copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />
                  }
                  onClick={copyGameUrl}
                  className="rounded-none border-2 border-[#3c3e40] bg-black text-[#8e8e8e] hover:text-[#f48120] hover:border-[#f48120] font-mono text-xs uppercase"
                >
                  {copied ? "COPIED" : "COPY"}
                </Button>
                <a href={gameUrl} target="_blank" rel="noopener noreferrer">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<ArrowSquareOutIcon size={14} />}
                    className="rounded-none border-2 border-[#3c3e40] bg-black text-[#f48120] hover:bg-[#f48120] hover:text-black hover:border-[#f48120] font-mono text-xs uppercase"
                  >
                    OPEN
                  </Button>
                </a>
              </div>
            </div>
            <div className="flex-1 border-[16px] border-[#1d1f20] shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] bg-black overflow-hidden">
              <iframe
                src={gameUrl}
                className="w-full h-full border-0"
                sandbox="allow-scripts"
                title="Game Preview"
              />
            </div>
            <div className="mt-2 flex justify-between items-center">
              <span className="text-[10px] text-[#8e8e8e] font-mono uppercase">
                Status: RUNNING
              </span>
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[#f48120] box-glow-green"></div>
                <div className="w-2 h-2 bg-[#f48120] box-glow-green"></div>
                <div className="w-2 h-2 bg-[#3c3e40]"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Game Button */}
      {gameUrl && (
        <a
          href={gameUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="lg:hidden fixed bottom-20 right-4 z-50"
        >
          <Button
            variant="primary"
            size="lg"
            icon={<ArrowSquareOutIcon size={20} />}
            className="rounded-none border-2 border-[#f48120] bg-black text-[#f48120] shadow-brutalist-cyan font-mono uppercase"
          >
            LAUNCH
          </Button>
        </a>
      )}
    </div>
  );
}
