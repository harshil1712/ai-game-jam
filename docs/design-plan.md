# AI Game Jam - Redesign Plan

## Theme: Retro-Futuristic Cyber Console

### Overview

The application will be redesigned to resemble an industrial, high-tech terminal from an 80s sci-fi movie or an old-school arcade development kit. This moves the aesthetic away from generic AI tools and leans into the "Game Jam" aspect, making the creation tool feel like a game artifact itself.

### Key Visual Elements

- **Color Palette:**
  - Backgrounds: Deep, crushing blacks (`#050505`) and dark charcoal (`#111`).
  - Accents/Glows: High-contrast Electric Cyan (`#00f0ff`), Phosphor Green (`#39ff14`), or Hot Magenta (`#ff00ff`).
  - Text: Bright white (`#ffffff`) for primary text, dim gray (`#666666`) for secondary/terminal text.
- **Typography:**
  - Headings/Branding/UI: `Chakra Petch` (Google Fonts) - a square, technical sans-serif.
  - Code/Chat/Input: `Space Mono` or `JetBrains Mono` (Google Fonts) - a strict, mechanical monospace font.
- **Shapes & Borders:**
  - No soft rounded corners.
  - Sharp angles, stark solid borders (`1px` or `2px` solid).
  - Brutalist offset shadows (e.g., `4px 4px 0px var(--accent-color)`).
  - Use of `clip-path` for chamfered (cut-off) corners on specific UI elements.
- **Textures & Effects:**
  - Global CRT scanline overlay (subtle, pointer-events-none).
  - Glowing text effects (CSS `text-shadow`).
  - Box glows for active states (CSS `box-shadow`).
  - Blinking cursor effects for inputs.

---

### File-by-File Implementation Details

#### 1. Global Setup (`index.html` & `src/styles.css`)

- **`index.html`:**
  - Add Google Fonts links for `Chakra Petch` and `Space Mono` in the `<head>`.
- **`src/styles.css`:**
  - Define global CSS variables for the color palette (`--bg-color`, `--accent-cyan`, `--accent-magenta`, etc.).
  - Apply base typography (set body font to `Space Mono`).
  - Create utility classes for the CRT overlay effect (using a repeating linear-gradient background).
  - Override Kumo component variables if necessary to force sharp corners and specific colors.

#### 2. Root Layout (`src/routes/__root.tsx`)

- **Structure:**
  - Ensure the main wrapper has the global CRT overlay class applied.
  - Set the background color to the deep black defined in CSS variables.

#### 3. Login Page (`src/routes/index.tsx`)

- **Background:**
  - Replace the `bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900` with a solid black background (`bg-black`).
  - Add a CSS grid pattern background to simulate a perspective floor or wireframe environment.
- **Form Card (`Surface`):**
  - Remove `rounded-2xl` and `shadow-2xl`.
  - Apply a thick, brightly colored border (e.g., cyan) with a hard offset box-shadow.
  - Apply sharp corners (`rounded-none`).
- **Typography:**
  - Update heading to use `Chakra Petch`.
  - Make labels uppercase and monospace.
- **Inputs & Buttons:**
  - Style inputs to resemble raw terminal prompts (monospaced text, solid borders, no rounded corners).
  - Make the "Start Building" button a high-contrast block that inverts colors on hover (e.g., black text on cyan background, swapping on hover).

#### 4. Chat & Game Builder (`src/routes/_authed/chat.tsx`)

- **Header:**
  - Redesign as a "System Status" bar.
  - Sharp borders (bottom border only), uppercase monospaced text.
  - The connection indicator (`CircleIcon`) should look like a glowing hardware LED.
- **Chat Feed:**
  - Remove standard "chat bubbles" (remove background colors like `bg-purple-600` and `bg-slate-800`).
  - **User Messages:** Style as stark command inputs, perhaps prefixed with a `>` character, aligned left or indented slightly.
  - **Assistant Messages:** Style as system readouts. Use a left-border accent (e.g., a cyan line) rather than a full background bubble to separate them visually.
- **Tool Rendering (`ToolPartView`):**
  - Update the `Surface` components used for tool states (Thinking, Running, Done) to match the brutalist style (sharp corners, thin borders, monospace text).
- **Input Area:**
  - Transform the floating input pill into a full-width terminal command line fixed to the bottom.
  - Remove rounded corners.
  - Add a blinking block cursor effect if possible, or just style the input text to look like a terminal.
- **Game Preview Panel:**
  - Wrap the `iframe` in a thick "arcade cabinet" bezel or an industrial monitor frame (e.g., using `border-[16px] border-slate-800` with an inner shadow).
  - This visually separates the code/chat "development" world from the playable "game" world.

#### 5. Gallery (`src/routes/_authed/gallery.tsx`)

- **Header:**
  - Match the "System Status" bar style from the Chat view.
- **Game Cards (`Surface`):**
  - Style as "data cartridges" or "files".
  - Use CSS `clip-path` to create chamfered (angled) corners on one or more sides.
  - Apply stark borders and brutalist offset shadows.
- **Typography:**
  - Ensure titles (`Chakra Petch`) and creator names (`Space Mono`) look like catalog entries in a database.
- **Interactions:**
  - Redesign the Upvote button to look like a physical hardware toggle or a glowing digital counter that snaps sharply when clicked (invert colors on active state).
  - The "Play" button should follow the same brutalist button styling as the Login page.

### Summary of Component Replacements/Overrides

Since the app uses `@cloudflare/kumo` components (`Button`, `Input`, `Surface`, `Badge`), we will need to heavily override their default Tailwind classes (which lean towards rounded corners and soft shadows) using the `className` prop to enforce the sharp, high-contrast brutalist aesthetic.

- `Surface` -> `rounded-none border-2 border-cyan-500 shadow-[4px_4px_0px_#00f0ff]` (example)
- `Button` -> `rounded-none border-2 border-current hover:bg-current hover:text-black uppercase font-bold tracking-wider`
- `Input` -> `rounded-none border-2 border-slate-700 focus:border-cyan-500 bg-black font-mono`
- `Badge` -> `rounded-none border border-current font-mono uppercase text-[10px]`
