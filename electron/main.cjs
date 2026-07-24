const { app, BrowserWindow } = require("electron");
const path = require("path");

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: "SaaS CMS LMS",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    // win.webContents.openDevTools(); // optional while debugging
  } else {
    // Packaged: index.html lives next to electron/ inside the asar
    const indexHtml = path.join(__dirname, "..", "dist", "index.html");
    win.loadFile(indexHtml).catch((err) => {
      console.error("Failed to load UI:", indexHtml, err);
      win.webContents.openDevTools({ mode: "detach" });
    });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
