import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../..');

function sourceFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
        return /\.(js|ts|tsx)$/.test(entry.name) ? [full] : [];
    });
}

describe('number report parameters', () => {
    // A bare sql.Decimal is declared decimal(18, 0) by tedious and rounds 12.5 to 13; use numberParameterType()
    it('are never bound with sql.Decimal without a scale', () => {
        const offenders = sourceFiles(SRC)
            .filter(file => /sql\.Decimal\s*,/.test(fs.readFileSync(file, 'utf8')))
            .map(file => path.relative(SRC, file));
        expect(offenders).toEqual([]);
    });
});
