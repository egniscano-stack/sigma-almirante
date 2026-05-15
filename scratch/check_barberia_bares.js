import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante/barberia.xlsx';
if (fs.existsSync(filePath)) {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    console.log("BARBERIA HEADERS/ROWS:");
    rows.slice(0, 10).forEach((r, i) => console.log(i, r));
}

const filePath2 = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante/bares.xlsx';
if (fs.existsSync(filePath2)) {
    const fileBuffer = fs.readFileSync(filePath2);
    const workbook = XLSX.read(fileBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    console.log("\nBARES HEADERS/ROWS:");
    rows.slice(0, 10).forEach((r, i) => console.log(i, r));
}
