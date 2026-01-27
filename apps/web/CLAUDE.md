# ig-console

Developer-focused admin UI for generation management and observability.

- This is an admin console that won't be used on mobile - favour layouts that make good use of desktop viewport space.

## shadcn/ui with Base UI

We use the latest shadcn/ui which now supports **Base UI** primitives in addition to Radix. Base UI is built by a collective including ex-Radix developers and is actively maintained (7-person full-time team), whereas Radix has been barely maintained for over a year.

Base UI is essentially a spiritual successor to Radix. Most patterns are familiar, but there are key differences.

## Component Installation

Install shadcn components as needed using the registry.

- Run `bunx shadcn@latest add <components>` from the root directory of the add, i.e. `apps/web`
- Use command line switches to avoid the interactive prompts. Say "no" to overriding existing components.
- You should do this autonomously if we're creating something that could use them.
- Always prefer using an existing shadcn/ui solution over creating something completely custom. They're expertly crafted and will be themed automatically.
- Follow the conventions established by shadcn in our own designs.

**Documentation:**

- Base UI: https://base-ui.com/
- Composition handbook: https://base-ui.com/react/handbook/composition

### Composition: `render` prop instead of `asChild`

Base UI uses a `render` prop for polymorphic rendering rather than Radix's `asChild` pattern. This gives more explicit control over prop forwarding.

```tsx
// Radix pattern (old)
<DialogClose asChild>
  <Button variant="ghost">Close</Button>
</DialogClose>

// Base UI pattern (current)
<DialogClose render={<Button variant="ghost" />}>
  Close
</DialogClose>
```

The `render` prop accepts either a React element or a render function for advanced cases:

```tsx
// Element form (most common)
<DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" />} />

// Function form (for state access)
<Component render={(props, state) => <div {...props}>{state.open ? 'Open' : 'Closed'}</div>} />
```

### Button

The Button component handles icon sizing and spacing automatically. Don't manually size icons or add margins.

**Icon positioning with `data-icon`:**

Add `data-icon="inline-start"` or `data-icon="inline-end"` to icons for proper spacing. The button adjusts padding automatically, and `gap-*` handles the space between icon and text.

```tsx
// Icon before text
<Button>
  <SaveIcon data-icon="inline-start" />
  Save changes
</Button>

// Icon after text
<Button>
  Continue
  <ArrowRightIcon data-icon="inline-end" />
</Button>

// Loading state with Spinner
<Button disabled>
  <Spinner data-icon="inline-start" />
  Saving...
</Button>

// Icon-only button (no data-icon needed)
<Button size="icon-sm" variant="ghost">
  <MoreHorizontalIcon />
</Button>
```

**Never do this:**

```tsx
// ❌ Manual margins - Button's gap handles spacing
<Button>
  <SaveIcon className="mr-1.5" />
  Save
</Button>

// ❌ Manual icon sizing - Button sets icon size per variant
<Button>
  <SaveIcon className="h-3 w-3" />
  Save
</Button>
```

**Icon sizes by button variant:**

| Button size | Icon size       |
| ----------- | --------------- |
| `xs`        | 12px (size-3)   |
| `sm`        | 14px (size-3.5) |
| `default`   | 16px (size-4)   |
| `lg`        | 16px (size-4)   |

**Icon-only button sizes:**

| Size      | Button dimensions |
| --------- | ----------------- |
| `icon-xs` | 24px (size-6)     |
| `icon-sm` | 28px (size-7)     |
| `icon`    | 32px (size-8)     |
| `icon-lg` | 36px (size-9)     |

### Spinner

Use the `Spinner` component for loading states. It's a styled `Loader2Icon` with proper accessibility attributes.

```tsx
import { Spinner } from "@/components/ui/spinner"

// In a button
<Button disabled>
  <Spinner data-icon="inline-start" />
  Loading...
</Button>

// Standalone
<Spinner className="size-6" />
```

### ButtonGroup

Groups related buttons together with consistent styling. Handles border merging automatically.

```tsx
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "@/components/ui/button-group"

// Basic horizontal group
<ButtonGroup>
  <Button variant="outline">Left</Button>
  <Button variant="outline">Middle</Button>
  <Button variant="outline">Right</Button>
</ButtonGroup>

// With separator (useful for non-outline variants)
<ButtonGroup>
  <Button>Action</Button>
  <ButtonGroupSeparator />
  <Button size="icon"><ChevronDownIcon /></Button>
</ButtonGroup>

// Vertical orientation
<ButtonGroup orientation="vertical">
  <Button variant="outline">Top</Button>
  <Button variant="outline">Bottom</Button>
</ButtonGroup>

// With text label
<ButtonGroup>
  <ButtonGroupText>Label</ButtonGroupText>
  <Input />
  <Button>Submit</Button>
</ButtonGroup>
```

**Props:**

- `orientation`: `"horizontal"` (default) or `"vertical"`
- Always add `aria-label` for accessibility

### Item

A versatile component for displaying content with media, title, description, and actions. Use it for list items, cards, or any content that follows the pattern: icon/avatar + text + optional action.

**When to use Item:**

- Displaying a list of things with icons/avatars and text
- Content that may be clickable (as a link) but isn't a button
- Notification or alert-style displays
- Any layout with: media | title+description | actions

**When NOT to use Item:**

