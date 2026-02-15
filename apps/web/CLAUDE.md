# ig-console

Developer-focused admin UI for generation management and observability.

- This is an admin console that won't be used on mobile - favour layouts that make good use of desktop viewport space.

## shadcn/ui with Base UI

We use the latest shadcn/ui which now supports **Base UI** primitives, which is the spiritual successor to Radix. Most patterns are familiar, but there are few differences.

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

Base UI uses a `render` prop for polymorphic rendering instead of Radix's `asChild`:

```tsx
<DialogClose render={<Button variant="ghost" />}>Close</DialogClose>
```

### Button

Handles icon sizing and spacing automatically — don't manually size icons or add margins. Use `data-icon="inline-start"` or `data-icon="inline-end"` on icons for proper spacing. Icon-only sizes: `icon-xs`, `icon-sm`, `icon`, `icon-lg`.

### Spinner

Use the `Spinner` component for loading states.

### ButtonGroup

Groups related buttons with automatic border merging. Supports `orientation="vertical"`, `ButtonGroupSeparator`, and `ButtonGroupText`.

```tsx
<ButtonGroup>
  <Button>Action</Button>
  <ButtonGroupSeparator />
  <Button size="icon">
    <ChevronDownIcon />
  </Button>
</ButtonGroup>
```

### Item

Composable list item: media + title/description + actions. Use for anything with the pattern: icon/image | text | optional action. Clickable via `render` prop. Group with `ItemGroup`.

```tsx
<ItemGroup>
  <Item variant="outline" render={<Link to="/files/123" />}>
    <ItemMedia variant="image">
      <img src={thumbnail} />
    </ItemMedia>
    <ItemContent>
      <ItemTitle>Document.pdf</ItemTitle>
      <ItemDescription>Uploaded 2 hours ago</ItemDescription>
    </ItemContent>
    <ItemActions>
      <Button size="icon-xs" variant="ghost">
        <DownloadIcon />
      </Button>
    </ItemActions>
  </Item>
</ItemGroup>
```

### InputGroup

Compose inputs with icons, text, or buttons. Use `InputGroupInput` instead of `Input` inside the group.

```tsx
<InputGroup>
  <InputGroupInput placeholder="Search..." />
  <InputGroupAddon align="inline-end">
    <kbd>⌘K</kbd>
    <InputGroupButton size="icon-xs">
      <SearchIcon />
    </InputGroupButton>
  </InputGroupAddon>
</InputGroup>
```

### Styling guidelines

- **Don't override theme defaults.** shadcn has a powerful theme generator for consistent customization. Components are styled via CSS variables and the theme system - avoid inline styles or className overrides unless necessary.
- **Use semantic color tokens** like `bg-primary`, `text-muted-foreground`, `border-input` rather than raw colors.

### Dark mode

We run dark mode only. The light theme colors have been removed from our CSS. However, for compatibility with shadcn component internals that use `dark:` prefixes, the `dark` class is statically applied to the root HTML element.

**For custom components:** Just style normally. Don't use the `dark:` utility - we'll never have a light theme.

## Registry Components

The shadcn registry system now allows anyone to easily create and distribute their own custom shadcn compatible component libraries, which will create a folder in the `components` directory with their namespace. These tend to be more complex components for a specific purpose. We can customise them directly if required, but avoid this unless truly necessary to preserve their APIs as documented.

- `elements/` Elements Error Boundary UI

## Custom Components

- Group components by feature in `components/` sub-folders.
- Use the `shared/` directory for assorted common reusables.
- Follow the shadcn/ui philosophy to building composable components
- Most custom components should spread props, and pass through className using the `cn` helper to merge defaults.
- Use the `Icon` suffix on lucide imports to avoid naming clashes, e.g. `SearchIcon`, not `Search`
