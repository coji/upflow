---
name: Upflow
description: A quiet board where the only color is the state of the team's pull requests.
colors:
  ink: 'oklch(0.145 0 0)'
  ink-strong: 'oklch(0.205 0 0)'
  paper: 'oklch(1 0 0)'
  paper-raised: 'oklch(0.985 0 0)'
  wash: 'oklch(0.97 0 0)'
  graphite: 'oklch(0.556 0 0)'
  hairline: 'oklch(0.922 0 0)'
  focus-haze: 'oklch(0.87 0 0)'
  alarm-red: 'oklch(0.577 0.245 27.325)'
  age-fresh: 'oklch(0.623 0.214 259.815)'
  age-settling: 'oklch(0.696 0.17 162.48)'
  age-waiting: 'oklch(0.769 0.188 70.08)'
  age-stalled: 'oklch(0.637 0.237 25.331)'
  age-stuck: 'oklch(0.627 0.265 303.9)'
  age-abandoned: 'oklch(0.269 0 0)'
  size-xs: 'oklch(0.704 0.04 256.788)'
typography:
  headline:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: '-0.025em'
  metric:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.875rem'
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 400
    lineHeight: 1.33
  overline:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    fontSize: '10px'
    fontWeight: 600
    letterSpacing: '0.025em'
rounded:
  sm: '6px'
  md: '8px'
  lg: '10px'
  xl: '14px'
  full: '9999px'
spacing:
  '1': '4px'
  '2': '8px'
  '4': '16px'
  '6': '24px'
components:
  button-default:
    backgroundColor: '{colors.ink-strong}'
    textColor: '{colors.paper-raised}'
    rounded: '{rounded.md}'
    height: '36px'
    padding: '8px 16px'
  button-outline-sm:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    height: '32px'
    padding: '0 12px'
  button-outline-sm-hover:
    backgroundColor: '{colors.wash}'
  stat-card:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.lg}'
    padding: '16px'
  pr-block:
    rounded: '{rounded.full}'
    size: '20px'
---

# Design System: Upflow

## Overview

**Creative North Star: "The Flow Board"**

Upflow is a board a team gathers around. The surface is black, white and gray, close to unstyled, so that the only color on screen is the state of the work: how long a PR has been open, how big it is, whether it is waiting on someone. A manager, a developer and a consultant should be able to look at the same screen and point at the same red dot.

The system is dense and calm. Lists, rows of small round blocks, a few stat cards, and plain headings carry everything. There is no decorative imagery, gradient or brand illustration; the incumbent UI is shadcn/ui (new-york, neutral base) on Tailwind v4, and new screens extend it rather than restyle it.

A brand accent color is wanted but not yet chosen. Until it is, nothing on the surface uses color for identity.

**Key Characteristics:**

- Monochrome chrome, chromatic data.
- System sans at small sizes; hierarchy from weight and size, not color.
- Flat surfaces separated by hairline borders.
- Round blocks as the unit of work: one block is one PR.
- Every hidden or filtered item is counted and stated on screen.

## Colors

A neutral grayscale shell with a fixed set of data colors whose meaning never changes from screen to screen.

### Primary

- **Ink Strong** (`ink-strong`): the default button fill and the strongest text. Used for actions, never for decoration.

### Neutral

- **Ink** (`ink`): body and heading text.
- **Paper** (`paper`): page, card and popover background.
- **Paper Raised** (`paper-raised`): the sidebar surface and text on dark fills.
- **Wash** (`wash`): hover fill for outline and ghost buttons, muted and secondary surfaces.
- **Graphite** (`graphite`): secondary text such as descriptions, counts and legends.
- **Hairline** (`hairline`): every border and divider, and input strokes.
- **Focus Haze** (`focus-haze`): focus ring, applied at 50% opacity.
- **Alarm Red** (`alarm-red`): destructive actions and errors only.

### Data colors

These are semantic, not decorative. Each one always means the same thing.

- **PR age:** Fresh blue (`age-fresh`, under 1 day) → Settling green (`age-settling`, 1–3 days) → Waiting amber (`age-waiting`, 3–7 days) → Stalled red (`age-stalled`, 7–14 days) → Stuck purple (`age-stuck`, 14–30 days) → Abandoned near-black (`age-abandoned`, 31 days or more).
- **PR size:** XS slate (`size-xs`), S green, M blue, L amber, XL red. Size reuses the age hues on purpose, so a viewer switches between the Age and Size views with a toggle rather than reading both at once.
- **Review status:** approved reads green (emerald 600), changes requested and unassigned read amber (amber 600), and in-review stays gray.
- **Unknown:** gray (gray 300) when a size or age cannot be computed.

### Named Rules

**The Color Means Data Rule.** Chrome (buttons, headings, navigation, cards) stays in the neutral ramp. A hue on screen must answer "what state is this PR in?" If it doesn't, it is gray.

