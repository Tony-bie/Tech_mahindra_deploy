require('dotenv').config();

const { validateEnv } = require('./src/config/env');
validateEnv();

const app = require('./src/app');

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
    console.log('Press Ctrl+C to quit.');
});

