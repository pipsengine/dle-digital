# DLE Connect IIS Dashboard

Next.js dashboard for Dorman Long Enterprise operations, packaged for IIS hosting on a Windows server.

## Local Development

```powershell
npm install
npm run dev
```

The app runs on:

```text
http://127.0.0.1:3010
```

The npm scripts are UNC-safe for this server share. They enter the repository through `scripts\Run-FromRepo.cmd` so Next.js and ESLint run from a temporary mapped drive instead of directly from `\\x3admin\...`.

## Validation

```powershell
npm run lint
npm run build
```

`npm run lint` may report React hook warnings, but it should exit without errors. `npm run build` creates a standalone Next.js build under `apps\dashboard\.next`.

## IIS Package

```powershell
npm run publish:iis
```

The IIS package is written to:

```text
deployment\iis\site
```

The default package uses HttpPlatformHandler so IIS starts `apps\dashboard\server.js` directly. See `deployment\iis\README.md` for IIS roles, permissions, and the reverse-proxy option.

If the publish folder is locked, stop the IIS site or any running dashboard service and close terminals/editors browsing `deployment\iis\site`, then rerun the publish command.
