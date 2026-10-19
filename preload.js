const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("keyboardWarrior", {
    loadData: () => ipcRenderer.invoke("load-data"),
    saveData: (data) => ipcRenderer.invoke("save-data", data),
    renameSession: (id, name) => ipcRenderer.invoke("rename-session", id, name),
    startSession: () => ipcRenderer.invoke("start-session"),
    endSession: () => ipcRenderer.invoke("end-session")
});