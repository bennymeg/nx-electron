# Migrating To Version 8.0.0

**1.** In `angular.json` file, add the following line to `projects > {electron-app-name} > architect`:
```json
    "package": {
        "builder": "nx-electron:package",
        "options": {
            "name": "{electron-app-name}",
            "frontendProject": "{frontend-app-name}",
            "out": "dist/packages"
        }
    }
```

**2.** Add the following static packaging options file `.\apps\<electron-app-name>\src\app\options\packager.options.json`:
```json
{
  "$schema": "../../../../../node_modules/nx-electron/src/validation/packager.schema.json"
} 
```