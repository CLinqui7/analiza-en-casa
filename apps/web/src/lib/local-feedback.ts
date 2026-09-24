import {
  feedbackReportSchema,
  feedbackResolutionSchema,
  type FeedbackInput,
  type FeedbackReport,
  type FeedbackResolution,
} from '@/lib/feedback';

type StoredFeedback = FeedbackReport & { userId: string; image?: Blob };
const databaseName = 'analiza-en-casa-feedback';
const storeName = 'reports';

function publicReport(row: StoredFeedback): FeedbackReport {
  return feedbackReportSchema.parse({
    id: row.id,
    module: row.module,
    category: row.category,
    description: row.description,
    imageName: row.imageName,
    imageMime: row.imageMime,
    createdAt: row.createdAt,
    status: row.status,
    resolutionComment: row.resolutionComment,
    resolutionPath: row.resolutionPath,
    resolvedAt: row.resolvedAt,
  });
}

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
      .map(publicReport);
  } finally {
    db.close();
  }
}

export async function updateLocalFeedback(
  userId: string,
  id: string,
  resolution: FeedbackResolution,
): Promise<FeedbackReport | null> {
  const parsed = feedbackResolutionSchema.parse(resolution);
  const db = await database();
  try {
    return await new Promise<FeedbackReport | null>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      request.onerror = () => reject(new Error('No pudimos cargar el reporte.'));
      request.onsuccess = () => {
        const current = request.result as StoredFeedback | undefined;
        if (!current || current.userId !== userId) {
          resolve(null);
          return;
        }
        const updated: StoredFeedback = {
          ...current,
          status: parsed.status,
          resolutionComment: parsed.resolutionComment,
          resolutionPath: parsed.resolutionPath,
          resolvedAt:
            parsed.status === 'RESOLVED'
              ? (current.resolvedAt ?? new Date().toISOString())
              : undefined,
        };
        const write = store.put(updated);
        write.onerror = () => reject(new Error('No pudimos actualizar el reporte.'));
        write.onsuccess = () => resolve(publicReport(updated));
      };
    });
  } finally {
    db.close();
  }
}

export async function removeLocalFeedback(userId: string, id: string): Promise<boolean> {
  const db = await database();
  try {
    return await new Promise<boolean>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      request.onerror = () => reject(new Error('No pudimos cargar el reporte.'));
      request.onsuccess = () => {
        const current = request.result as StoredFeedback | undefined;
        if (!current || current.userId !== userId) {
          resolve(false);
          return;
        }
        const remove = store.delete(id);
        remove.onerror = () => reject(new Error('No pudimos eliminar el reporte.'));
        remove.onsuccess = () => resolve(true);
      };
    });
  } finally {
    db.close();
  }
}

export async function getLocalFeedbackImage(userId: string, id: string): Promise<Blob | null> {
  const db = await database();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(id);
      request.onerror = () => reject(new Error('No pudimos abrir la imagen.'));
      request.onsuccess = () => {
        const current = request.result as StoredFeedback | undefined;
        resolve(current?.userId === userId && current.image instanceof Blob ? current.image : null);
      };
    });
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
