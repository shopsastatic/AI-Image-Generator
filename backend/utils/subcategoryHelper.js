import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const subcategoriesPath = path.join(__dirname, '..', 'static', 'subcategories.json');

export const updateSubcategoryRoles = (subcategoryId, allowedRoles) => {
  const subcategories = JSON.parse(fs.readFileSync(subcategoriesPath, 'utf8'));
  const index = subcategories.findIndex(s => s.id === subcategoryId);
  
  if (index !== -1) {
    subcategories[index].allowedRoles = allowedRoles;
    subcategories[index].lastModified = new Date().toISOString();
    fs.writeFileSync(subcategoriesPath, JSON.stringify(subcategories, null, 2));
    return true;
  }
  return false;
};