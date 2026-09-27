import { collection, addDoc, getDocs, query, orderBy, Timestamp, limit, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

export interface ExportLog {
  id: string;
  fileName: string;
  reportType: string;
  generatedBy: string;
  createdAt: any;
}

// Fetch the 15 most recent export logs
export async function getRecentExports(): Promise<ExportLog[]> {
  const exportsRef = collection(db, 'export_logs');
  const q = query(exportsRef, orderBy('createdAt', 'desc'), limit(15));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as ExportLog[];
}

// Log a new export to the database
export async function logExport(fileName: string, reportType: string, generatedBy: string): Promise<void> {
  const exportsRef = collection(db, 'export_logs');
  await addDoc(exportsRef, {
    fileName,
    reportType,
    generatedBy,
    createdAt: Timestamp.now()
  });
}

// Delete a single log
export async function deleteExportLog(id: string): Promise<void> {
  const docRef = doc(db, 'export_logs', id);
  await deleteDoc(docRef);
}

// Clear all logs
export async function clearAllExportLogs(): Promise<void> {
  const snapshot = await getDocs(collection(db, 'export_logs'));
  const batch = writeBatch(db);
  snapshot.docs.forEach(document => {
    batch.delete(document.ref);
  });
  await batch.commit();
}

// Universal CSV Generator
export function downloadCSV(data: any[], fileName: string) {
  if (!data || data.length === 0) return false;

  const separator = ',';
  const keys = Object.keys(data[0]);
  
  const csvContent = [
    keys.join(separator), // Header row
    ...data.map(row => 
      keys.map(k => {
        let cell = row[k] === null || row[k] === undefined ? '' : row[k];
        cell = cell.toString().replace(/"/g, '""');
        if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
        return cell;
      }).join(separator)
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }
  return false;
}