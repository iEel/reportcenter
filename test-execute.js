async function testExecute() {
    try {
        const fetchFn = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
        const res = await fetchFn('http://localhost:3000/api/reports/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reportId: 1,
                companyId: 1,
                parameters: {
                    '@StartDate': '2023-01-01',
                    '@EndDate': '2023-12-31'
                }
            })
        });
        const data = await res.json();
        console.log(data);
    } catch (e) {
        console.error(e);
    }
}
testExecute();
