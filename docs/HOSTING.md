---
project: Nagelstudio 27
purpose: Deployment handoff for an AI or hosting helper
application_type: Python standard-library web application with vanilla HTML, CSS, and JavaScript
entrypoint: server.py
python: "3.9+"
build_command: none
package_install: none
static_hosting_only: false
requires_persistent_disk: true
production_tls: required
customer_data: appointment requests containing names and phone numbers
---

# Hosting Handoff

Use this file as the deployment context when asking an AI to help host this project. Do not assume a provider or deploy it until the owner has chosen one.

## Project Requirements

- Run `python3 server.py` from the project root, the directory containing `index.html`.
- The app uses only the Python standard library. There is no build step, package manager, or `requirements.txt`.
- This is not a static-only website. The same Python process serves the pages and handles `POST /api/booking`, the authenticated `/api/bookings` endpoints, and `/admin`.
- Keep one server process running. The default listener is `127.0.0.1:8000`; put a TLS reverse proxy in front of it for a public deployment.
- Provide a writable, persistent `data-private/` directory beside `server.py`. It stores `bookings.jsonl` and compressed backups. Preserve it across code releases, restrict access to the server account, and never expose it through the web server.
- Set `NAILSHOP_ADMIN_USER` and `NAILSHOP_ADMIN_PASSWORD` in the server process environment. Both are mandatory. Use new, unique values; do not put secrets in Git or paste them into an AI chat.
- If the reverse proxy is on the same host, pass its address with `--trusted-proxy <proxy-ip>` and configure it to set `X-Forwarded-For`. Only trust proxy addresses controlled by the owner.
- The server makes one pre-change backup per UTC day and prunes backups after 30 days. These backups are on the same disk; arrange a separate secure backup for disaster recovery.

## Operational Limits

- The in-memory IP submission limit resets when the process restarts and is not shared between multiple server processes. Deploy one application process unless rate limiting is moved to shared infrastructure.
- There is no email or push notification for new bookings. The owner checks `/admin` manually.
- Booking records contain personal data. Use HTTPS, secure the host and backups, and follow applicable privacy and retention requirements.
- Do not use `--bind 0.0.0.0` for a public deployment behind a reverse proxy unless the host firewall prevents direct public access to the app port.

## What To Ask Before Giving Deployment Steps

First ask which hosting provider or server the owner wants to use, whether they own a domain, and whether they can access the server over SSH. Then tailor instructions to that choice. Confirm the provider supports a persistent Python process, environment variables/secrets, and persistent writable storage before recommending it. Explain the TLS proxy, persistent `data-private/`, backups, and how to keep admin secrets out of Git. Never ask the owner to send passwords or tokens in chat.

# Website Deployment Workflow — Hetzner Cloud + Ubuntu + Python + Caddy

A reusable guide for deploying a Python website to a Hetzner Cloud server with a custom domain, systemd, and automatic HTTPS.

This workflow keeps the Python application private behind Caddy. Caddy handles public HTTP/HTTPS traffic and automatically obtains and renews TLS certificates.

---

## 1. Record the website details

Before starting, decide on:

- **Domain:** `example.de`
- **Server IPv4:** `YOUR_SERVER_IP`
- **Local project directory:** `~/Websites/YOUR_PROJECT`
- **Server project directory:** `/opt/YOUR_PROJECT`
- **Linux service user:** `YOUR_PROJECT`
- **Python application entry point:** `server.py`
- **Local application port:** `8000`
- **Systemd service name:** `YOUR_PROJECT`
- **Environment file:** `/etc/YOUR_PROJECT.env`

Replace the placeholders in every command before running it.

For each new website, confirm its startup command, environment variables, data storage location, and any special requirements from the project's README or hosting documentation.

## 2. Prepare the Hetzner server

Create an Ubuntu server in Hetzner Cloud and record its public IPv4 address.

Create an SSH key on your local computer if you do not already have one dedicated to this server:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/YOUR_PROJECT
```

Add the public key to the server through Hetzner's console or during server creation:

```bash
cat ~/.ssh/YOUR_PROJECT.pub
```

Never upload or share the private key file without a good reason. The public key is the file ending in `.pub`.

Connect from your local computer:

```bash
ssh -i ~/.ssh/YOUR_PROJECT root@YOUR_SERVER_IP
```

**Important:** Run SSH commands on your local computer, not inside the server terminal.

Update Ubuntu:

```bash
apt update
apt upgrade -y
```

Install the basic tools:

```bash
apt install -y python3 rsync curl ca-certificates
```

## 3. Create a dedicated application user and directory

Run on the server:

```bash
adduser --system --group --home /opt/YOUR_PROJECT YOUR_PROJECT
mkdir -p /opt/YOUR_PROJECT
```

Use a dedicated Linux account rather than running the application as root.

## 4. Upload the website

Run on your local computer, from the project directory:

```bash
cd ~/Websites/YOUR_PROJECT
rsync -av --exclude='data-private/' --exclude='.git/' \
  ./ root@YOUR_SERVER_IP:/opt/YOUR_PROJECT/
