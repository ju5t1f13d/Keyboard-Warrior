const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("keyboardWarrior", {
    loadData: () => ipcRenderer.invoke("load-data"),
    saveData: (data) => ipcRenderer.invoke("save-data", data),
    renameSession: (id, name) => ipcRenderer.invoke("rename-session", id, name),
    deleteSession: (id) => ipcRenderer.invoke("delete-session", id),
    exportSessionPdf: (sessionId) => ipcRenderer.invoke("export-session-pdf", sessionId),
    startSession: () => ipcRenderer.invoke("start-session"),
    endSession: () => ipcRenderer.invoke("end-session")
});