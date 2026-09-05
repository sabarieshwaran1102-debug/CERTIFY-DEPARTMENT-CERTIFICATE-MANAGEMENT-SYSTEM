import app from './src/app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.listen(PORT, () => {
    console.log(`Certificate Management System API`);
    console.log(`Running on http://localhost:${PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
});
