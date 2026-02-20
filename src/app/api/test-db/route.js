import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB, connectToCompanyDB } from '@/lib/db';

export async function GET(request) {
    const results = [];

    // 1. Test Central DB
    try {
        const pool = await connectToCentralDB();
        await pool.request().query('SELECT 1 as result');
        results.push({ db: 'Central (ReportCenterDB)', status: 'OK' });
    } catch (err) {
        results.push({ db: 'Central (ReportCenterDB)', status: 'FAILED', error: err.message });
    }

    // 2. Test Company 1
    try {
        const pool = await connectToCompanyDB(1);
        await pool.request().query('SELECT 1 as result');
        results.push({ db: 'Company 1 (SONIC)', status: 'OK' });
    } catch (err) {
        results.push({ db: 'Company 1 (SONIC)', status: 'FAILED', error: err.message });
    }

    // 3. Test Company 2
    try {
        const pool = await connectToCompanyDB(2);
        await pool.request().query('SELECT 1 as result');
        results.push({ db: 'Company 2 (GLINK)', status: 'OK' });
    } catch (err) {
        results.push({ db: 'Company 2 (GLINK)', status: 'FAILED', error: err.message });
    }

    // 4. Test Company 3
    try {
        const pool = await connectToCompanyDB(3);
        await pool.request().query('SELECT 1 as result');
        results.push({ db: 'Company 3 (AUTOLOGIS)', status: 'OK' });
    } catch (err) {
        results.push({ db: 'Company 3 (AUTOLOGIS)', status: 'FAILED', error: err.message });
    }

    return NextResponse.json({ testResults: results });
}
