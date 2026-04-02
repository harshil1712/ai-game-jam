# Chat UX Improvements — Implementation Plan

## Goal

Fix the chat UX so that message parts render in their natural stream order (not grouped by type), add reasoning/thinking part rendering, add tool error state handling, and remove the unnecessary thinking indicator.

## Background

The AI SDK appends parts to `message.parts[]` in **stream order**. A typical multi-step agent response looks like:

```
parts[0]: { type: "text", text: "Let me build that for you!" }
parts[1]: { type: "tool-generateGame", state: "output-available", ... }
parts[2]: { type: "step-start" }
parts[3]: { type: "text", text: "Your game is live!" }
```

The current `chat.tsx` renders parts **grouped by type** — all tool parts first, then all text parts. This means the initial text message (`parts[0]`) gets pushed below the tool call UI and appears out of order or invisible until streaming ends.

## Files to Modify

| File                              | Changes                                                             |
| --------------------------------- | ------------------------------------------------------------------- |
| `src/routes/_authed/chat.tsx`     | Update imports, delete `showThinking`, replace parts rendering loop |
| `src/components/ToolPartView.tsx` | Update imports, add `output-error` state                            |

**No new files. No backend changes. No dependency changes.**

---

## File 1: `src/routes/_authed/chat.tsx`

### Change A: Update imports

Add `BrainIcon` and `CaretDownIcon` to the existing `@phosphor-icons/react` import block:

```tsx
import {
  PaperPlaneRightIcon,
  StopIcon,
  TrashIcon,
  ArrowSquareOutIcon,
  CopyIcon,
  CheckIcon,
  GearIcon,
  BrainIcon,
  CaretDownIcon
} from "@phosphor-icons/react";
```

### Change B: Delete `showThinking`

Remove these lines entirely (currently around line 94):

```tsx
// DELETE THIS BLOCK:
const showThinking =
  isStreaming &&
  messages.length > 0 &&
  messages[messages.length - 1].role === "user";
```

The thinking indicator is unnecessary because:

- When the agent sends text before a tool call, that text now renders immediately in correct order
- When the agent calls a tool without text first, the `ToolPartView` shows "BUILDING..." immediately
- The brief submitted-but-no-content window is handled well enough by the disabled input + stop button

### Change C: Replace the message parts rendering loop

Find the block that starts with `<div className="space-y-4 font-mono">` and contains:

1. `messages.map(...)` with two separate filtered loops (one for `isToolUIPart`, one for `part.type === "text"`)
2. `{showThinking && ( ... )}` block
3. `<div ref={messagesEndRef} />`

Replace the entire `<div className="space-y-4 font-mono">` block with:

```tsx
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
            return <ToolPartView key={part.toolCallId} part={part} />;
          }

          // Reasoning parts
          if (part.type === "reasoning") {
            const reasoning = part as {
              type: "reasoning";
              text: string;
              state?: "streaming" | "done";
            };
            if (!reasoning.text?.trim()) return null;
            const isDone = reasoning.state === "done" || !isStreaming;

            return (
              <div key={`reasoning-${i}`} className="flex justify-start">
                <details className="max-w-[80%] w-full group" open={!isDone}>
                  <summary className="flex items-center gap-2 cursor-pointer px-3 py-2 border-l-2 border-purple-500 bg-purple-500/10 text-xs font-mono uppercase select-none list-none [&::-webkit-details-marker]:hidden">
                    <BrainIcon size={14} className="text-purple-400" />
                    <span className="text-purple-300 font-bold">REASONING</span>
                    {isDone ? (
                      <span className="text-purple-500">COMPLETE</span>
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
                  <pre className="mt-0 px-3 py-2 border-l-2 border-purple-500/50 bg-bg-charcoal text-xs text-slate-400 whitespace-pre-wrap overflow-auto max-h-64">
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
                <div key={`text-${i}`} className="flex justify-start">
                  <div className="max-w-[80%] px-0 py-1 text-white font-mono leading-relaxed">
                    <span className="text-cf-orange mr-2">{">"}</span>
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
```

Key differences from the current code:

- **Single `message.parts.map()` loop** instead of two filtered loops — preserves stream order
- **Reasoning parts** rendered as collapsible `<details>` between tool and text parts, styled in purple to differentiate from the orange cyberpunk theme
- **`showThinking` block removed** entirely (no "Processing..." indicator)
- **Keys**: use `part.toolCallId` for tools, `text-${i}` / `reasoning-${i}` for others (stable within a message)
- The `GearIcon` import can be removed if it is no longer used elsewhere in the file (it was only used in the `showThinking` block)

---

## File 2: `src/components/ToolPartView.tsx`

### Change D: Update imports

Add `WarningCircleIcon` to the existing `@phosphor-icons/react` import:

```tsx
import {
  RocketLaunchIcon,
  CheckCircleIcon,
  GearIcon,
  WarningCircleIcon
} from "@phosphor-icons/react";
```

### Change E: Add `output-error` state

After the `output-available` block and before the final `return null`, insert:

```tsx
if (part.state === "output-error") {
  const errorText =
    "errorText" in part
      ? (part as { errorText: string }).errorText
      : "Unknown error";
  return (
    <div className="flex justify-start">
      <CyberSurface className="max-w-[80%] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <WarningCircleIcon size={14} className="text-red-500" />
          <span className="text-xs font-bold text-red-400 font-mono uppercase">
            [{displayName}] ERROR
          </span>
          <Badge
            variant="secondary"
            className="rounded-none border border-red-500 text-red-400 bg-black font-mono text-[10px]"
          >
            FAIL
          </Badge>
        </div>
        <p className="text-xs text-red-400/70 font-mono mt-1 truncate">
          {errorText}
        </p>
      </CyberSurface>
    </div>
  );
}
```

---

## How to Verify

1. Run `npx wrangler dev` to start the dev server
2. Send a message like "Build me a Snake game"
3. Verify:
   - The agent's initial text message appears **before** the tool call indicator, as soon as it starts streaming
   - Tool call states transition correctly: `BUILDING GENERATE_GAME...` → `DEPLOYING ARCHIVE...` → `[ARCHIVE DEPLOYED] OK`
   - The agent's follow-up text appears **after** the tool call completes
   - No "Processing..." indicator appears at any point
4. If the model produces reasoning parts, verify they render as a collapsible purple `<details>` section that opens while thinking and closes when complete
5. Check that existing persisted chat history renders correctly (parts render in natural order, no visual regression)
