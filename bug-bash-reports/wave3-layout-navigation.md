# Wave 3 - Layout/Navigation Scope

**Fixes applied:** 2

1. **CommandPalette.tsx**: Removed `if (!isOpen) return null` early return that was preventing `AnimatePresence` from seeing child removal and playing exit animations (backdrop fade-out and palette scale-down). The conditional render `{isOpen && (...)}` inside `<AnimatePresence>` is the correct pattern.

2. **CommandPalette.tsx**: Removed unused `openRightPanel` destructuring from `useAppShell()` and from the `useMemo` dependency array.
