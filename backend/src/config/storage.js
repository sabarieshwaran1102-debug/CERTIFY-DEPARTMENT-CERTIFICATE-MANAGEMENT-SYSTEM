import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../storage/certificates');

// Ensure storage directory exists
if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
}

export const getStoragePath = () => storagePath;

export const getCertificateSubdirectory = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return path.join(storagePath, year.toString(), month);
};

export const ensureStorageDirectory = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

export const getStoragePathForFile = (registerNumber, registrationNumber, extension) => {
    const date = new Date();
    const subdir = getCertificateSubdirectory(date);
    ensureStorageDirectory(subdir);
    const filename = `${registerNumber}_${registrationNumber}.${extension}`;
    return path.join(subdir, filename);
};
