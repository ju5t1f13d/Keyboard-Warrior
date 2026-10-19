const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const dataPath = () =>
    path.join(app.getPath("userData"), "keyboard-warrior-data.json");

let sessionStartedAt = null;
let sessionId = null;

async function readData() {
    try {
        return JSON.parse(await fs.readFile(dataPath(), "utf8"));
    } catch (error) {
        if (error.code === "ENOENT") {
            return {
                document: "",
                totalTyped: 0,
                totalErased: 0,
                sessions: []
            };
        }

        throw error;
    }
}

async function recoverInterruptedSessions() {
    const data = await readData();
    let changed = false;

    for (const session of data.sessions ?? []) {
        if (session.status === "active") {
            session.status = "interrupted";
            session.endedAt = null;
            session.durationSeconds = null;
            changed = true;
        }
    }

    if (changed) {
        await writeData(data);
    }
}

async function writeData(data) {
    await fs.writeFile(dataPath(), JSON.stringify(data, null, 2), "utf8");
}

function createWindow() {
    const window = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 700,
        minHeight: 500,
        title: "Keyboard Warrior",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    window.loadFile("index.html");
}

ipcMain.handle("load-data", async () => {
    return readData();
});


ipcMain.handle("save-data", async (_event, data) => {
    const existing = await readData();

    existing.document = String(data.document ?? "");
    existing.totalTyped = Math.max(0, Number(data.totalTyped) || 0);
    existing.totalErased = Math.max(0, Number(data.totalErased) || 0);

    const activeSession = existing.sessions?.find(
        (session) => session.id === sessionId
    );

    if (activeSession) {
        activeSession.document = existing.document;
    }

    await writeData(existing);

    return true;
});

ipcMain.handle("start-session", async () => {
    if (sessionStartedAt !== null) {
        return sessionId;
    }

    const data = await readData();
    const now = new Date();

    sessionStartedAt = now.toISOString();
    sessionId = `${Date.now()}`;

    data.sessions ??= [];
    const previousSession = data.sessions[data.sessions.length - 1];

    if(
        previousSession &&
        typeof previousSession.document !== "string" &&
        typeof data.document === "string" &&
        data.document.length > 0
    ) {
        previousSession.document = data.document;
    }
    
    data.sessions.push({
        id: sessionId,
        startedAt: sessionStartedAt,
        endedAt: null,
        durationSeconds: null,
        status: "active",
        document: ""
    });

    await writeData(data);

    return sessionId;
});

ipcMain.handle("end-session", async () => {
    if (sessionStartedAt === null) {
        return false;
    }

    const endedAt = new Date();
    const data = await readData();
    const session = data.sessions?.find((item) => item.id === sessionId);

    if (session) {
        session.endedAt = endedAt.toISOString();
        session.durationSeconds = Math.max(
            0,
            Math.floor((endedAt.getTime() - new Date(sessionStartedAt).getTime()) / 1000)
        );
        session.status = "completed";
    }

    await writeData(data);

    sessionStartedAt = null;
    sessionId = null;

    return true;
});

app.whenReady().then(async () => {
    try {
        console.log("Keyboard Warrior data:", dataPath());
        await recoverInterruptedSessions();
    } catch (error) {
        console.error("Could not recover interrupted sessions:", error);
    }

    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

let isQuitting = false;

app.on("before-quit", (event) => {
    if (sessionStartedAt === null || isQuitting) {
        return;
    }

    event.preventDefault();
    isQuitting = true;

    (async () => {
        try {
            const endedAt = new Date();
            const data = await readData();
            const session = data.sessions?.find(
                (item) => item.id === sessionId
            );

            if (session) {
                session.endedAt = endedAt.toISOString();
                session.durationSeconds = Math.max(
                    0,
                    Math.floor(
                        (endedAt.getTime() -
                            new Date(sessionStartedAt).getTime()) / 1000
                    )
                );
                session.status = "completed";
            }

            await writeData(data);
        } catch (error) {
            console.error("Could not finish the session:", error);
        } finally {
            sessionStartedAt = null;
            sessionId = null;
            app.quit();
        }
    })();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});