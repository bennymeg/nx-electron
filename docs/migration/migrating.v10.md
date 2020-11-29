# Migrating To Version 10.0.0

**1.** Add folder and file `.\apps\<electron-app-name>\src\app\api\preload.ts` with the following contents:

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  platform: process.platform
});
```

**2.** Update file `.\apps\<electron-app-name>\src\app\app.ts` to include preload entry:

```typescript
...

webPreferences: {
    contextIsolation: true,
    backgroundThrottling: true,
    preload: join(__dirname, 'preload.js')
}

...
```
