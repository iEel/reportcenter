# Standard Report Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split category/search/native-select UI on `/reports/standard` with one accessible searchable combobox that keeps favorite shortcuts and presents report name, category, and description with clear hierarchy.

**Architecture:** Put deterministic filtering, grouping, sorting, and keyboard-index behavior in a framework-independent helper module with Vitest coverage. Put transient combobox UI state in a focused `ReportSelector` client component, while the existing page continues to own fetched data, selected report ID, parameter loading, execution, and exports.

**Tech Stack:** Next.js 16.1.6, React 19.2.3, TypeScript 5, Tailwind CSS 4, Lucide React 0.575.0, Vitest 4.0.18.

## Global Constraints

- Do not add a UI library or runtime dependency.
- Preserve existing favorite persistence and one-click favorite shortcuts.
- Do not change APIs, database behavior, permissions, parameters, execution, exports, results, or pagination.
- Do not add recent-report persistence or auto-select/auto-run behavior.
- Preserve the ReportCenter slate/blue visual system and dark-mode behavior.
- Search must match name, description, and category case-insensitively.
- Reports without a category must appear under `อื่น ๆ`.

## File Structure

- Create `src/lib/report-selector.ts`: report type plus pure filtering, grouping, sorting, and active-index helpers.
- Create `src/lib/__tests__/report-selector.test.ts`: focused Vitest coverage for every pure behavior.
- Create `src/components/ReportSelector.tsx`: accessible searchable combobox and selected-report presentation.
- Modify `src/app/(dashboard)/reports/standard/page.tsx`: remove obsolete category/search state and native selector markup; render `ReportSelector` while preserving parent data flow.

---

### Task 1: Report filtering and grouping model

**Files:**
- Create: `src/lib/report-selector.ts`
- Create: `src/lib/__tests__/report-selector.test.ts`

**Interfaces:**
- Produces: `StandardReport`, `ReportGroup`, `filterReports(reports, query)`, and `groupReports(reports)` for the component in Task 3.
- Consumes: no project runtime state.

- [ ] **Step 1: Write failing model tests**

Create `src/lib/__tests__/report-selector.test.ts` with these fixtures and assertions:

```ts
import { describe, expect, it } from 'vitest';
import { filterReports, groupReports, type StandardReport } from '@/lib/report-selector';

const reports: StandardReport[] = [
  { ReportId: 1, ReportName: 'Statement', Description: 'Customer balance', CategoryName: 'Account' },
  { ReportId: 2, ReportName: 'Pre Alert', Description: 'Shipment notification', CategoryName: 'Customer Service' },
  { ReportId: 3, ReportName: 'Invoice For SIG', Description: 'Export invoice data', CategoryName: 'Account' },
  { ReportId: 4, ReportName: 'Unsorted Report', Description: null, CategoryName: null },
];

describe('filterReports', () => {
  it('returns all reports for an empty query', () => {
    expect(filterReports(reports, '')).toHaveLength(4);
  });

  it('matches report name case-insensitively', () => {
    expect(filterReports(reports, 'invoice').map(r => r.ReportId)).toEqual([3]);
  });

  it('matches description case-insensitively', () => {
    expect(filterReports(reports, 'BALANCE').map(r => r.ReportId)).toEqual([1]);
  });

  it('matches category case-insensitively', () => {
    expect(filterReports(reports, 'customer service').map(r => r.ReportId)).toEqual([2]);
  });
});

describe('groupReports', () => {
  it('groups reports by category and sorts reports by name', () => {
    const groups = groupReports(reports);
    expect(groups.find(g => g.category === 'Account')?.reports.map(r => r.ReportName))
      .toEqual(['Invoice For SIG', 'Statement']);
  });

  it('places uncategorized reports in the fallback group', () => {
    expect(groupReports(reports).find(g => g.category === 'อื่น ๆ')?.reports.map(r => r.ReportId))
      .toEqual([4]);
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm test -- src/lib/__tests__/report-selector.test.ts
```

Expected: FAIL because `@/lib/report-selector` does not exist.

- [ ] **Step 3: Implement the minimal model**

Create `src/lib/report-selector.ts`:

