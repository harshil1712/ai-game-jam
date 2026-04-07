# Implementation Plan: Inline Responsive Game Preview in Chat

## Overview

Move the game preview from a separate right-side panel into the chat message flow itself. The preview renders inline after the `[ARCHIVE DEPLOYED]` tool result. Only the **latest** game gets a live iframe — older ones show a compact badge with an OPEN link. The layout is fully responsive so mobile users can interact with the game directly in chat.

---

## Files to Change

### 1. `src/components/ToolPartView.tsx` — Major rewrite of `output-available` for `generateGame`

#### New prop

Add `isLatestGame: boolean` to the component's props:

```ts
export function ToolPartView({
  part,
  isLatestGame,
}: {
  part: UIMessage["parts"][number];
  isLatestGame?: boolean;
})
```

#### New local state

Add `copied` state for the copy-to-clipboard button (only needed in the latest game preview):

```ts
const [copied, setCopied] = useState(false);
```

#### New imports

Add to the existing imports:

```ts
import { useState } from "react";
import {
  CopyIcon,
  CheckIcon,
  ArrowSquareOutIcon,
  // ... keep existing imports
} from "@phosphor-icons/react";
import { getToolName } from "ai"; // already imported
import { CyberButton } from "./CyberButton";
```

Note: `CyberButton` is not currently imported in `ToolPartView.tsx` — add it.

#### Updated `output-available` block for `generateGame`

Replace the current compact `output-available` render for `isGame === true` with the following logic:

**Extract the game URL from the tool output:**

```ts
const output = (part as { output?: { url?: string } }).output;
const gameUrl = output?.url ?? null;
```

**If `isLatestGame` is true:** Render the full inline preview:

```tsx
<div className="flex justify-start w-full">
  <div className="w-full">
    {/* Deployed badge row */}
    <div className="flex items-center gap-2 mb-3">
      <CheckCircleIcon size={14} className="text-cf-orange-light" />
      <span className="text-sm font-bold text-cf-orange-light font-mono uppercase">
        [ARCHIVE DEPLOYED]
      </span>
      <Badge
        variant="secondary"
        className="rounded-none border border-cf-orange-light text-cf-orange-light bg-black font-mono text-[10px]"
      >
        OK
      </Badge>
    </div>

    {/* Preview block */}
    <div className="border-2 border-cf-mid-gray bg-bg-charcoal">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b-2 border-cf-mid-gray">
        <h3 className="font-bold text-white font-display tracking-wider uppercase text-xs text-glow-cyan">
          PREVIEW_UNIT
        </h3>
        <div className="flex gap-2">
          {gameUrl && (
            <CyberButton
              cyber="secondary"
              size="sm"
              icon={copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
              onClick={async () => {
                await navigator.clipboard.writeText(
                  `${window.location.origin}${gameUrl}`
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "COPIED" : "COPY"}
            </CyberButton>
          )}
          {gameUrl && (
            <a href={gameUrl} target="_blank" rel="noopener noreferrer">
              <CyberButton size="sm" icon={<ArrowSquareOutIcon size={14} />}>
                OPEN
              </CyberButton>
            </a>
          )}
        </div>
      </div>

      {/* Iframe container — responsive with CRT border */}
      <div className="p-2 sm:p-3 bg-bg-charcoal">
        <div className="border-8 sm:border-[12px] border-cf-dark-gray shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] bg-black overflow-hidden aspect-[4/3] w-full">
          {gameUrl ? (
            <iframe
              src={gameUrl}
              className="w-full h-full border-0"
              sandbox="allow-scripts"
              title="Game Preview"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-cf-mid-gray font-mono text-xs uppercase">
              No preview available
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="px-3 py-2 border-t border-cf-dark-gray flex justify-between items-center">
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
  </div>
</div>
```

**If `isLatestGame` is false (older game version):** Render a compact row — same as the current badge but with an OPEN link appended:

```tsx
<div className="flex justify-start">
  <CyberSurface className="max-w-[80%] px-4 py-2.5">
    <div className="flex items-center gap-2 flex-wrap">
      <CheckCircleIcon size={14} className="text-cf-orange-light" />
      <span className="text-sm font-bold text-cf-orange-light font-mono uppercase">
        [ARCHIVE DEPLOYED]
      </span>
      <Badge
        variant="secondary"
        className="rounded-none border border-cf-orange-light text-cf-orange-light bg-black font-mono text-[10px]"
      >
        OK
      </Badge>
      {gameUrl && (
        <a href={gameUrl} target="_blank" rel="noopener noreferrer">
          <CyberButton size="sm" icon={<ArrowSquareOutIcon size={12} />}>
            OPEN
          </CyberButton>
        </a>
      )}
    </div>
  </CyberSurface>
</div>
```

#### Non-`generateGame` `output-available` — no change

The existing render for non-game tools (showing `[TOOLNAME]` with an OK badge) stays exactly as-is. The new prop `isLatestGame` is irrelevant for non-game tools and can be ignored.

---

### 2. `src/routes/_authed/chat.tsx` — Remove side panel, compute latest game ID

#### Remove these imports

