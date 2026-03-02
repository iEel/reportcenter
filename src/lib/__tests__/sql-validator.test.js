import { describe, it, expect } from 'vitest';
import { validateQuery, getBlockedCommandsList } from '@/lib/sql-validator';

describe('sql-validator.js', () => {

    // ─── SAFE QUERIES ───────────────────────────────────────────

    describe('safe queries (should pass)', () => {
        it('allows simple SELECT', () => {
            const result = validateQuery('SELECT * FROM Orders');
            expect(result.safe).toBe(true);
        });

        it('allows SELECT with WHERE', () => {
            const result = validateQuery("SELECT Name, Amount FROM Invoices WHERE Status = 'Active'");
            expect(result.safe).toBe(true);
        });

        it('allows SELECT with JOIN', () => {
            const result = validateQuery(`
                SELECT o.OrderNo, c.CustomerName
                FROM Orders o
                INNER JOIN Customers c ON o.CustomerId = c.Id
                WHERE o.OrderDate >= '2026-01-01'
            `);
            expect(result.safe).toBe(true);
        });

        it('allows SELECT with GROUP BY and HAVING', () => {
            const result = validateQuery(`
                SELECT Department, COUNT(*) AS Total
                FROM Employees
                GROUP BY Department
                HAVING COUNT(*) > 5
                ORDER BY Total DESC
            `);
            expect(result.safe).toBe(true);
        });

        it('allows CTE queries', () => {
            const result = validateQuery(`
                ;WITH CTE AS (
                    SELECT ROW_NUMBER() OVER (ORDER BY Id) AS RowNum, *
                    FROM Products
                )
                SELECT * FROM CTE WHERE RowNum BETWEEN 1 AND 50
            `);
            expect(result.safe).toBe(true);
        });

        it('allows subqueries', () => {
            const result = validateQuery(`
                SELECT * FROM Orders
                WHERE CustomerId IN (SELECT Id FROM Customers WHERE Region = 'East')
            `);
            expect(result.safe).toBe(true);
        });

        it('allows aggregate functions', () => {
            const result = validateQuery('SELECT SUM(Amount), AVG(Price), MAX(Qty) FROM Sales');
            expect(result.safe).toBe(true);
        });

        it('allows CASE WHEN expressions', () => {
            const result = validateQuery(`
                SELECT Name,
                       CASE WHEN Status = 1 THEN 'Active' ELSE 'Inactive' END AS StatusText
                FROM Products
            `);
            expect(result.safe).toBe(true);
        });

        it('allows TOP N queries', () => {
            const result = validateQuery('SELECT TOP 100 * FROM Logs ORDER BY CreatedAt DESC');
            expect(result.safe).toBe(true);
        });
    });

    // ─── BLOCKED DML ────────────────────────────────────────────

    describe('blocked DML commands', () => {
        it('blocks INSERT', () => {
            const result = validateQuery("INSERT INTO Users VALUES ('hacker', '123')");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('INSERT');
        });

        it('blocks UPDATE', () => {
            const result = validateQuery("UPDATE Users SET IsActive = 0");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('UPDATE');
        });

        it('blocks DELETE', () => {
            const result = validateQuery("DELETE FROM Orders WHERE Id = 1");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('DELETE');
        });

        it('blocks MERGE', () => {
            const result = validateQuery("MERGE INTO Target USING Source ON Target.Id = Source.Id WHEN MATCHED THEN UPDATE SET Name = Source.Name");
            expect(result.safe).toBe(false);
            // Note: blockedTerm may be MERGE or UPDATE depending on which keyword is matched first
        });

        it('blocks TRUNCATE', () => {
            const result = validateQuery("TRUNCATE TABLE Logs");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('TRUNCATE');
        });
    });

    // ─── BLOCKED DDL ────────────────────────────────────────────

    describe('blocked DDL commands', () => {
        it('blocks CREATE TABLE', () => {
            const result = validateQuery("CREATE TABLE Hack (Id INT)");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('CREATE');
        });

        it('blocks ALTER TABLE', () => {
            const result = validateQuery("ALTER TABLE Users ADD HackColumn INT");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('ALTER');
        });

        it('blocks DROP TABLE', () => {
            const result = validateQuery("DROP TABLE Users");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('DROP');
        });
    });

    // ─── BLOCKED ADMIN COMMANDS ─────────────────────────────────

    describe('blocked admin commands', () => {
        it('blocks BACKUP', () => {
            const result = validateQuery("BACKUP DATABASE TestDB TO DISK = 'backup.bak'");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('BACKUP');
        });

        it('blocks RESTORE', () => {
            const result = validateQuery("RESTORE DATABASE TestDB FROM DISK = 'backup.bak'");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('RESTORE');
        });

        it('blocks DBCC', () => {
            const result = validateQuery("DBCC CHECKDB");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('DBCC');
        });

        it('blocks SHUTDOWN', () => {
            const result = validateQuery("SHUTDOWN WITH NOWAIT");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('SHUTDOWN');
        });

        it('blocks GRANT', () => {
            const result = validateQuery("GRANT SELECT ON Users TO public");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('GRANT');
        });
    });

    // ─── BLOCKED METADATA / SYSTEM OBJECTS ──────────────────────

    describe('blocked metadata access', () => {
        it('blocks INFORMATION_SCHEMA', () => {
            const result = validateQuery("SELECT * FROM INFORMATION_SCHEMA.TABLES");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toMatch(/INFORMATION_SCHEMA/i);
        });

        it('blocks sys.tables', () => {
            const result = validateQuery("SELECT * FROM sys.tables");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toMatch(/sys/i);
        });

        it('blocks sysobjects', () => {
            const result = validateQuery("SELECT * FROM sysobjects WHERE xtype = 'U'");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toMatch(/sysobjects/i);
        });

        it('blocks master database access', () => {
            const result = validateQuery("SELECT * FROM master.dbo.syslogins");
            expect(result.safe).toBe(false);
        });

        it('blocks tempdb access', () => {
            const result = validateQuery("SELECT * FROM tempdb.dbo.sysobjects");
            expect(result.safe).toBe(false);
        });

        it('blocks msdb access', () => {
            const result = validateQuery("SELECT * FROM msdb.dbo.sysjobs");
            expect(result.safe).toBe(false);
        });

        it('blocks model database access', () => {
            const result = validateQuery("SELECT * FROM model.dbo.tables");
            expect(result.safe).toBe(false);
        });
    });

    // ─── BLOCKED STORED PROCEDURES ──────────────────────────────

    describe('blocked stored procedures', () => {
        it('blocks xp_cmdshell', () => {
            const result = validateQuery("EXEC xp_cmdshell 'dir'");
            expect(result.safe).toBe(false);
        });

        it('blocks sp_executesql', () => {
            const result = validateQuery("EXEC sp_executesql N'SELECT 1'");
            expect(result.safe).toBe(false);
        });

        it('blocks EXEC with parentheses', () => {
            const result = validateQuery("EXEC('SELECT * FROM Users')");
            expect(result.safe).toBe(false);
        });

        it('blocks EXECUTE with function', () => {
            const result = validateQuery("EXECUTE sp_help 'Users'");
            expect(result.safe).toBe(false);
        });

        it('blocks sp_OACreate', () => {
            const result = validateQuery("EXEC sp_OACreate 'WScript.Shell'");
            expect(result.safe).toBe(false);
        });
    });

    // ─── BLOCKED REMOTE SOURCES ─────────────────────────────────

    describe('blocked remote data sources', () => {
        it('blocks OPENROWSET', () => {
            const result = validateQuery("SELECT * FROM OPENROWSET('SQLNCLI', 'Server=hack;', 'SELECT 1')");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toMatch(/OPENROWSET/i);
        });

        it('blocks OPENDATASOURCE', () => {
            const result = validateQuery("SELECT * FROM OPENDATASOURCE('SQLNCLI', 'Server=hack')..Table1");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toMatch(/OPENDATASOURCE/i);
        });

        it('blocks OPENQUERY', () => {
            const result = validateQuery("SELECT * FROM OPENQUERY(LinkedServer, 'SELECT 1')");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toMatch(/OPENQUERY/i);
        });
    });

    // ─── BLOCKED OTHER PATTERNS ─────────────────────────────────

    describe('blocked other dangerous patterns', () => {
        it('blocks SELECT INTO', () => {
            const result = validateQuery("SELECT * INTO NewTable FROM OldTable");
            expect(result.safe).toBe(false);
        });

        it('blocks WAITFOR DELAY (DoS)', () => {
            const result = validateQuery("WAITFOR DELAY '00:00:10'");
            expect(result.safe).toBe(false);
        });

        it('blocks PasswordHash access', () => {
            const result = validateQuery("SELECT Username, PasswordHash FROM Users");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toMatch(/PasswordHash/i);
        });

        it('blocks ReportCenterDB access', () => {
            const result = validateQuery("SELECT * FROM ReportCenterDB.dbo.Users");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toMatch(/ReportCenterDB/i);
        });
    });

    // ─── BYPASS PREVENTION ──────────────────────────────────────

    describe('bypass prevention', () => {
        it('blocks commands hidden in block comments', () => {
            const result = validateQuery("SELECT /* */ 1; DROP TABLE Users");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('DROP');
        });

        it('blocks commands hidden after line comments', () => {
            const result = validateQuery("SELECT 1 -- safe\nDELETE FROM Users");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('DELETE');
        });

        it('blocks commands with mixed case', () => {
            const result = validateQuery("DeLeTe FROM Orders");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('DELETE');
        });

        it('blocks commands with extra whitespace', () => {
            const result = validateQuery("  INSERT   INTO  Users  VALUES  ('x')  ");
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('INSERT');
        });

        it('blocks hex-encoded obfuscation', () => {
            // Build query with literal backslash-backslash-x pattern
            // String.fromCharCode(92) = backslash, need two of them for the validator regex
            const bs = String.fromCharCode(92);
            const q = 'SELECT ' + bs + bs + 'x41 FROM Users';
            const result = validateQuery(q);
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('encoded chars');
        });

        it('blocks unicode-encoded obfuscation', () => {
            const bs = String.fromCharCode(92);
            const q = 'SELECT ' + bs + bs + 'u0041 FROM Users';
            const result = validateQuery(q);
            expect(result.safe).toBe(false);
            expect(result.blockedTerm).toBe('encoded chars');
        });

        it('does NOT block keyword inside string literal', () => {
            // DELETE inside a string should be safe — validator strips strings first
            const result = validateQuery("SELECT * FROM Logs WHERE Action = 'DELETE'");
            expect(result.safe).toBe(true);
        });

        it('does NOT block keyword inside block comment', () => {
            // DROP inside a comment should be safe
            const result = validateQuery("SELECT /* DROP TABLE */ Name FROM Products");
            expect(result.safe).toBe(true);
        });
    });

    // ─── EDGE CASES ─────────────────────────────────────────────

    describe('edge cases', () => {
        it('rejects null query', () => {
            const result = validateQuery(null);
            expect(result.safe).toBe(false);
            expect(result.reason).toMatch(/empty|invalid/i);
        });

        it('rejects undefined query', () => {
            const result = validateQuery(undefined);
            expect(result.safe).toBe(false);
        });

        it('rejects empty string', () => {
            const result = validateQuery('');
            expect(result.safe).toBe(false);
        });

        it('rejects non-string input', () => {
            const result = validateQuery(12345);
            expect(result.safe).toBe(false);
        });
    });

    // ─── getBlockedCommandsList ──────────────────────────────────

    describe('getBlockedCommandsList', () => {
        it('returns all categories', () => {
            const list = getBlockedCommandsList();
            expect(list).toHaveProperty('dml');
            expect(list).toHaveProperty('ddl');
            expect(list).toHaveProperty('metadata');
            expect(list).toHaveProperty('procedures');
            expect(list).toHaveProperty('remote');
            expect(list).toHaveProperty('other');
        });

        it('dml includes core DML commands', () => {
            const list = getBlockedCommandsList();
            expect(list.dml).toContain('INSERT');
            expect(list.dml).toContain('UPDATE');
            expect(list.dml).toContain('DELETE');
        });

        it('ddl includes core DDL commands', () => {
            const list = getBlockedCommandsList();
            expect(list.ddl).toContain('CREATE');
            expect(list.ddl).toContain('ALTER');
            expect(list.ddl).toContain('DROP');
        });
    });
});
