# Habitat Manual Deployment

## Deployment

- Deployed Git commit: `48b9b35fedce30f0fbfd0bd013e30061805e5e40`
- The code was cloned from the public Habitat GitHub repository onto the OpenClaw LXC.
- The backend was started manually with `bun run server` from `~/habitat-cli`.

## Verification evidence

The API worked locally on the LXC. The server listened on `0.0.0.0:8787`, and this request returned the existing Habitat registration rather than `null`:

```text
curl http://127.0.0.1:8787/registration
{"registration":{"habitatUuid":"...","habitatId":"...","displayName":"the hideout","apiToken":""}}
```

The server-side CLI reported the same registration and local state:

```text
habitat status
Habitat ID: habitat_...
Name: the hideout
Status: registered
Modules: 10
```

The laptop CLI reached the LXC through the private Tailscale connection after `HABITAT_API_BASE_URL` was set in the laptop's ignored `.env` file. The laptop `habitat status` command returned the same Habitat ID, display name, registration status, and module count shown by the server-side CLI.

While the laptop ran `habitat status`, the OpenClaw server terminal showed matching request logs:

```text
[kepler] GET /habitats/.../registration -> 200
[habitat-api] GET /status -> 10 modules
```

Running `habitat status` again produced another pair of request logs in the server terminal, confirming that the laptop command was using the remote backend.

After pressing `Ctrl+C` in the terminal running `bun run server`, the laptop command failed as expected:

```text
Could not reach the Habitat backend at http://<private-tailscale-address>:8787. Start it with `bun run server`.
```

The failure demonstrated terminal ownership of the manually started process: the deployed code and SQLite database remained on the LXC, but no process was listening on port 8787.

## Why the bind address matters

`0.0.0.0` tells Bun to listen on all network interfaces, including the private Tailscale interface. A loopback-only address such as `localhost` or `127.0.0.1` would accept requests only from the LXC itself and would prevent the laptop from reaching the backend.

## Ignored deployment files

`.env` and `.habitat/habitat.sqlite` remain in the checkout because the running backend needs its configuration and local Habitat state. Both paths are ignored by Git. `.env` can contain configuration and credentials, and the SQLite database can contain local state or credential material, so neither file is committed or included in submission content.

The backend was exposed only through the private Tailscale connection; no public URL or router port-forward was used.