```ts
export interface StandardReport {
  ReportId: number;
  ReportName: string;
  Description?: string | null;
  CategoryName?: string | null;
  CategoryColor?: string | null;
  IsHeavy?: boolean;
}

export interface ReportGroup {
  category: string;
  reports: StandardReport[];
}

const normalize = (value: string | null | undefined) => (value || '').trim().toLocaleLowerCase();

export function filterReports(reports: StandardReport[], query: string): StandardReport[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [...reports];

  return reports.filter(report =>
    [report.ReportName, report.Description, report.CategoryName]
      .some(value => normalize(value).includes(normalizedQuery))
  );
}

export function groupReports(reports: StandardReport[]): ReportGroup[] {
  const grouped = new Map<string, StandardReport[]>();

  for (const report of reports) {
    const category = report.CategoryName?.trim() || 'อื่น ๆ';
    grouped.set(category, [...(grouped.get(category) || []), report]);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'th'))
    .map(([category, categoryReports]) => ({
      category,
      reports: [...categoryReports].sort((left, right) =>
        left.ReportName.localeCompare(right.ReportName, 'th')
      ),
    }));
}
```

- [ ] **Step 4: Run targeted tests and verify GREEN**

Run:

```powershell
npm test -- src/lib/__tests__/report-selector.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit the model**

```powershell
git add -- src/lib/report-selector.ts src/lib/__tests__/report-selector.test.ts
git commit -m "test: define report selector filtering model"
```

---

### Task 2: Keyboard navigation behavior

**Files:**
- Modify: `src/lib/report-selector.ts`
- Modify: `src/lib/__tests__/report-selector.test.ts`

**Interfaces:**
- Consumes: result count and current active index from the future combobox.
- Produces: `getNextActiveIndex(currentIndex, resultCount, direction)` where `direction` is `1 | -1`.

- [ ] **Step 1: Write failing navigation tests**

Append to `src/lib/__tests__/report-selector.test.ts`:

```ts
import { getNextActiveIndex } from '@/lib/report-selector';

describe('getNextActiveIndex', () => {
  it('moves down from no active result to the first result', () => {
    expect(getNextActiveIndex(-1, 3, 1)).toBe(0);
  });

  it('wraps from the last result to the first result', () => {
    expect(getNextActiveIndex(2, 3, 1)).toBe(0);
  });

  it('wraps from the first result to the last result', () => {
    expect(getNextActiveIndex(0, 3, -1)).toBe(2);
  });

  it('returns -1 when there are no results', () => {
    expect(getNextActiveIndex(0, 0, 1)).toBe(-1);
  });
});
```

Consolidate the import into the existing import statement rather than leaving a duplicate import.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm test -- src/lib/__tests__/report-selector.test.ts
```

Expected: FAIL because `getNextActiveIndex` is not exported.

- [ ] **Step 3: Implement minimal navigation logic**

Append to `src/lib/report-selector.ts`:

```ts
export function getNextActiveIndex(
  currentIndex: number,
  resultCount: number,
  direction: 1 | -1,
): number {
  if (resultCount <= 0) return -1;
  if (currentIndex < 0) return direction === 1 ? 0 : resultCount - 1;
  return (currentIndex + direction + resultCount) % resultCount;
}
```

- [ ] **Step 4: Run targeted tests and verify GREEN**

Run:

```powershell
npm test -- src/lib/__tests__/report-selector.test.ts
```

Expected: 10 tests pass.

- [ ] **Step 5: Commit keyboard behavior**

```powershell
git add -- src/lib/report-selector.ts src/lib/__tests__/report-selector.test.ts
git commit -m "feat: add report selector keyboard navigation"
```

---

### Task 3: Searchable ReportSelector component

**Files:**
- Create: `src/components/ReportSelector.tsx`
- Uses: `src/lib/report-selector.ts`

**Interfaces:**
- Consumes:

```ts
export interface ReportSelectorProps {
  reports: StandardReport[];
  selectedReportId: string;
  favoriteIds: number[];
  isLoading: boolean;
  disabled?: boolean;
  onSelect: (reportId: string) => void;
  onToggleFavorite: (reportId: number) => void | Promise<void>;
}
```

- Produces: one accessible combobox that calls `onSelect` with an ID or `''` and calls `onToggleFavorite` only from explicit favorite actions.

