# Migrating To Version 23.0.0

Version 23 requires Nx 23. Existing applications keep working without changes; the changes below only affect how **new** applications are generated.

**1.** The application generator follows the Nx 23 convention: the positional argument is the **directory** of the new application, and the name is optional.

```bash
# before: created apps/my-app (project "my-app")
nx g nx-electron:app my-app

# now: pass the directory; the project name defaults to its last segment
nx g nx-electron:app apps/my-app
nx g nx-electron:app apps/desktop/shell --name=desktop-shell
```

`nx g nx-electron:app my-app` now creates the application in `./my-app`, and `--directory` no longer gets the name appended. Update scripts that call the generator accordingly.

**2.** Generated applications use the target setup of the Nx 23 application generators. To apply it to an existing application, update its `project.json`:

```json
    "serve": {
        "executor": "nx-electron:execute",
        "continuous": true,
        ...
    },
    "package": {
        "executor": "nx-electron:package",
        "dependsOn": ["build", { "projects": ["<frontend-app-name>"], "target": "build" }],
        ...
    },
    "make": {
        "executor": "nx-electron:make",
        "dependsOn": ["build", { "projects": ["<frontend-app-name>"], "target": "build" }],
        ...
    },
```

and add cacheable target defaults for the build executor to `nx.json`:

```json
  "targetDefaults": {
    "nx-electron:build": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"]
    }
  }
```

Use `["default", "^default"]` as inputs if your `nx.json` does not define the `production` named input.

> **💡 `dependsOn` runs the `build` target with its default configuration.** If your workspace builds with a specific configuration before packaging (for example `nx build <electron-app-name>:production`), keep running the builds explicitly instead of adding `dependsOn`.

**3.** The generator no longer sets `defaultProject` in `nx.json`.
