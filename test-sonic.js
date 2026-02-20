const sql = require('mssql');

const config = {
    user: 'smf',
    password: 'smf@3564',
    server: '192.168.110.200',
    database: 'SONIC2021',
    options: {
        instanceName: 'SONIC',
        encrypt: false,
        trustServerCertificate: true
    }
};

sql.connect(config).then(pool => {
    console.log("Connected to SONIC2021 successfully!");
    return pool.close();
}).catch(err => {
    console.error("SONIC Error: ", err);
});