- [ ] **Step 1: Create component state and derived data**

Create `src/components/ReportSelector.tsx` as a client component. Import `ChevronDown`, `FileText`, `Loader2`, `Search`, `Star`, `Tag`, and `X` from `lucide-react`; import the helpers and types from `@/lib/report-selector`.

Use these state boundaries:

```tsx
const [isOpen, setIsOpen] = useState(false);
const [query, setQuery] = useState('');
const [activeIndex, setActiveIndex] = useState(-1);
const rootRef = useRef<HTMLDivElement>(null);
const inputRef = useRef<HTMLInputElement>(null);

const selectedReport = reports.find(report => report.ReportId.toString() === selectedReportId);
const filteredReports = filterReports(reports, query);
const groups = groupReports(filteredReports);
const flatResults = groups.flatMap(group => group.reports);
const inputValue = isOpen ? query : selectedReport?.ReportName || '';
```

Add a document `mousedown` listener that closes the panel only when the event target is outside `rootRef`, and remove it during effect cleanup.

- [ ] **Step 2: Implement focus, search, selection, clear, and keyboard handlers**

Use explicit handlers with these behaviors:

```tsx
const openSelector = () => {
  if (disabled || isLoading) return;
  setIsOpen(true);
  setQuery('');
  setActiveIndex(flatResults.length > 0 ? 0 : -1);
};

const selectReport = (report: StandardReport) => {
  onSelect(report.ReportId.toString());
  setQuery('');
  setIsOpen(false);
  setActiveIndex(-1);
};

const clearSelection = (event: React.MouseEvent) => {
  event.stopPropagation();
  onSelect('');
  setQuery('');
  setIsOpen(false);
  inputRef.current?.focus();
};
```

`onKeyDown` must handle `ArrowDown`, `ArrowUp`, `Enter`, and `Escape`; prevent default only for handled keys. Use `getNextActiveIndex` for arrows and `flatResults[activeIndex]` for Enter.

- [ ] **Step 3: Render the accessible field and selected metadata**

Use label ID `standard-report-label`, listbox ID `standard-report-listbox`, and option IDs `standard-report-option-${ReportId}`. The input must include:

```tsx
role="combobox"
aria-labelledby="standard-report-label"
aria-controls="standard-report-listbox"
aria-expanded={isOpen}
aria-autocomplete="list"
aria-activedescendant={activeIndex >= 0 ? `standard-report-option-${flatResults[activeIndex].ReportId}` : undefined}
```

The closed field must show only the selected report name. Put the category badge and selected description below the field. Give long names `truncate` plus `title={selectedReport.ReportName}`. Keep a separate favorite button beside the field with an accessible label matching the existing Thai favorite copy.

- [ ] **Step 4: Render loading, empty, no-results, and grouped results**

Render an absolutely positioned panel under the field with `z-50`, `max-h-80`, `overflow-y-auto`, border, shadow, light/dark surfaces, and these states:

```tsx
isLoading
  ? 'กำลังโหลดรายงาน...'
  : reports.length === 0
    ? 'ยังไม่มีรายงานที่ใช้งานได้'
    : flatResults.length === 0
      ? `ไม่พบรายงานที่ตรงกับ “${query}”`
      : grouped options
```

For each group, render a small sticky category heading and option rows. Each option shows report name, optional one-line description, and a compact category badge. Use `aria-selected` and the active index to apply the blue active treatment.

- [ ] **Step 5: Run focused static checks**

Run:

```powershell
npx eslint src/components/ReportSelector.tsx src/lib/report-selector.ts src/lib/__tests__/report-selector.test.ts
npm test -- src/lib/__tests__/report-selector.test.ts
```

Expected: targeted lint exits 0 and 10 tests pass.

- [ ] **Step 6: Commit the component**

```powershell
git add -- src/components/ReportSelector.tsx
git commit -m "feat: add searchable report selector component"
```

---

### Task 4: Integrate selector into the standard report page

**Files:**
- Modify: `src/app/(dashboard)/reports/standard/page.tsx:3-45`
- Modify: `src/app/(dashboard)/reports/standard/page.tsx:421-537`
- Uses: `src/components/ReportSelector.tsx`

