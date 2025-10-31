# Logo Component

The Logo component displays the Booking Swap brand logo with various customization options.

## Usage

```tsx
import { Logo } from '@/components/common';

// Basic usage
<Logo />

// Different variants
<Logo variant="light" />
<Logo variant="dark" />

// Different sizes
<Logo size="sm" />
<Logo size="md" />
<Logo size="lg" />
<Logo size="xl" />

// Icon only (no text)
<Logo showText={false} />

// Custom styling
<Logo className="my-custom-class" />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'light' \| 'dark' \| 'icon-only'` | `'light'` | Color variant of the logo |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | Size of the logo |
| `className` | `string` | `''` | Additional CSS classes |
| `showText` | `boolean` | `true` | Whether to show the "Booking Swap" text |

## Examples

### Header Logo
```tsx
<Logo variant="light" size="md" />
```

### Sidebar Logo
```tsx
<Logo variant="light" size="lg" />
```

### Footer Logo
```tsx
<Logo variant="dark" size="sm" />
```

### Icon Only (for favicons, small spaces)
```tsx
<Logo showText={false} size="sm" />
```

## Design

The logo consists of:
- A shield shape representing security and trust
- Swap arrows indicating the exchange functionality
- A clock with checkmark showing timing and completion
- Golden/yellow accent color (#F4C430) for warmth and trust
- Dark blue primary color (#1E3A5F) for professionalism and security