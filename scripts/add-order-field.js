import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../static/subcategories.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const updated = data.map((item, index) => ({
  ...item,
  order: item.order !== undefined ? item.order : index
}));

fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
console.log('✅ Added order field to all subcategories');