**Interfaces:**
- Consumes: `ReportSelectorProps` from Task 3.
- Preserves: `selectedReportId` and the existing parameter-loading effect at lines 116-147.

- [ ] **Step 1: Replace obsolete imports and state**

Import `ReportSelector` and remove selector-only icon imports that become unused (`ChevronDown` and `Tag`, subject to final lint). Remove:

```tsx
const [searchQuery, setSearchQuery] = useState('');
const [selectedCategory, setSelectedCategory] = useState('');
```

Do not change `selectedReportId`, `favoriteIds`, report fetching, or `toggleFavorite`.

- [ ] **Step 2: Replace category/search/select markup**

Keep the pinned favorite block at lines 423-445. Remove the category-chip IIFE and the separate search/native-select block. Render:

```tsx
<div className="w-full max-w-2xl">
  <ReportSelector
    reports={reports}
    selectedReportId={selectedReportId}
    favoriteIds={favoriteIds}
    isLoading={isLoadingReports}
    disabled={isExecuting}
    onSelect={setSelectedReportId}
    onToggleFavorite={toggleFavorite}
  />
</div>
```

Keep the dynamic filters section immediately after this selector so the existing selection effect and filter reveal behavior remain unchanged.

- [ ] **Step 3: Verify TypeScript, targeted lint, and tests**

Run:

```powershell
npx eslint 'src/app/(dashboard)/reports/standard/page.tsx' src/components/ReportSelector.tsx src/lib/report-selector.ts src/lib/__tests__/report-selector.test.ts
npm test -- src/lib/__tests__/report-selector.test.ts
npm run build
```

Expected: the new files introduce no lint errors, selector tests pass, and the production build exits 0. If the existing page still reports pre-existing `no-explicit-any` or unused-import issues unrelated to the changed selector block, record them separately and confirm no new selector-specific lint errors.

- [ ] **Step 4: Commit integration**

```powershell
git add -- 'src/app/(dashboard)/reports/standard/page.tsx' src/components/ReportSelector.tsx src/lib/report-selector.ts src/lib/__tests__/report-selector.test.ts
git commit -m "feat: improve standard report selection"
```

---

### Task 5: Browser verification and bounded polish

**Files:**
- Modify only if defects are found: `src/components/ReportSelector.tsx`
- Modify only if integration defects are found: `src/app/(dashboard)/reports/standard/page.tsx`

**Interfaces:**
- Consumes: completed implementation from Tasks 1-4.
- Produces: visually verified selector at desktop and narrow viewport widths.

- [ ] **Step 1: Start the local server and authenticate normally**

Run `npm run dev`, open `/reports/standard`, and use the existing authenticated development session. Do not bypass authentication or create data.

- [ ] **Step 2: Verify desktop states in one inspection pass**

At the normal desktop viewport, capture and inspect:

- Default closed state.
- Open grouped list with all 20 reports.
- Search matching name, description, and category.
- No-results state.
- Selected long-name report showing truncated title, separate category badge, and separate description.
- Favorite shortcut selection and selected favorite button state.
- Clear selection returning to the empty filter state.
- Arrow navigation, Enter selection, and Escape close.

- [ ] **Step 3: Verify narrow viewport in the same inspection pass**

At approximately 390px width, confirm:

- The field uses available width without horizontal overflow.
- The result panel remains within the viewport.
- Long names and descriptions do not overlap category or action controls.
- Favorite shortcuts wrap cleanly.

- [ ] **Step 4: Apply one batched polish fix if needed**

Fix all defects discovered in Steps 2-3 together. Do not expand scope beyond the selector. Then perform one confirmation pass at desktop and narrow widths.

- [ ] **Step 5: Run final verification**

Run:

```powershell
npm test
npm run build
git diff --check
git status --short --branch
```

Expected: 0 test failures, build exit 0, no whitespace errors, and only intentional source/test changes or a clean tree after commits.

- [ ] **Step 6: Commit any polish changes**

If Step 4 changed files:

```powershell
git add -- src/components/ReportSelector.tsx 'src/app/(dashboard)/reports/standard/page.tsx'
git commit -m "fix: polish report selector interactions"
```

