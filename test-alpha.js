const sql = require('mssql');

const config = {
    user: 'sa',
    password: 'Sonic@rama3',
    server: '192.168.110.106',
    database: 'master',
    options: {
        instanceName: 'alpha',
        encrypt: false,
        trustServerCertificate: true
    }
};

sql.connect(config).then(pool => {
    console.log("Connected to alpha successfully!");
    return pool.close();
}).catch(err => {
    console.error("Alpha Error: ", err);
});
