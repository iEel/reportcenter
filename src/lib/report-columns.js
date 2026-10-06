/**
 * Column names in SQL SELECT order. mssql gives each column's position as `index`;
 * Object.keys would move numeric-like names ("1", "10") ahead of the others.
 * @param {Record<string, { index?: number }> | null | undefined} metadata recordset.columns
 * @returns {string[]}
 */
export function orderedColumns(metadata) {
    if (!metadata) return [];
    return Object.entries(metadata)
        .sort((a, b) => (a[1].index ?? 0) - (b[1].index ?? 0))
        .map(([name]) => name)
        .filter(name => name !== '_rowNum');
}
