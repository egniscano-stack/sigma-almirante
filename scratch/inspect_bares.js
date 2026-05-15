
import XLSX from 'xlsx';
import path from 'path';

const filePath = '/Users/egniscanorodrigues/Desktop/municipio de almirante/bares.xlsx';

function inspectBares() {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`Structure of bares.xlsx:`);
    console.log(JSON.stringify(data.slice(0, 3), null, 2));
  } catch (err) {
    console.error('Error reading file:', err.message);
  }
}

inspectBares();
