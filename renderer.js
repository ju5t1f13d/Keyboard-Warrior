const editor = document.getElementById("editor");

const typedCount = document.getElementById("typed-count");
const erasedCount = document.getElementById("erased-count");
const currentCount = document.getElementById("current-count");
const sessionLabel = document.getElementById("session-label");
const sessionTime = document.getElementById("session-time");
const sessionsList = document.getElementById("sessions-list");
const returnToCurrentButton = document.getElementById("return-to-current");

let totalTyped = 0;
let totalErased = 0;
let previousText = "";
let isReady = false;
let saveQueue = Promise.resolve();
let sessionStartedAt = null;
let viewingPastSession = false;
let currentSessionText = "";

function updateDisplay() {
    typedCount.textContent = totalTyped.toLocaleString();
    erasedCount.textContent = totalErased.toLocaleString();
    currentCount.textContent = editor.value.length.toLocaleString();
}

function renderSessionHistory(sessions) {
    sessionsList.replaceChildren();

    if (sessions.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "empty-sessions";
        emptyMessage.textContent = "No previous sessions yet.";
        sessionsList.appendChild(emptyMessage);
        return;
    }

    [...sessions].reverse().forEach((session, index) => {
        const sessionItem = document.createElement("button");
        sessionItem.className = "session-item";
        sessionItem.type = "button";

        sessionItem.addEventListener("click", () => {
            if (!viewingPastSession) {
                currentSessionText = editor.value;
            }

            viewingPastSession = true;
            returnToCurrentButton.hidden = false;
            editor.readOnly = true;

            editor.value = session.document || "";
            previousText = editor.value;

            updateDisplay();
        });

        const sessionTitle = document.createElement("p");
        sessionTitle.className = "session-title";
        sessionTitle.textContent = `Session #${sessions.length - index}`;

        const sessionDetails = document.createElement("p");
        sessionDetails.className = "stat-description";

        const characterCount = typeof session.document === "string"
            ? session.document.length
            : 0;

        sessionDetails.textContent =
            `${characterCount.toLocaleString()} characters · ${session.status || "unknown"}`;

        sessionItem.append(sessionTitle, sessionDetails);
        sessionsList.appendChild(sessionItem);
    });
}

function saveData() {
    if (!isReady || viewingPastSession) return;

    const data = {
        document: editor.value,
        totalTyped,
        totalErased
    };

    saveQueue = saveQueue
        .catch(() => {})
        .then(() => window.keyboardWarrior.saveData(data))
        .catch((error) => {
            console.error("Could not save Keyboard Warrior data:", error);
        });
}

function updateCounts() {
    const currentText = editor.value;

    let prefix = 0;

    while (
        prefix < previousText.length &&
        prefix < currentText.length &&
        previousText[prefix] === currentText[prefix]
    ) {
        prefix++;
    }

    let oldEnd = previousText.length;
    let newEnd = currentText.length;

    while (
        oldEnd > prefix &&
        newEnd > prefix &&
        previousText[oldEnd - 1] === currentText[newEnd - 1]
    ) {
        oldEnd--;
        newEnd--;
    }

    totalErased += oldEnd - prefix;
    totalTyped += newEnd - prefix;

    previousText = currentText;

    updateDisplay();
    saveData();
}

function formatDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
        .map((value) => String(value).padStart(2, "0"))
        .join(":");
}

async function updateSessionTimer() {
    if (sessionStartedAt === null) return;

    const elapsedSeconds = Math.floor(
        (Date.now() - sessionStartedAt) / 1000
    );

    sessionTime.textContent = formatDuration(elapsedSeconds);
}

async function initialize() {
    try {
        const data = await window.keyboardWarrior.loadData();

        renderSessionHistory(
            Array.isArray(data.sessions) ? data.sessions : []
        );

        totalTyped = Math.max(0, Number(data.totalTyped) || 0);
        totalErased = Math.max(0, Number(data.totalErased) || 0);

        editor.value = "";

        previousText = "";

        updateDisplay();

        const previousSessions = Array.isArray(data.sessions)
            ? data.sessions
            : [];

        sessionLabel.textContent = `Session #${previousSessions.length + 1}`;

        await window.keyboardWarrior.startSession();

        sessionStartedAt = Date.now();
        updateSessionTimer();
        setInterval(updateSessionTimer, 1000);

        isReady = true;
    } catch (error) {
        console.error("Could not initialize Keyboard Warrior:", error);
        editor.disabled = true;
        editor.placeholder = "Could not load saved data. Check the console.";
    }
}

editor.addEventListener("input", updateCounts);

initialize();

returnToCurrentButton.addEventListener("click", () => {
    viewingPastSession = false;

    editor.value = currentSessionText;
    previousText = editor.value;

    editor.readOnly = false;
    returnToCurrentButton.hidden = true;

    updateDisplay();
});