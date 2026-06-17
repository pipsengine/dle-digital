# IIS deployment

This project is a Next.js application. IIS can host it in either of these modes:

- **IIS-managed process**, where IIS starts and monitors the standalone Next.js server through HttpPlatformHandler.
- **Reverse proxy**, where IIS proxies to a separate local Windows service running the standalone Next.js server.

For on-premise operation where the server should be managed from IIS/Services instead of ad hoc commands, prefer the IIS-managed process mode.

## Build the IIS package

From the repository root:

```powershell
npm run publish:iis
```

The default publish mode is IIS-managed process mode. To publish the older reverse-proxy package explicitly:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\Publish-DleDashboardIis.ps1 -HostingMode ReverseProxy
```

The publish output is created at:

```text
deployment\iis\site
```

## Server setup

Install these IIS components on the on-premise Windows server:

- IIS
- URL Rewrite
- Application Request Routing with proxy enabled
- Node.js LTS
- HttpPlatformHandler, if using IIS-managed process mode

## IIS-managed process mode

Use this mode when IIS should own the application lifecycle.

1. Create an IIS site that points to `deployment\iis\site`.
2. Copy `deployment\iis\web.httpplatform.config` over `deployment\iis\site\web.config`.
3. In IIS Manager, recycle the application pool or restart the site.

With this mode, IIS launches `apps\dashboard\server.js` automatically and assigns the internal port through `%HTTP_PLATFORM_PORT%`. You do not need to keep a separate console process open.

Make sure the IIS application pool identity has read/write access to:

- `deployment\iis\site\.env`
- `deployment\iis\site\apps\dashboard\data`
- `deployment\iis\site\logs`

## Reverse proxy mode

Create an IIS site that points to `deployment\iis\site`. The included `web.config` proxies all traffic to:

```text
http://127.0.0.1:3010
```

Run the Next.js server from the published folder as a Windows service:

```powershell
.\Start-DleDashboard.ps1
```

For production, register that command with your service runner of choice, such as NSSM, PM2 for Windows, or Task Scheduler. The service must stay running for IIS to serve the application.

## Port changes

If the local service port changes, update both:

- `deployment\iis\web.config`
- the service command, for example `.\Start-DleDashboard.ps1 -Port 3020`