**The Accent Is Undecided Rule.** A single brand accent is planned but not chosen. Do not introduce one inside a feature; propose it as its own change.

## Typography

**Display Font:** none (no web font is loaded)
**Body Font:** the platform sans (`ui-sans-serif, system-ui, sans-serif`), which is Hiragino or Noto Sans JP for Japanese names on the clients' machines.

**Character:** native and unbranded. Japanese member names and English UI copy sit in the same line without a font switch.

### Hierarchy

- **Headline** (700, 24px, tracking -0.025em): page titles such as "Review Stacks" and "Cycle Time". One per page.
- **Metric** (700, 30px): the number in a stat card.
- **Body** (400, 14px): most UI text, table cells and menu items. Page descriptions use the same size in Graphite.
- **Label** (400, 12px): legends, captions, popover detail and button text in the small size.
- **Overline** (600, 10px, uppercase, tracking 0.025em): section labels inside popovers ("Reviewers").

### Named Rules

**The Numbers Align Rule.** Counts that change or sit in a column use tabular figures (`tabular-nums`), so a count of 8 and a count of 23 line up.

## Layout

An inset sidebar on the left (a floating, rounded panel on `paper-raised`) and a single content column on the right. Each page opens with a page header: title and one-line description on the left, actions on the right (filters, the hidden-PRs menu, period pickers); the two wrap onto separate lines on narrow screens.

Spacing follows the existing rules:

- Inside a form field (label, input, error): 4px.
- Between form fields: 8px.
- Between page sections: 24px.
- Inside a section (title and description): 4px.

Review Stacks lays out two columns (Authored PRs and Review Queue) that stack into one on narrow screens. Rows are a person, a count, then a horizontal run of PR blocks with a dashed red line at the personal WIP limit.

## Elevation & Depth

Flat. Surfaces are separated by Hairline borders, not shadows. The outline button carries the barely visible `shadow-xs`; dropdowns and popovers use the library's default small shadow so they lift off the board while open. Nothing else casts a shadow.

### Named Rules

**The Hairline Over Shadow Rule.** To separate two areas, draw a 1px Hairline border. Don't add a shadow to a card, row or section.

## Shapes

Gently rounded rectangles for containers and controls (8px base: 6px small, 8px medium, 10px large, 14px extra large). The one strong shape is the circle: PR blocks, avatars and legend swatches are fully round, so the eye reads circles as "work items" and rectangles as "interface".

## Components

### Buttons

- **Shape:** gently rounded (8px).
- **Default:** Ink Strong fill, Paper Raised text, 36px high.
- **Outline small:** the workhorse for page-header actions. Paper fill, Hairline border, 32px high, 14px text with a 14px Lucide icon on the left. Hover fills with Wash.
- **Ghost:** no border; Wash on hover. Used for icon-only actions such as delete.
- **Focus:** a 3px Focus Haze ring.

### PR block (signature component)

- A circle, one per PR, filled with its age or size color. Draft PRs carry a small "D" badge; approved and changes-requested PRs carry a ✓ or ✗ mark inside.
- Unassigned PRs and some review states render as a ring (1.5px inset) with a faint 20% fill instead of a solid fill.
- Clicking a block opens a popover with the repo and number, size, title, `source → target` branch, author, age, review status and reviewers.

### Stat card

- Hairline border, 10px radius, 16px padding, centered metric over a Graphite label. No fill, no shadow.

### Hidden-PRs menu

- An outline-small button reading "N PRs hidden" with a filter icon, opening a checkbox list of reasons with right-aligned tabular counts, then "Show all PRs" and, for admins, "Manage filters…". Disappears when nothing is hidden.

### Navigation

- Inset sidebar grouped under small Graphite group labels (Workload, Throughput, Analysis, Management). Items are a Lucide icon and a 14px label; the active item gets a Wash fill. On narrow screens the sidebar collapses to icons or a drawer.

## Do's and Don'ts

### Do:

- **Do** keep chrome in the neutral ramp and let only data carry hue (The Color Means Data Rule).
- **Do** reuse the age and size scales exactly as defined, with the same thresholds, wherever PR age or size appears.
- **Do** use Lucide icons at 14–16px; the filter icon (`list-filter`) marks filtering controls.
- **Do** write `dark:` variants for new color classes, as existing components do. Dark mode has no switch yet, but it is kept working.
- **Do** write UI copy in English. Japanese appears only as data until i18n lands.
- **Do** show counts with `tabular-nums` and say how many items are hidden and why.

### Don't:

- **Don't** introduce a brand accent, gradient or decorative color inside a feature.
- **Don't** give a new meaning to an existing data color (for example, using red for "selected").
- **Don't** add shadows to cards, rows or sections.
- **Don't** use emoji or text glyphs as new icons; the existing ✓ ✗ 💬 ⏳ marks are legacy, not a pattern to extend.
- **Don't** mix Japanese and English UI copy on one screen.
