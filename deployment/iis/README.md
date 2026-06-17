# IIS deployment

This project is a Next.js application. IIS should host it as a reverse proxy while the standalone Next.js server runs as a local Windows service.

## Build the IIS package

From the repository root:

```powershell
npm run publish:iis
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
