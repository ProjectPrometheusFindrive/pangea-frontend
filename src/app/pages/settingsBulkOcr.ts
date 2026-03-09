interface BulkOcrAccessOptions {
  canEditSettings: boolean;
  canWriteAssets: boolean;
}

export function canAccessBulkOcr({
  canEditSettings,
  canWriteAssets,
}: BulkOcrAccessOptions): boolean {
  return canEditSettings || canWriteAssets;
}
