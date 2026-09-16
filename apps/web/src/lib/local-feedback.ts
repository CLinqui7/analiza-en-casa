import { feedbackReportSchema, type FeedbackInput, type FeedbackReport } from '@/lib/feedback';

type StoredFeedback = FeedbackReport & { userId: string; image?: Blob };
const databaseName = 'analiza-en-casa-feedback';
const storeName = 'reports';

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('No pudimos abrir el almacenamiento del navegador.'));
  });
}

export async function listLocalFeedback(userId: string): Promise<FeedbackReport[]> {
  const db = await database();
  try {
    const rows = await new Promise<StoredFeedback[]>((resolve, reject) => {
      const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result as StoredFeedback[]);
      request.onerror = () => reject(new Error('No pudimos cargar tus reportes.'));
    });
    return rows
      .filter((row) => row.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((row) => feedbackReportSchema.parse(row));
  } finally {
    db.close();
  }
}

export async function saveLocalFeedback(
  userId: string,
  input: FeedbackInput,
  image?: File,
): Promise<FeedbackReport> {
  const report: FeedbackReport = {
    ...input,
    id: crypto.randomUUID(),
    imageName: image?.name,
    imageMime: image?.type,
    createdAt: new Date().toISOString(),
    status: 'NEW',
  };
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db
        .transaction(storeName, 'readwrite')
        .objectStore(storeName)
        .put({ ...report, userId, image } satisfies StoredFeedback);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('No pudimos guardar tu reporte.'));
    });
    return report;
  } finally {
    db.close();
  }
}
