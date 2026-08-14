# Standard Report Selector Improvement

Date: 2026-08-14

## Goal

Make the report picker on `/reports/standard` faster for users who already know their frequently used reports, while keeping enough category and description context to distinguish similarly named reports.

## Current Problem

The current UI splits one task across category chips, a search input, and a native `<select>`. Report options concatenate `ReportName` and `Description`, so long values are truncated and difficult to scan. After selection, the search query remains visible, which makes the selected state ambiguous.

## Approved Direction

Replace the separate search input and native `<select>` with one searchable combobox. Preserve the existing one-click favorite report chips because they match the frequent-user workflow. Remove the category filter chips; categories will instead organize and label results inside the combobox.

## Interaction Design

### Favorite shortcuts

- Keep the existing favorite report buttons above the selector.
- Clicking a favorite selects the report immediately.
- The selected favorite uses the existing blue selected treatment.

### Searchable combobox

- The closed field shows only the selected report name as the primary value.
- The selected report category appears as a compact badge.
- The selected report description appears below the field as muted supporting text, not inside the value.
- Long names truncate visually with an ellipsis; the full name remains available through the element title.
- When no report is selected, the field reads `ค้นหาหรือเลือกรายงาน...`.
- Typing filters by report name, description, and category.
- Opening the panel presents reports grouped by category.
- Results within each category are sorted by report name.
- The panel shows a clear loading state, empty-report state, and no-results state.
- Selecting a result closes the panel, clears the temporary query, and calls the existing report-selection handler.
- A clear action removes the selection without requiring the placeholder option.
- The existing favorite toggle remains available beside the selected report.

### Keyboard and accessibility

- The control uses combobox/listbox semantics.
- Arrow Up and Arrow Down move the active result.
- Enter selects the active result.
- Escape closes the result panel without changing the selection.
- The visible label is programmatically associated with the control.
- Focus treatment continues to use the existing blue ring and border language.

## Visual Design

- Preserve the current ReportCenter visual system: slate surfaces, blue focus and selected states, rounded-lg controls, subtle borders, and compact enterprise spacing.
- Increase the selector width from `max-w-sm` to a practical desktop width while keeping it full-width on narrow screens.
- Each option uses a two-level hierarchy: report name first, description second, with category as a small badge.
- Avoid introducing a new UI library or a new visual language.

## Component Boundary

Create a focused `ReportSelector` component with these responsibilities:

- Render and manage the combobox presentation.
- Maintain transient query, open/closed state, and keyboard active index.
- Filter, group, and sort reports for display.
- Report selection and favorite-toggle actions to the parent.

The existing standard report page remains responsible for:

- Fetching reports and favorites.
- Owning `selectedReportId`.
- Loading report parameters when selection changes.
- Executing and exporting reports.

No API, database, permission, parameter, execution, or export behavior changes.

## Data Flow

1. The page fetches the same available-report and favorite data as today.
2. The page passes reports, selected ID, favorite IDs, and loading/disabled state to `ReportSelector`.
3. `ReportSelector` derives filtered and grouped results locally.
4. Selection calls the page's existing `setSelectedReportId` flow.
5. The existing effect loads parameters for the newly selected report.

## Edge Cases

- Reports without a category appear under `อื่น ๆ`.
- Missing descriptions simply omit the secondary line.
- An empty report list shows `ยังไม่มีรายงานที่ใช้งานได้`.
- A search with no matches shows `ไม่พบรายงานที่ตรงกับ “{query}”`.
- Disabled/loading state prevents selection and communicates loading visibly.
- Clearing the selected report preserves the existing behavior that clears parameters and result state.

## Testing

Automated tests will cover the pure report-selection logic before implementation:

- Search matches report name, description, and category case-insensitively.
- Category grouping and alphabetical ordering are deterministic.
- Uncategorized reports fall back to `อื่น ๆ`.
- Empty queries return all reports.

Existing Vitest tests must continue to pass. Visual verification will cover desktop and narrow viewports, including default, searching, selected, no-results, and keyboard-selection states.

## Out of Scope

- Recent-report persistence or a new backend history API.
- Changes to favorite persistence.
- Changes to category management.
- Auto-selecting or auto-running the last report.
- Redesigning filters, results, export, or pagination.
