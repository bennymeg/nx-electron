# Migrating To Version 10.0.0

**1.** In `angular.json` file, update following configurations in `projects > {electron-app-name} > architect`:
```json
    "package": {
        "builder": "nx-electron:package",
        "options": {
            ...
            "outputPath": "dist/packages",      // previously was "out"
            "prepackageOnly": true              // **NOTE**
        }
    },
    "make": {
        "builder": "nx-electron:make",
        "options": {
            ...
            "outputPath": "dist/executables"    // previously was "out"
        }
    },
```
