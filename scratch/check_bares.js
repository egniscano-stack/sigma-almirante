import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = '/Users/egniscanorodrigues/Desktop/Municipio de Almirante/bares.xlsx';
if (fs.existsSync(filePath)) {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    console.log("Total rows in BARES:", rows.length);
    console.log("Sample row 2:", rows[2]);
    console.log("Sample row 3:", rows[3]);
} else {
    console.log("BARES NOT FOUND");
}