- Form controls with labels → use Field instead
- Pure buttons → use Button
- Simple text links → use regular anchors

```tsx
import {
  Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions, ItemGroup
} from "@/components/ui/item"

// Basic item with icon
<Item>
  <ItemMedia variant="icon"><FileIcon /></ItemMedia>
  <ItemContent>
    <ItemTitle>Document.pdf</ItemTitle>
    <ItemDescription>Uploaded 2 hours ago</ItemDescription>
  </ItemContent>
  <ItemActions>
    <Button size="icon-xs" variant="ghost"><DownloadIcon /></Button>
  </ItemActions>
</Item>

// As a clickable link (use render prop)
<Item render={<Link to="/users/123" />}>
  <ItemMedia variant="icon"><UserIcon /></ItemMedia>
  <ItemContent>
    <ItemTitle>John Doe</ItemTitle>
  </ItemContent>
</Item>

// Grouped items
<ItemGroup>
  <Item>...</Item>
  <Item>...</Item>
</ItemGroup>
```

**Props:**

- `variant`: `"default"` | `"outline"` | `"muted"`
- `size`: `"default"` | `"sm"` | `"xs"`
- `render`: Use to render as a link (e.g., `render={<Link to="..." />}`)

**ItemMedia variants:**

- `"icon"` - For lucide icons (auto-sizes to 16px)
- `"image"` - For images/avatars (40px default, responsive to Item size)

### InputGroup

Compose inputs with icons, static text, buttons, or other elements. Use `InputGroupInput` instead of `Input` inside the group.

```tsx
import {
  InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton, InputGroupText
} from "@/components/ui/input-group"

// Input with search icon
<InputGroup>
  <InputGroupInput placeholder="Search..." />
  <InputGroupAddon>
    <SearchIcon />
  </InputGroupAddon>
</InputGroup>

// Input with prefix text (e.g., currency)
<InputGroup>
  <InputGroupAddon>
    <InputGroupText>$</InputGroupText>
  </InputGroupAddon>
  <InputGroupInput placeholder="0.00" />
</InputGroup>

// Input with button
<InputGroup>
  <InputGroupInput placeholder="Enter URL..." />
  <InputGroupAddon align="inline-end">
    <InputGroupButton>Go</InputGroupButton>
  </InputGroupAddon>
</InputGroup>

// Multiple elements in addon
<InputGroup>
  <InputGroupInput placeholder="Search..." />
  <InputGroupAddon align="inline-end">
    <kbd>⌘K</kbd>
    <InputGroupButton size="icon-xs"><SearchIcon /></InputGroupButton>
  </InputGroupAddon>
</InputGroup>
```

**InputGroupAddon `align` prop:**

- `"inline-start"` (default) - Left side of input
- `"inline-end"` - Right side of input
- `"block-start"` - Above the input
- `"block-end"` - Below the input

**Note:** For proper focus navigation, place `InputGroupAddon` after the input in the DOM and use `align` for visual positioning.

### Styling guidelines

- **Don't override theme defaults.** shadcn has a powerful theme generator for consistent customization. Components are styled via CSS variables and the theme system - avoid inline styles or className overrides unless necessary.
- **Use semantic color tokens** like `bg-primary`, `text-muted-foreground`, `border-input` rather than raw colors.

### Dark mode

We run dark mode only. The light theme colors have been removed from our CSS. However, for compatibility with shadcn component internals that use `dark:` prefixes, the `dark` class is statically applied to the root HTML element.

**For custom components:** Just style normally. Don't use the `dark:` utility - we'll never have a light theme.

### Lucide icons

Use the `Icon` suffix on lucide imports to avoid naming clashes with components or variables:

```tsx
// Preferred
import { ExternalLinkIcon, InfoIcon, SearchIcon } from "lucide-react"

// Avoid - can clash with component names
import { ExternalLink, Info, Search } from "lucide-react"
```

## Registry Components

The shadcn registry system now allows anyone to easily create and distribute their own custom shadcn compatible component libraries, which will create a folder in the `components` directory with their namespace. These tend to be more complex components for a specific purpose. We can customise them directly if required, but avoid this unless truly necessary to preserve their APIs as documented.

- `elements/` Elements Error Boundary UI

## Custom Components

- Just put them in the root `components/` directory.
- If they have a logical group, create a directory for them.

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

### Jan 16, 2026

| ID    | Time     | T   | Title                                                | Read |
| ----- | -------- | --- | ---------------------------------------------------- | ---- |
| #3297 | 11:32 PM | 🔵  | Full-Stack TypeScript Monorepo Architecture Explored | ~751 |

### Jan 22, 2026

| ID    | Time    | T   | Title                                               | Read |
| ----- | ------- | --- | --------------------------------------------------- | ---- |
| #4664 | 7:35 PM | ✅  | Updated HTML with Dark Mode and JetBrains Mono Font | ~256 |
| #4663 | "       | 🔵  | HTML Entry Point                                    | ~185 |
| #4660 | 7:34 PM | 🔵  | shadcn/ui Configuration                             | ~233 |
| #4642 | 7:31 PM | 🔵  | TypeScript Configuration with Strict Mode           | ~197 |
| #4641 | "       | 🔵  | Vite Build Configuration                            | ~165 |
| #4640 | "       | 🔵  | Frontend Technology Stack Configuration             | ~307 |

</claude-mem-context>