```

Review the exclusions before uploading. Never accidentally overwrite production data with local files.

If the project has a private data directory, create it separately on the server:

```bash
mkdir -p /opt/YOUR_PROJECT/data-private
```

Set permissions appropriate to the application. For an app that stores private bookings locally:

```bash
chown -R root:YOUR_PROJECT /opt/YOUR_PROJECT
chown YOUR_PROJECT:YOUR_PROJECT /opt/YOUR_PROJECT/data-private
chmod 750 /opt/YOUR_PROJECT
chmod 700 /opt/YOUR_PROJECT/data-private
```

Confirm the app user can read the code and write to every directory where it needs to store data. Adjust permissions for any additional writable directories.

Do not put private booking records, passwords, environment files, or other secrets in a publicly served directory.

## 5. Configure application credentials

Create an environment file on the server:

```bash
nano /etc/YOUR_PROJECT.env
```

Example:

```text
NAILSHOP_ADMIN_USER=change_this
NAILSHOP_ADMIN_PASSWORD=use_a_long_unique_password
```

Use the actual environment variable names expected by your application. The example above is specific to the Nagelstudio 27 application.

Restrict access:

```bash
chown root:root /etc/YOUR_PROJECT.env
chmod 600 /etc/YOUR_PROJECT.env
```

Do not commit this file to Git, upload it from your laptop, or paste its contents into chats.

## 6. Create a systemd service

Create the service file:

```bash
nano /etc/systemd/system/YOUR_PROJECT.service
```

Example for a Python application whose entry point is `server.py`:

```ini
[Unit]
Description=YOUR_PROJECT website
After=network.target

[Service]
Type=simple
User=YOUR_PROJECT
Group=YOUR_PROJECT
WorkingDirectory=/opt/YOUR_PROJECT
EnvironmentFile=/etc/YOUR_PROJECT.env
ExecStart=/usr/bin/python3 /opt/YOUR_PROJECT/server.py --bind 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5
UMask=0077

[Install]
WantedBy=multi-user.target
```

If the app supports trusted proxy configuration, add the appropriate option to the startup command when Caddy will run on the same server:

```text
--trusted-proxy 127.0.0.1
```

The final `ExecStart` for Nagelstudio 27 is:

```ini
ExecStart=/usr/bin/python3 /opt/nagelstudio27/server.py --bind 127.0.0.1 --port 8000 --trusted-proxy 127.0.0.1
```

**Do not blindly copy this startup command for a different project.** Check its supported command-line arguments and runtime requirements first.

Enable and start the service:

```bash
systemctl daemon-reload
systemctl enable --now YOUR_PROJECT
systemctl status YOUR_PROJECT --no-pager
```

Check the application locally on the server:

```bash
curl -I http://127.0.0.1:8000/
```

Check its listening address:

```bash
ss -ltnp | grep 8000
```

The application should listen on `127.0.0.1:8000`, not `0.0.0.0:8000`. Do not expose the application port publicly.

View application logs if necessary:

```bash
journalctl -u YOUR_PROJECT -n 100 --no-pager
journalctl -u YOUR_PROJECT -f
```

Press `Ctrl+C` to stop following the logs.

## 7. Configure the domain's DNS

At the domain registrar or DNS provider, create the following records.

| Type | Name / Host | Value / Target |
|---|---|---|
| A | `@` | `YOUR_SERVER_IP` |
| CNAME | `www` | `example.de` |

Use the real domain and IP address. Some providers use an empty name instead of `@` for the root domain.

If an existing root A record points to an old server, replace it rather than leaving conflicting A records. Check existing wildcard (`*`) and AAAA (IPv6) records before changing them; remove or update them only after confirming what they are used for.

Check DNS from the server:

```bash
getent ahostsv4 example.de
getent ahostsv4 www.example.de
```

Both should resolve to the intended server IPv4 address, directly or through the configured CNAME.

DNS changes can take time to propagate.

## 8. Install Caddy

Caddy will receive public HTTP/HTTPS traffic and forward requests to the private Python application.

On Ubuntu, install Caddy using its official package repository instructions:

<https://caddyserver.com/docs/install>

For a Debian/Ubuntu system, the commands are:

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  -o /etc/apt/sources.list.d/caddy-stable.list

chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
chmod o+r /etc/apt/sources.list.d/caddy-stable.list

apt update
apt install -y caddy
```

