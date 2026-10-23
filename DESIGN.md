# 1906.au — Current interface and design system

**Audience:** designers, product owners, developers and tools reproducing the interface.  
**Reviewed:** 23 October 2026, Australia/Melbourne.  
**Source baseline:** `8298d49099965898305a72af2a7005f8ba7a877c`, matching the production deployment.  
**Companion:** [PLATFORM.md](PLATFORM.md) explains architecture, data, AI, configuration and operations.

This is a description of the current deployed product, not a proposed redesign. The conventional filename `DESIGN.md` is used for the requested design document. It can be used as a brief for Figma, Google Stitch or another interface builder. Dimensions and behaviours below come from production browser inspection and the matching source; unobserved private and responsive states are labelled.

## Contents

1. [Summary for non-technical readers](#1-summary-for-non-technical-readers)
2. [Evidence and design character](#2-evidence-and-design-character)
3. [Colour system](#3-colour-system)
4. [Typography](#4-typography)
5. [Layout, spacing and responsive behaviour](#5-layout-spacing-and-responsive-behaviour)
6. [Component specifications](#6-component-specifications)
7. [Screens and user journeys](#7-screens-and-user-journeys)
8. [Interaction states and content rules](#8-interaction-states-and-content-rules)
9. [Accessibility and motion](#9-accessibility-and-motion)
10. [Reproduction brief for design tools](#10-reproduction-brief-for-design-tools)
11. [Implementation map and acceptance checks](#11-implementation-map-and-acceptance-checks)

## 1. Summary for non-technical readers

The interface should feel like a practical strategic workshop: warm cream backgrounds, bold black outlines, deep blue actions and clear conversational content. Large, tightly spaced headings create personality. Irregular rounded corners and small offset shadows give it a hand-drawn agency character without decorative illustrations.

The main desktop experience has a navigation sidebar on the left and a conversation workspace in the centre. **Buyer insights** opens a dark blue panel on the right. Persona creation and management reuse the same shell, fonts, colours and button styles.

The most important information is the buyer's message and the next decision being tested. Detailed assessment data belongs in expandable sections. The interface must distinguish illustrative demo responses from AI simulation, and a saved reply from analysis still in progress.

To reproduce the product, retain these five recognisable features:

1. Epilogue headings and Manrope body text.
2. Cream surfaces, charcoal outlines and a restrained blue palette.
3. A 288px desktop sidebar, chat workspace and optional 420px insights panel.
4. Rounded asymmetric cards/buttons and distinct left/right chat bubbles.
5. Plain-language buyer insights with visible uncertainty and assessment freshness.

## 2. Evidence and design character

### 2.1 What was inspected

The production site is [www.1906.au](https://www.1906.au/). It was opened through authorised temporary Vercel access because deployment authentication precedes the application. The following screens were inspected at **1363 × 936 CSS pixels**: demo persona landing, empty chat, completed demo exchange, open buyer insights, persona management, persona creation including emojis, and the private Studio unlock screen.

Production metadata confirmed the same commit as the inspected repository. Rendered DOM measurements confirmed the 288px sidebar, 88px chat header, 420px insights panel and Manrope body font family. CSS values below come from `src/index.css`, `tailwind.config.js` and the corresponding components.

Authenticated private history, paid generation and live post-reply assessments were not opened. Their layout and states are source-verified. Responsive rules and keyboard implementations were inspected in source; a mobile browser, physical device, screen reader and complete accessibility audit were not exercised. No private customer names, messages or secrets are part of this brief.

### 2.2 Design character

| Attribute               | Current expression                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------ |
| Warm                    | Cream canvas and off-white navigation/form surfaces                                  |
| Confident               | Heavy Epilogue display headings, tight tracking, strong charcoal borders             |
| Conversational          | Familiar chat alignment, buyer emoji, natural starter prompts                        |
| Workshop-like           | Marker-style outlines, asymmetric corners, offset shadows                            |
| Analytical              | Dark blue insights surface with progressive disclosure                               |
| Honest about simulation | Mode labels, readiness caveat, source links, previous/current assessment distinction |

The visible wordmark is styled text, **1906.au**, rather than a supplied logo image. It is italic, heavy, slightly rotated and followed by a pale blue **BETA** badge. The favicon is an inline blue line icon in `index.html`. No hero photography, image-generation assets, portrait library, video background or separate brand asset folder is required by this baseline.

Although Tailwind enables class-based dark mode, there is no exposed theme switch or complete alternate dark theme. The dark insights panel is part of the regular theme.

## 3. Colour system

### 3.1 Core tokens

These names are the actual Tailwind extension keys. CSS also uses their literal values.

| Token              | Hex       | Role                                                             |
| ------------------ | --------- | ---------------------------------------------------------------- |
| `brand-bg`         | `#f1efe7` | Main cream canvas and chat header                                |
| `brand-bg-light`   | `#faf9f6` | Sidebar, composer, persona cards and form surfaces               |
| `brand-text`       | `#1a1a1a` | Main copy, strong borders, user bubbles and insights toggle      |
| `brand-text-light` | `#333333` | Configured secondary dark text token                             |
| `brand-neutral`    | `#bfbfbf` | Configured neutral token                                         |
| `brand-primary`    | `#01537e` | Primary action blue, selected states, links and accents          |
| `brand-secondary`  | `#0271a3` | Primary hover and focus outline                                  |
| `brand-dark`       | `#013b5b` | Insights panel, AI draft box and profile avatar                  |
| `brand-pale`       | `#e1f3fa` | Selected cards/history, notes, badge and insights recommendation |
| White              | `#ffffff` | Buyer bubbles, input surfaces and primary button text            |

`brand-text-light` and `brand-neutral` are configured tokens, not replacements for every literal colour in the existing CSS. Preserve the observed surface/foreground combinations when reproducing a screen.

### 3.2 Supporting values

| Value                     | Use                                                          |
| ------------------------- | ------------------------------------------------------------ |
| `#666666`                 | Muted supporting copy on light surfaces                      |
| `#6a6963`                 | Small chat session label                                     |
| `#dcdad2`                 | Chat dots and light section dividers                         |
| `#bddbe8`                 | Muted text on dark panels                                    |
| `#79c2e2`                 | Score denominator and evidence-quote accent                  |
| `#a9dff3`                 | Score fill and focus outline on the dark panel               |
| `#ffe0b0`                 | Friction text and tentative-estimate caveat                  |
| `#dfb16b80` / `#dfb16b10` | Friction border / faint fill; eight-digit hex includes alpha |
| `#fff1d9` / `#733c00`     | Error banner background / text                               |
| `#ffd397`                 | Message failure text inside the dark user bubble             |
| `#0007`                   | Navigation and insights overlay backdrops                    |

Do not introduce a new bright colour for every stance or friction category. Current meaning comes from text, panel grouping and status labels. A green progress bar or traffic-light score system is not part of the implementation.

## 4. Typography

Fonts are requested from Google Fonts in `index.html`, with `display=swap`. Both use `sans-serif` fallbacks. The files are not self-hosted in this repository.

| Use                       | Family           | Current size and styling                                                       |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------ |
| Body                      | Manrope          | Root family; component-specific sizes, usually 12–14px for application content |
| Main headings             | Epilogue         | Strong weights, commonly 800 or 850; charcoal                                  |
| Text wordmark             | Epilogue         | 30px, italic 900, `letter-spacing: -2px`, rotation `-3deg`                     |
| Landing headline          | Epilogue         | `clamp(30px, 3.4vw, 48px)`, weight 850, line-height 1.15, tracking `-1.8px`    |
| Empty-chat headline       | Epilogue         | `clamp(32px, 4vw, 54px)`, weight 850, line-height 1.12, tracking `-2px`        |
| Chat header name          | Epilogue         | 16px, weight 850; 13px at ≤760px                                               |
| Persona editor title      | Epilogue         | 32px, weight 850, line-height 1.2, tracking `-1px`                             |
| Persona manager title     | Epilogue         | 28px, weight 850, tracking `-1px`                                              |
| Card titles               | Epilogue         | 16px, weight 800                                                               |
| Primary/secondary buttons | Epilogue         | 12px, weight 800                                                               |
| Eyebrows                  | Inherited family | 10px, weight 800, uppercase, tracking 1.6px                                    |
| Role in chat header       | Manrope          | 10px, uppercase, weight 800, tracking 1px; 8px on mobile                       |
| Chat messages             | Manrope          | 14px, line-height 1.75; whitespace preserved                                   |
| Message speaker           | Manrope          | 11px, weight 800, opacity 0.8                                                  |
| Insights stance           | Inherited family | 16px, weight 800, line-height 1.5                                              |
| Readiness score           | Epilogue         | Effective size 54px, weight 850, tracking `-4px`; `/100` is 26px               |
| Unavailable score         | Epilogue         | 24px, tracking `-1px`                                                          |
| Private unlock heading    | Epilogue         | 2.5rem; does not inherit the display headline's heavy weight rule              |
| Small metadata            | Manrope          | 9–11px depending on component                                                  |

The 54px score is the effective rule. Earlier CSS defines 72px and is overridden later. Similarly, the effective insights panel starts at the top of the workspace, not below the chat header. Reproduction should follow the final cascade.

Use the exact content hierarchy, not a single font size throughout. Existing small metadata and muted states need accessibility review before a future redesign; reproducing them does not establish that they meet every readability requirement.

## 5. Layout, spacing and responsive behaviour

### 5.1 Desktop shell

The root `.studio` fills `100dvh`, uses a horizontal flex layout and hides outer overflow. Major regions scroll internally. `.workspace` is flexible with `min-width: 0` and a vertical layout.

| Region            | Dimensions and placement                                                        | Surface/divider                              |
| ----------------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| Navigation        | 288px wide, full height, fixed flex basis                                       | Off-white sidebar; 3px charcoal right border |
| Brand area        | Minimum 88px height; horizontal padding 25px                                    | 3px bottom border                            |
| Sidebar actions   | Padding 28px 19px; 12px vertical gap                                            | Primary, secondary, then text action         |
| History           | Flexible scrollable area; horizontal padding 14px                               | Selected item pale blue with blue 1px border |
| Mode selector     | Padding 16px 20px near sidebar bottom                                           | Native select on white                       |
| User/usage footer | Padding 20px; 38px circular icon                                                | White; 3px top border                        |
| Chat header       | Minimum 88px; padding 18px 30px; 15px gap                                       | Cream; 3px bottom border                     |
| Chat stream       | Flexible, scrollable; 22px vertical padding                                     | Cream with dot grid                          |
| Composer          | Does not shrink; padding 22px 30px 15px                                         | Off-white; 3px top border                    |
| Insights          | Effective width `min(420px, 100%)`; absolute right, top 0, bottom 0; z-index 30 | Dark blue; 3px left border                   |

The chat's preferred content width is 860px. Horizontal stream padding is `max(24px, calc((100% - 860px) / 2))`; the composer inner and helper rows have `max-width: 860px` and are centred.

At viewport widths **1200px and above**, an open insights panel reserves 420px inside the workspace using `.workspace:has(> .telemetry)`. It sits beside the narrower chat rather than covering it. At the inspected 1363px width: navigation was 288px, workspace 1075px, chat header/composer 655px and insights 420px.

The private Studio adds a wrapping toolbar and target-decision/memory strips inside the workspace. It therefore need not align exactly with the demo's header geometry. Preserve its actual source order; do not assume a fixed global header offset.

### 5.2 Breakpoints

| Width      | Navigation                                                                | Insights                                                       | Other changes                                                |
| ---------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| ≥1200px    | 288px visible sidebar                                                     | 420px reserved side panel; non-modal aside                     | Full desktop spacing                                         |
| 761–1199px | Sidebar stays visible                                                     | Modal overlay within workspace; fixed backdrop covers the page | Focus trap and dismiss controls enabled                      |
| ≤760px     | Sidebar hidden until **Open navigation**; drawer width `min(300px, 90vw)` | Overlay up to 420px or available workspace width               | Compact header, single-column forms, smaller message padding |

The navigation drawer uses z-index 60 with a z-index 50 backdrop. The insights backdrop is z-index 25, below its panel. Both backdrops use `#0007`.

At ≤760px, the chat stream uses 18px padding, messages expand from 78% to 88% maximum width and use 14px padding, the composer uses an effective 12px 15px padding, and the header uses 16px padding with an 8px gap. Persona editor content uses 25px padding. Two-column profile fields become one column.

The header avatar is hidden on mobile, but avatars inside persona context and persona manager cards are explicitly shown. The role is limited to 150px, and the analytics control becomes more compact. Helper spans in the composer are hidden at this breakpoint; essential accessible labels still need to be retained.

### 5.3 Grids and spacing

| Area                    | Rule                                                                        |
| ----------------------- | --------------------------------------------------------------------------- |
| Landing content         | Padding `40px clamp(24px, 5vw, 80px)`; 25px on mobile                       |
| Landing cards           | `repeat(auto-fit, minmax(215px, 1fr))`; 20px gap; 35px vertical grid margin |
| Persona manager content | Max 1200px; padding `36px clamp(20px, 4vw, 48px)`                           |
| Manager card grid       | `repeat(auto-fit, minmax(min(100%, 320px), 1fr))`; 24px gap                 |
| Editor content          | Max 800px; centred; 40px padding, 25px on mobile                            |
| Profile field grid      | Two equal columns; 24px gap; one column on mobile                           |
| Profile sections        | 28px vertical padding; 2px `#dcdad2` top divider                            |
| Private intent form     | Max 720px; grid gap 1.2rem; vertical margin 1.5rem                          |
| Private unlock          | Max 560px; margin `10vh auto`; padding 2rem                                 |

The stylesheet uses several concrete spacings rather than a fully centralised spacing-token system. For a design-tool file, it is reasonable to organise the repeated values as spacing variables while preserving the values above. That organisation is a reproduction aid, not a claim that those variables already exist in code.

## 6. Component specifications

### 6.1 Borders, radii and shadows

| Component                    | Border              | Radius, clockwise from top-left | Shadow                         |
| ---------------------------- | ------------------- | ------------------------------- | ------------------------------ |
| Primary/secondary button     | 3px charcoal        | `24px 10px 20px 12px`           | Primary: `5px 5px 0 #01537e26` |
| Landing/manager persona card | 3px charcoal        | `20px 28px 14px 20px`           | `5px 5px 0 #01537e20`          |
| AI draft box                 | 3px charcoal        | `24px 30px 14px 24px`           | None specified                 |
| Persona context card         | 2px charcoal        | `16px 22px 12px 18px`           | None specified                 |
| User bubble                  | 2px charcoal        | `24px 24px 4px 24px`            | None specified                 |
| Buyer bubble                 | 2px charcoal        | `24px 24px 24px 4px`            | `3px 3px 0 #0000000a`          |
| Composer textarea            | 3px charcoal        | 18px uniform                    | None specified                 |
| Standard profile input       | 2px charcoal        | 10px uniform                    | None specified                 |
| Insights toggle              | 2px charcoal        | 10px uniform                    | None specified                 |
| Friction/recommendation box  | 2px semantic colour | 12px uniform                    | None specified                 |

`.marker-stroke` provides a 3px charcoal border; `.agency-shadow` provides `6px 6px 0 #01537e26`. Not every component uses those helper classes: many specify a related literal style.

### 6.2 Buttons, selects and fields

Primary and secondary actions use flex alignment, an 8px icon/text gap and 13px 15px padding. Primary is blue with white text; its hover becomes secondary blue and rises 1px. Secondary is white and hovers pale blue. Disabled buttons have opacity 0.5 and a not-allowed cursor. Default button transitions are background and transform over 0.18 seconds.

Text buttons use blue, 12px text and a 7px icon gap. The dark **Buyer insights** toggle uses white 11px bold text, a chart icon, 10px 13px padding and blue hover. The send control is an arrow icon in a blue bordered square with 10px radius, positioned inside the textarea at right 15px and bottom 14px.

The workspace mode control is a labelled native select, not a new settings page. Its options are **Demo · illustrative only** and **Private Studio · AI simulation**. Standard profile fields are white, padded 12px and labelled with 12px bold text. Private login and intent fields use a lighter 1px blue border, 6px radius and 0.8rem padding.

Budget sensitivity uses Low, Medium and High radio choices in bordered tiles. Creation methods and emoji choices expose selected/pressed state. A generation button is disabled in demo mode; private Studio is required for AI synthesis.

### 6.3 Persona cards and context

Landing cards contain an emoji, name, role, budget-sensitivity label and a small diagonal arrow. They use 24px padding; on hover they turn pale blue and rise 3px. Selecting one in demo starts a local conversation immediately.

Manager cards contain identity, industry where present, a clamped three-line background summary, **View profile**, **Start conversation**, **Edit**, **Duplicate**, and **Archive** or **Restore** according to availability. The primary conversation action spans the card width.

The reusable profile context component provides an expandable summary and detailed fields. In a chat it becomes a flat strip below the header, with 8px 30px padding, a light bottom divider and **View persona profile**. Expanded profile content is internally scrollable at a maximum 30vh. It represents the conversation's frozen persona, not a live view of later edits.

Emoji avatars have several sizes: header 46 × 46px with 3px border and 26px glyph; message avatar 30 × 30px with 2px border; user footer icon 38 × 38px on dark blue. Native emoji rendering varies by operating system. Preserve Unicode sequences rather than substituting portrait photos.

### 6.4 Emoji picker

The editor provides 22 predefined choices plus a custom emoji field. The picker wraps with a 0.4rem gap; buttons have minimum 2.5rem width/height, 1.3rem glyph size and 0.3rem padding. Selection uses a 2px primary-blue outline with 2px offset and a pressed-state attribute.

The standard choices are 🎯, 👩‍💼, 👨‍💼, 🧑‍💼, 👩‍⚕️, 👨‍⚕️, 🧑‍🏫, 🧑‍🔬, 🧑‍💻, 👩‍🎨, 🧑‍🚀, 💡, 📊, 🧠, 🚀, 🌱, 🦊, 🐨, 🌏, ⭐, 🤝 and 💬. The custom field accepts a single emoji grapheme. Helper copy explains that it is visual only and does not change behaviour.

### 6.5 Chat

The stream background is a radial `#dcdad2` 1px dot over cream, repeated every 20px in both directions. Message rows align at the bottom with a 10px gap and 24px bottom margin.

User bubbles align right with charcoal fill and off-white text. Buyer bubbles align left with white fill, dark text and a small emoji beside them. Both have maximum 78% width on desktop, 18px 20px padding, preserved line breaks and wrapping for long words. User delivery status is shown beneath content. Text is rendered as text; the current chat does not offer a rich Markdown renderer, attachments or code-block tools.

The composer uses a three-row textarea with 17px 65px 17px 18px padding so text does not collide with the send control. It has no drag-resize affordance. Helper copy gives the character count, mode-specific usage information and keyboard shortcuts. **Enter** sends; **Shift + Enter** inserts a newline; composition input is respected before deciding to send.

### 6.6 Buyer insights

The panel header has 24px padding, a radar icon, uppercase **Buyer insights**, and a close button. The scrollable body uses 25px padding, 20px section gaps, 13px text and line-height 1.7; mobile body padding is 20px.

Content order is intentional:

1. Freshness/status label and, in private mode, the next step being tested.
2. An update/retry box when the saved reply still needs assessment.
3. **Where they stand**.
4. **Decision readiness**, `/100`, explanatory copy and progress track.
5. **What’s holding them back?**, including remaining conditions where available.
6. **Supporting evidence**.
7. **How they’re responding**.
8. **What to explore next**, in a pale blue recommendation box.
9. Expandable **Assessment details** for underlying values, confidence, evidence and provisional guidance.

The score track is 5px high with a translucent white background and pale blue fill. An unavailable value displays **Not yet clear**, not zero. The warm friction box has an amber translucent border/fill; the recommendation uses pale blue with dark text.

Expanded evidence quotations use a 3px blue left rule and preserved whitespace. Source links navigate/focus the corresponding buyer message. Keep confidence explanations and the caveat **A simulation index for this next step, not a conversion probability.** The interface must not imply that a percentage or positive tone establishes real customer commitment.

## 7. Screens and user journeys

### 7.1 Screen inventory

| Screen                         | Main content and primary action                                                | Verification                                                         |
| ------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Deployment access              | Vercel authentication before the application                                   | Observed; external hosting UI, not part of the 1906.au design system |
| Demo landing                   | **Good decisions start with better questions.** Persona-card grid              | Observed production                                                  |
| Empty chat                     | **Put your pitch to the test.** Buyer context, starter prompts, composer       | Observed production                                                  |
| Conversation                   | Left/right message bubbles, delivery labels, composer                          | Observed production using fixed demo reply                           |
| Buyer insights                 | Dark blue assessment drawer, empty or illustrative states                      | Observed production; live dynamic states source-verified             |
| Persona manager                | **Your personas**, active/archived filters, profile cards and actions          | Observed production                                                  |
| Persona creation               | **Start with the person.** Description/manual method, emoji, structured fields | Observed production                                                  |
| Persona edit/duplicate         | Same editor with prefilled fields, save/cancel and provenance/review context   | Source-verified                                                      |
| Private unlock                 | **Studio User**, shared access-code field, **Open Studio**, **Back to demo**   | Observed production                                                  |
| Private conversation setup     | Persona preview and three intent fields                                        | Source-verified; requires application unlock                         |
| Private workspace              | Refresh/lock toolbar, usage percentage, target strip, chat and insights        | Source-verified                                                      |
| Linked continuation            | Editable reviewed summary, create/cancel, original-conversation link           | Source-verified                                                      |
| Storage/configuration failures | Inline alert or fatal data-attention screen                                    | Source-verified                                                      |

### 7.2 Persona editor information architecture

| Section              | Content                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Method               | **Describe the buyer** or **Build manually**                                                                            |
| AI drafting          | Dark blue box, explanation, description textarea, 20,000-character count, **Generate draft**, generation/retry feedback |
| Identity             | Emoji, name and role                                                                                                    |
| About the buyer      | Industry, company size, optional age/income range, background                                                           |
| Goals and pressures  | Goals, pain points, tools/alternatives, constraints                                                                     |
| How they buy         | Motivations, objections, preferred evidence, authority, process, pace, budget sensitivity                               |
| How they communicate | Style, example phrases, channels, additional guidance                                                                   |
| Advanced             | Collapsible custom role-play instructions                                                                               |
| Review/save          | Assumptions and provenance where available, **Cancel**, **Save persona** or relevant edit action                        |

List fields use one item per line. Hints show provenance/unknown status and limits. AI generation must leave a reviewable editable draft, never imply that guesses are facts or that generation has already saved the persona. Unknown optional fields remain blank. See `PLATFORM.md` for source-grounding and validation details.

### 7.3 Private setup and conversation chrome

Private setup labels are **Persona**, **What do you want to learn?**, **What are you offering?** and **What next step are you testing?** It ends with **Start conversation**. The helper copy explains that a conversation tests one next step and that a different decision needs a new conversation.

The private workspace provides **Refresh status** and **Lock Studio**. Its sidebar shows **Usage remaining — N%**, rather than the demo's CRD balance. A pale blue strip identifies the next step being tested. Working-memory details and reviewed continuation context use expandable strips rather than interrupting the main transcript.

## 8. Interaction states and content rules

### 8.1 Chat and assessment states

| State                           | Visible treatment                                                                 | Input/action behaviour                                            |
| ------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Empty                           | Welcome headline and three starter buttons                                        | Starter inserts text and focuses composer; it does not send       |
| Sending/generating              | Immediate user bubble with **Sending…**; animated dots and buyer-is-replying text | Further sending blocked; live draft is disabled during generation |
| Saved reply, refreshing state   | Reply visible when returned; **Refreshing conversation status…**                  | Status synchronisation protects version consistency               |
| Analysing                       | **Reply saved. Updating buyer insights… You can draft your next message.**        | Drafting allowed, sending remains blocked during active operation |
| Current assessment              | **Latest reply assessed**                                                         | Current post-reply values shown                                   |
| Previous assessment             | **Previous insights · not the latest exchange**                                   | Historical values are explicitly labelled                         |
| Missing assessment              | **Insights not yet available** or saved-reply update box                          | **Update insights** when eligible                                 |
| Analysis failure                | **Your reply is saved. Insights could not be updated.**                           | **Retry insights** requests analysis only                         |
| Reply failure                   | Error inside the user message with **Retry reply** where eligible                 | Preserve the request and recover before another turn              |
| Uncertain outcome               | Status/review instruction and preserved text                                      | Refresh before retry; no automatic fresh request                  |
| Exhausted/review-required usage | Plain explanation near composer                                                   | Drafting remains possible; sending is blocked                     |
| Context limit                   | Review-linked-continuation action and editable summary                            | Create continuation after review; no silent transcript deletion   |

The latest buyer response is not evidence for a post-reply score until that exchange has been assessed. Preserve the distinction between pre-reply guidance, a saved reply and completed insights. The UI's **saving** phase name refers to refreshing/checking status; successful dialogue API responses already represent a committed server reply.

### 8.2 Other states

| Area          | States to reproduce                                                                    |
| ------------- | -------------------------------------------------------------------------------------- |
| Buttons       | Default, hover, keyboard focus, disabled, busy                                         |
| Persona cards | Active, hovered, archived, empty filtered list                                         |
| Editor        | New, dirty, generating, generated draft, validation error, save conflict, save failure |
| Navigation    | Closed, mobile open, selected conversation, scrollable history                         |
| Unlock        | Empty/disabled, opening, authentication/configuration error                            |
| Memory        | No memory, compacted memory with omissions, full context, continuation review          |
| Persistence   | Durable save, in-memory-only warning, unreadable saved data without overwrite          |

### 8.3 Copy and information hierarchy

Use English with Australian spelling. Prefer the current plain-language labels: **Create persona**, **Manage personas**, **New conversation**, **Buyer insights**, **What to explore next** and **What’s holding them back?** The code term archetype can stay in technical documentation; users see persona.

Keep the distinction **Demo · illustrative only** versus **Private Studio · AI simulation**. Demo balance copy must say demo; the live allowance must not be presented as a provider wallet or real dollar balance. Keep **A simulated buyer, not real customer feedback** visible in the live chat.

Do not move technical model/rate details into the primary conversation flow. Existing **Technical details** and **Assessment details** disclosures keep explanations available without competing with the buyer conversation. Technical API/version details belong in `PLATFORM.md`.

Default empty-state starter text is **Here’s what we’re offering**, **The price includes** and **What matters most to you**, with a small diagonal arrow. Empty landing copy is **Choose a persona to explore how they might respond to your offer.**

## 9. Accessibility and motion

### 9.1 Implemented controls

| Feature            | Current implementation                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Keyboard focus     | 3px `#0271a3` outline with 3px offset on buttons, fields, selects and summaries                                   |
| Dark-panel focus   | Pale blue `#a9dff3` outline                                                                                       |
| Navigation overlay | Dialog semantics when open, labelled close/dismiss controls, Escape, focus trap and return to trigger             |
| Insights overlay   | Modal dialog below 1200px, focus trap, Escape, backdrop dismissal and return to trigger; desktop remains an aside |
| Chat updates       | `role="log"`, accessible conversation name, polite live updates                                                   |
| Status/errors      | Status regions and alert roles according to state                                                                 |
| Message evidence   | Focusable message targets with source links and visible focus treatment                                           |
| Forms              | Labels, field hints, named send/navigation/close controls; budget radio grouping                                  |
| Emoji choices      | Pressed/selected state and accessible names; decorative display avatars hidden from assistive tech                |
| Reduced motion     | Global reduced-motion media rule disables animations, transitions and smooth scrolling                            |

The insights trap accounts for content hidden inside closed details. Focus moves to close when opened and returns to the previous trigger when possible. New designs should retain this behaviour as well as the appearance.

### 9.2 Motion

| Interaction        | Timing and effect                                                  |
| ------------------ | ------------------------------------------------------------------ |
| Button             | 0.18s background/transform transition                              |
| Primary hover      | Rise 1px                                                           |
| Persona-card hover | Rise 3px                                                           |
| Insights opening   | Slide from right over 0.25s, ease-out                              |
| Reply dots         | Three 5px blue circles; 1.4s opacity pulse, delays 0 / 0.15 / 0.3s |

No decorative animation is necessary for comprehension. Status text carries meaning when motion is disabled.

### 9.3 Known review gaps

No formal WCAG conformance claim is made. A future accessibility pass should measure colour contrast, small 8–10px metadata, zoom/reflow, screen-reader behaviour, touch targets, mobile virtual keyboard behaviour and focus interaction between overlays and background content. The current `.muted` colour is also applied to delivery status inside a charcoal user bubble; that specific combination warrants contrast correction in a separately reviewed UI change. This documentation does not change it.

## 10. Reproduction brief for design tools

### 10.1 Suggested Figma/Stitch setup

Create colour variables using the core hex values and text styles using the typography table. Create reusable components for the wordmark/badge, buttons, navigation, history item, mode select, persona card/context, editor field, emoji picker, chat bubbles/composer, status banner and insights sections. Use variants for the states in section 8.

Prepare these **reference frames**. Sizes below are recommended design-tool working frames, not additional production breakpoints:

| Frame                 | Suggested size            | Content                                                       |
| --------------------- | ------------------------- | ------------------------------------------------------------- |
| Desktop               | 1440 × 1000               | Landing, chat, manager, editor, private setup                 |
| Desktop with insights | 1440 × 1000               | 288px sidebar, 420px reserved insights, remaining chat        |
| Tablet                | 1024 × 900                | Visible sidebar with modal insights overlay                   |
| Mobile                | 390 × 844                 | Chat, navigation overlay, insights overlay, one-column editor |
| Private unlock        | Desktop and mobile frames | Centred bounded access form                                   |

Create realistic wrapping for long roles and messages, rather than sizing everything to short placeholder text. Keep transcript, form and insights scrolling independent where the source specifies it. Do not assume every screen's content can fit without scrolling.

### 10.2 Copyable reproduction prompt

```text
Reproduce the current 1906.au Strategic Studio interface from this specification.
Build a usable application interface for practising conversations with simulated
buyers. Match the existing visual system and information hierarchy.

Visual language:
- Warm cream canvas #f1efe7; off-white surfaces #faf9f6.
- Charcoal #1a1a1a text and 2–3px marker-style borders.
- Primary blue #01537e, hover/focus blue #0271a3, dark blue #013b5b,
  pale blue #e1f3fa, white inputs and buyer bubbles.
- Epilogue display headings and buttons; Manrope body and field text.
- Heavy, tightly tracked headlines; asymmetric rounded cards/buttons;
  small hard offset blue shadows.
- Styled text wordmark 1906.au, italic/heavy/slightly rotated, with BETA badge.
- Lucide-style line icons and native Unicode emoji avatars.

Desktop shell:
- 100dvh app with a 288px left navigation sidebar.
- Sidebar: wordmark, New conversation, Create persona, Manage personas,
  recent conversations, workspace-mode select, user and usage footer.
- Main chat: minimum 88px header with persona identity and Buyer insights;
  expandable profile strip; dotted cream transcript; bottom composer.
- At 1200px and above, opening insights reserves a 420px right column.
- Below 1200px, insights is a dismissible modal overlay with backdrop.
- At 760px and below, navigation becomes a slide-out drawer, forms become
  one column, and chat spacing becomes compact.

Required screens:
1. Persona landing: Good decisions start with better questions; emoji cards.
2. Empty chat: Put your pitch to the test; three insert-only starter prompts.
3. Completed chat: dark user bubbles right, white buyer bubbles left,
   visible speaker and delivery state, multiline composer.
4. Buyer insights: freshness, stance, readiness /100, obstacle/conditions,
   supporting evidence, sentiment, next exploration, assessment details.
5. Persona management: active/archived filters and profile/actions cards.
6. Persona editor: description/manual methods, source review, emoji picker,
   structured sections, optional advanced instructions, save/cancel.
7. Private access and conversation setup: access-code form, persona preview,
   learning objective, offer and one fixed next step.

Behaviour and content:
- Australian English. Use the labels in this specification.
- Keep Demo illustrative and Private Studio AI simulation visibly distinct.
- Show Usage remaining as a percentage privately; demo uses labelled CRD.
- Show immediate sending state, then saved reply, then separate analysis.
- Permit drafting during analysis; serialise sending.
- Provide retry/recovery states without losing the user's text.
- Unavailable readiness says Not yet clear, never an invented zero.
- Readiness is a simulation index, not conversion probability.
- Use expandable technical/assessment detail, accessible focus, Escape,
  modal focus management and reduced-motion support.

Use fictional generic sample buyers and no private records or credentials.
Follow the measurements and component tables in DESIGN.md for exact styling.
Refer to PLATFORM.md for architecture; do not infer new backend features.
```

### 10.3 Boundaries for a visual replication

A design tool can reproduce screens and interactions without implementing the AI or storage. Clearly label prototype data as illustrative. A connected product must separately preserve API authentication, immutable persona/intent snapshots, request identity, ledger privacy and analysis freshness. A visually accurate prototype is not proof of those backend properties.

New login methods, dashboards, image portraits, account billing, public sharing, booking actions, green/red score schemes or automatic research would be product changes. Do not present them as existing features. Record any proposed redesign separately from this current-state specification.

## 11. Implementation map and acceptance checks

### 11.1 Source of truth

| Design area                                  | Source                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Palette/font tokens                          | [tailwind.config.js](tailwind.config.js)                                                            |
| Effective component styles and breakpoints   | [src/index.css](src/index.css)                                                                      |
| Font loading, title, favicon                 | [index.html](index.html)                                                                            |
| Demo landing/mode shell                      | [src/App.tsx](src/App.tsx)                                                                          |
| Sidebar/history/footer                       | [Sidebar.tsx](src/components/Sidebar.tsx)                                                           |
| Responsive navigation and focus              | [StudioNavigation.tsx](src/components/StudioNavigation.tsx)                                         |
| Chat, composer, delivery and drafting states | [ChatWorkspace.tsx](src/components/ChatWorkspace.tsx)                                               |
| Private setup, toolbar and recovery          | [LiveStudio.tsx](src/components/LiveStudio.tsx)                                                     |
| Personas and archive filters                 | [PersonaManager.tsx](src/components/PersonaManager.tsx)                                             |
| Editor, emoji and generation review          | [ArchetypeSynthesizer.tsx](src/components/ArchetypeSynthesizer.tsx), [avatar.ts](src/api/avatar.ts) |
| Profile disclosure                           | [PersonaContext.tsx](src/components/PersonaContext.tsx)                                             |
| Insights layout, focus and status            | [TelemetryDrawer.tsx](src/components/TelemetryDrawer.tsx)                                           |
| Human-readable insight wording               | [buyerInsights.ts](src/services/buyerInsights.ts)                                                   |

These links follow the reading branch; the [reviewed baseline](https://github.com/mrbrave/1906-ai-studio/tree/8298d49099965898305a72af2a7005f8ba7a877c) pins the evidence. Later rules in `src/index.css` override earlier ones. Do not use the historical 380px drawer, 72px score or header-offset drawer position as the effective current design.

### 11.2 Acceptance checks for a reproduction

- Cream/blue/charcoal colours, Epilogue/Manrope and asymmetric shapes match the tables.
- The desktop sidebar is 288px; the effective insights panel is 420px and reserves space from 1200px upwards.
- At mobile sizes, navigation and insights can open, close, scroll and return focus without trapping the user outside the panel.
- Cards, forms, long messages, long roles and expanded evidence wrap without horizontal content loss.
- Primary actions, keyboard focus, disabled states and generation/recovery states are distinguishable.
- Demo and private labels, usage units and simulation caveats remain accurate.
- Immediate user messages, saved replies and assessments have separate visible states.
- An unavailable or stale score cannot appear current or certain.
- Profile edits and emoji choices do not visually rewrite the frozen persona of an existing conversation.
- Errors preserve recoverable text; insights retry does not look like a new buyer reply.
- Reduced-motion settings remove nonessential motion while retaining status text.
- Any divergence is recorded as a proposed change, with screenshots and behaviour reviewed before merge.

This guide adds no visual redesign or application changes. No new assets, fonts, providers, environment values or database migration are required to add the documentation.
