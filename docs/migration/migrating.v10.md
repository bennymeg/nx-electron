# Migrating To Version 10.0.0

**1.** In `angular.json` file, replace the out parameter to outputPath in `projects > {electron-app-name} > architect`:
```json
    "make": {
        "builder": "nx-electron:make",
        "options": {
            ...
            "outputPath": "dist/executables"    // previously was "out"
        }
    },
```
