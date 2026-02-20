const fetch = require('node-fetch');

async function testCreateReport() {
    const payload = {
        report: {
            ReportName: "Admin Test Template Report",
            Description: "Test System Email template saving",
            ReportType: 2,
            TSqlQuery: "SELECT * FROM Users",
            EmailTemplateContent: "Hello {{FullName}}, your username is {{Username}}",
            IsPublic: true,
            IsActive: true
        },
        parameters: [
            {
                ParameterName: "@CompanyId",
                DisplayLabel: "Select Company",
                InputType: "number",
                OrderIndex: 1
            }
        ]
    };

    try {
        const fetchFn = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
        const response = await fetchFn('http://localhost:3000/api/admin/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        console.log("Response:", data);
    } catch (e) {
        console.error("Error:", e);
    }
}

testCreateReport();