## 9. Configure Caddy

Edit the configuration:

```bash
nano /etc/caddy/Caddyfile
```

Use:

```caddyfile
example.de, www.example.de {
    reverse_proxy 127.0.0.1:8000
}
```

Replace the domain names and upstream port for the current project.

Validate and reload:

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy
systemctl status caddy --no-pager
```

Caddy automatically manages HTTPS certificates when the domain points to the server and the necessary public ports are reachable.

## 10. Configure the firewall

Allow SSH, HTTP, and HTTPS before enabling UFW:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw status
```

If the rules are correct, enable the firewall:

```bash
ufw enable
ufw status
```

Keep your current SSH session open while testing a new SSH connection in another terminal. This helps avoid accidentally locking yourself out.

If a Hetzner Cloud Firewall is attached, configure its inbound rules too:

- TCP 22: SSH, restricted to trusted source IPs when practical
- TCP 80: HTTP
- TCP 443: HTTPS

Do not create a public firewall rule for the Python application port (for example, 8000).

## 11. Test the website

Open these URLs:

- `https://example.de`
- `https://www.example.de`

Check DNS if the site is unavailable:

```bash
getent ahostsv4 example.de
getent ahostsv4 www.example.de
```

Check the application:

```bash
systemctl status YOUR_PROJECT --no-pager
curl -I http://127.0.0.1:8000/
```

Check Caddy:

```bash
systemctl status caddy --no-pager
journalctl -u caddy -n 100 --no-pager
```

Check firewall rules:

```bash
ufw status
```

If HTTPS certificates fail, confirm the domain resolves correctly and that inbound TCP ports 80 and 443 are reachable. Also inspect the Caddy logs.

## 12. Updating the website later

From your local computer, upload the new application files:

```bash
rsync -av --exclude='data-private/' --exclude='.git/' \
  ./ root@YOUR_SERVER_IP:/opt/YOUR_PROJECT/
```

Then restart the application on the server:

```bash
systemctl restart YOUR_PROJECT
systemctl status YOUR_PROJECT --no-pager
```

Review the logs:

```bash
journalctl -u YOUR_PROJECT -n 100 --no-pager
```

Only reload Caddy if its configuration has changed:

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

**Important:** Back up private application data before updates or migrations. Ensure the backup is stored securely and is not publicly accessible.

## 13. Final security checklist

- [ ] The application runs under a dedicated non-root Linux user.
- [ ] The application listens only on `127.0.0.1`.
- [ ] Port 8000 is not publicly exposed.
- [ ] SSH access uses a key and remains available.
- [ ] Environment files are readable only by root.
- [ ] Private data directories have restrictive permissions.
- [ ] DNS points to the intended server.
- [ ] Only required public ports are open.
- [ ] HTTPS works on both the root domain and `www`.
- [ ] The application starts automatically after a reboot.
- [ ] Application and Caddy logs can be inspected.
- [ ] Private data is backed up securely.
- [ ] Ubuntu and installed packages are updated regularly.

---

## Quick reference: Nagelstudio 27

| Setting | Value |
|---|---|
| Domain | `nagelstudio27.de` |
| Server IP | `159.69.216.253` |
| App directory | `/opt/nagelstudio27` |
| Service | `nagelstudio27` |
| Local app address | `127.0.0.1:8000` |
| Environment file | `/etc/nagelstudio27.env` |
| Caddy config | `/etc/caddy/Caddyfile` |
| Private data | `/opt/nagelstudio27/data-private` |

### Useful commands

```bash
systemctl status nagelstudio27 --no-pager
systemctl status caddy --no-pager
journalctl -u nagelstudio27 -n 100 --no-pager
journalctl -u caddy -n 100 --no-pager
curl -I http://127.0.0.1:8000/
ufw status
```

Official references:

- Caddy installation: <https://caddyserver.com/docs/install>
- Caddy automatic HTTPS: <https://caddyserver.com/docs/automatic-https>
- Caddy reverse proxy: <https://caddyserver.com/docs/caddyfile/directives/reverse_proxy>
- systemd service documentation: <https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html>
