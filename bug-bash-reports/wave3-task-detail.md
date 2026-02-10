# Wave 3 - Task Detail Scope

**Fixes applied:** 6 (by partial agent run)

1. **AttachmentList.tsx**: Added `aria-label` to Preview, Download, Remove, and Close preview buttons for screen reader accessibility
2. **CustomerEmailModal.tsx**: Replaced hardcoded colors (`#1a1f2e`, `text-gray-500`, `bg-blue-50`, `bg-gray-100`) with CSS variables (`var(--surface)`, `var(--text-muted)`, `var(--accent)`, `var(--surface-2)`)
3. **SaveTemplateModal.tsx**: Replaced hardcoded colors (`border-slate-300`, `text-blue-500`, `text-slate-400`, `text-red-500`, `hover:bg-[#002880]`) with CSS variables
4. **TaskCard.tsx**: Removed unused `darkMode` from useMemo dependency array (the date info computation doesn't use darkMode)
5. **TaskDetailPanel.tsx**: Guards text/notes sync to not overwrite while actively editing; added aria-labels to email/archive/copy/share buttons; changed empty due_date to `undefined` instead of `''` for type consistency
6. **RecurrenceRow.tsx**: Added `htmlFor`/`id` linking between label and select element; removed `block` from conflicting `block flex` on label
