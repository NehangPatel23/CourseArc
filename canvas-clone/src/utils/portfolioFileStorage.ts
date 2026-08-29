export type StoredPortfolioFile = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
};

const PORTFOLIO_FILE_PREFIX = "canvasClone:portfolioFile:";
const MAX_STORE_BYTES = 4 * 1024 * 1024;

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function savePortfolioFile(entryId: string, file: StoredPortfolioFile): boolean {
  try {
    if (file.size > MAX_STORE_BYTES) return false;
    window.localStorage.setItem(`${PORTFOLIO_FILE_PREFIX}${entryId}`, JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
}

export async function savePortfolioFileFromUpload(
  entryId: string,
  file: File,
): Promise<{ saved: boolean; tooLarge: boolean }> {
  if (file.size > MAX_STORE_BYTES) {
    return { saved: false, tooLarge: true };
  }
  const dataUrl = await readFileAsDataUrl(file);
  const saved = savePortfolioFile(entryId, {
    dataUrl,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  });
  return { saved, tooLarge: false };
}

export function getPortfolioFile(entryId: string): StoredPortfolioFile | null {
  try {
    const raw = window.localStorage.getItem(`${PORTFOLIO_FILE_PREFIX}${entryId}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredPortfolioFile;
  } catch {
    return null;
  }
}

export function deletePortfolioFile(entryId: string) {
  try {
    window.localStorage.removeItem(`${PORTFOLIO_FILE_PREFIX}${entryId}`);
  } catch {}
}

export function downloadPortfolioFile(stored: StoredPortfolioFile) {
  const link = document.createElement("a");
  link.href = stored.dataUrl;
  link.download = stored.fileName;
  link.click();
}