```ts
// Remove — moving to ToolPartView:
import { CopyIcon, CheckIcon, ArrowSquareOutIcon } from "@phosphor-icons/react";

// Remove — hook is being deleted:
import { useGameUrl } from "../../hooks/useGameUrl";
```

Keep all other imports. Add `useMemo` and `getToolName` if not already imported:

```ts
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { isToolUIPart, getToolName } from "ai";
```

#### Remove these state variables and functions

Delete from `ChatPage`:

```ts
// DELETE:
const [copied, setCopied] = useState(false);

// DELETE:
const gameUrl = useGameUrl(messages);

// DELETE the entire copyGameUrl function:
const copyGameUrl = async () => { ... };
```

#### Add `latestGameToolCallId` computation

Add this after the `messages` / `isStreaming` declarations:

```ts
const latestGameToolCallId = useMemo(() => {
  let lastId: string | null = null;
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (
        isToolUIPart(part) &&
        getToolName(part) === "generateGame" &&
        part.state === "output-available"
      ) {
        lastId = part.toolCallId;
      }
    }
  }
  return lastId;
}, [messages]);
```

#### Update the `ToolPartView` call site

Currently:
```tsx
<ToolPartView key={part.toolCallId} part={part} />
```

Change to:
```tsx
<ToolPartView
  key={part.toolCallId}
  part={part}
  isLatestGame={part.toolCallId === latestGameToolCallId}
/>
```

#### Remove the right-side preview panel

Delete the entire block from line 318 to line 364 (the `{gameUrl && (<div className="w-96 border-l-2 ...">` block and its closing `})`).

#### Remove the mobile floating LAUNCH button

Delete the entire block from line 367 to line 383 (the `{gameUrl && (<a href={gameUrl} ...>` block).

#### Simplify the outer layout

Currently the outer content wrapper is:
```tsx
<div className="flex-1 flex overflow-hidden max-w-6xl mx-auto w-full">
  <div className="flex-1 flex flex-col min-w-0">
    ...
  </div>
  {/* right panel — deleted */}
</div>
```

After removing the right panel, the two divs are redundant. Collapse them to:

```tsx
<div className="flex-1 flex flex-col overflow-hidden max-w-3xl mx-auto w-full">
  ...
</div>
```

This keeps the chat column at a comfortable reading width (`max-w-3xl` = 768px) while allowing the inline game preview to fill the full column width.

---

### 3. `src/hooks/useGameUrl.ts` — Delete the file

This file is no longer referenced anywhere after the above changes. Delete it:

```
rm src/hooks/useGameUrl.ts
```

---

## Responsive Behavior Summary

| Breakpoint | iframe behavior |
|------------|----------------|
| Mobile (`< sm`, ~375px) | Full column width, `border-8` CRT border, `aspect-[4/3]` → ~251px tall |
| Mobile (`sm`, ~640px) | Full column width, `border-[12px]` CRT border, ~384px tall |
| Tablet/Desktop (`md`+, 768px+) | Capped at `max-w-3xl`, `border-[12px]` CRT border, ~576px tall |

All breakpoints are fully interactive — no "open in new tab" workaround needed.

---

## Verification Checklist

After implementing:

1. Build passes: `npx wrangler dev` starts without TypeScript errors
2. Chat page loads without errors
3. Sending a prompt that triggers `generateGame` shows:
   - The `[ARCHIVE DEPLOYED] [OK]` badge
   - The PREVIEW_UNIT header with COPY and OPEN buttons
   - A live playable game iframe below it
   - The status bar beneath the iframe
4. Sending a second prompt to update the game:
   - The new game shows the full live iframe
   - The previous game shows only the compact badge with an OPEN link
5. On mobile viewport (375px wide):
   - The iframe is visible, fills the chat column, and is interactive (touch events work because `sandbox="allow-scripts"` does not block pointer events)
   - No floating LAUNCH button appears
   - No right-side panel appears
6. COPY button copies the full URL (`window.location.origin + gameUrl`) and briefly shows "COPIED"
7. OPEN button opens the game in a new tab
8. The right-side panel no longer appears at any viewport width
9. `useGameUrl.ts` is deleted and no longer imported anywhere

---

## Notes for the Implementing Agent

- The `CyberButton` component is not currently imported in `ToolPartView.tsx` — import it from `"./CyberButton"`.
- The `isLatestGame` prop defaults to `undefined` (falsy) if not provided, so older integrations that don't pass the prop will render the compact "non-latest" view. Make the prop optional with `isLatestGame?: boolean`.
- The `aspect-[4/3]` Tailwind utility requires Tailwind v3.3+ or Tailwind v4 (already in use in this project).
- The `sandbox="allow-scripts"` attribute on the iframe stays unchanged — it allows JavaScript (needed for games) but blocks same-origin access, forms, popups, and top navigation. Touch/pointer events are not blocked by the sandbox.
- Do not change `src/server/agent.ts`, `src/server/routes.ts`, or any other server-side files.
- Do not change `src/components/AppHeader.tsx`, `src/components/GameCard.tsx`, or `src/routes/_authed/gallery.tsx`.
