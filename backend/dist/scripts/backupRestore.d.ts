#!/usr/bin/env node
declare function backupData(outputPath?: string): Promise<string>;
declare function restoreData(backupPath: string, options?: {
    clearExisting?: boolean;
    sheetsToRestore?: string[];
}): Promise<void>;
declare function listBackups(backupDir?: string): string[];
export { backupData, restoreData, listBackups };
//# sourceMappingURL=backupRestore.d.ts.map