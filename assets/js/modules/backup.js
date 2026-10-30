import { getAll, replaceAllData } from "../database/database.js";

const STORES = ["vehicles", "inspections", "settings"];

export async function exportBackup() {
  const backup = {
    application: "gestao-frotas",
    version: "0.1.0",
    exportedAt: new Date().toISOString(),
    data: {}
  };

  for (const store of STORES) backup.data[store] = await getAll(store);

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gestao-frotas-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importBackup(file) {
  const parsed = JSON.parse(await file.text());
  if (parsed.application !== "gestao-frotas" || !parsed.data) {
    throw new Error("O arquivo selecionado não é um backup válido do Gestão de Frotas.");
  }

  for (const store of STORES) {
    if (!Array.isArray(parsed.data[store])) {
      throw new Error("O arquivo de backup está incompleto ou possui formato incompatível.");
    }
  }

  await replaceAllData(parsed.data);
}
