# Nagelstudio 27 Website

A website for a nail shop (manicure and pedicure), written in plain HTML, CSS and JavaScript modules. There is no framework or build step. A small Python server (`server.py`, standard library only) serves the site, stores booking requests and protects the admin page.

## Running Locally

The pages load JSON data and the booking form posts to the server, so run the site through `server.py` (Python 3, nothing to install). Run this from the project folder (the one containing `index.html`):

```sh
export NAILSHOP_ADMIN_USER='your-admin-name'
export NAILSHOP_ADMIN_PASSWORD='your-long-unique-password'
python3 server.py
```

Set a unique admin username and strong password in the environment before starting the server. These values are required and must not be committed to the repository. `.env` files are ignored by git.

It listens on `http://127.0.0.1:8000` (this computer only). Options: `--port 8080`, and `--bind 0.0.0.0` to allow other devices on the network.

To see which server is running on port 8000 and which folder it serves, run:

```sh
pgrep -af server.py
readlink /proc/<PID>/cwd
```

Use the PID from the first command in the second. These only inspect; they do not start or stop a server. Press `Ctrl+C` in the server terminal when finished.

### Open on Another Device

Connect both devices to the same trusted Wi-Fi or local network, start the server with `--bind 0.0.0.0`, and open `http://<computer address>:8000` on the other device. `localhost` points to the device you're using. If the page does not load, check that the computer's firewall allows connections on the port. The server uses plain HTTP, so only do this on a trusted network.

## Booking Requests and Admin

- The booking form requires a date; requested time is optional and appears in the admin timetable as all-day when omitted. The server validates the phone number, rejects a second future booking for the same normalized number, and appends one JSON object per line to `data-private/bookings.jsonl` (ignored by git and never served).
- The form includes a honeypot and limits each client IP to 10 submissions per hour (in-memory; resets when the server restarts). When running behind a reverse proxy, pass its address with `--trusted-proxy <proxy-ip>` and configure the proxy to set `X-Forwarded-For`; only explicitly trusted addresses are used to determine client IPs.
- Before changing bookings, the server creates one compressed pre-change backup per UTC day in `data-private/backups/` and removes backups older than 30 days. Backups are on the same machine by default; copy them to a separate disk or host for protection against machine failure. The directory is not served.
- `/admin` opens the German-only calendar and bookings tabs behind HTTP Basic Auth. Pending requests can be accepted or deleted after typing `loeschen`; authentication uses the `NAILSHOP_ADMIN_USER` and `NAILSHOP_ADMIN_PASSWORD` environment variables.
- The server only serves `index.html`, `src/` and `public/`; `server.py`, `data-private/`, `docs/` and `.git` are not reachable.
- Before going live, serve the site over HTTPS (for example behind Caddy or nginx), otherwise the admin password and form data travel unencrypted.

## Building and Deploying

There is nothing to build: no compiler, bundler or package install is needed. Booking and the admin page need a host that can run `python3 server.py` (a small VPS or similar); plain static hosting cannot store bookings.

To publish, upload `index.html`, `server.py`, `src/` and `public/`, keeping the folder layout unchanged because the pages use relative paths. `docs/`, `.github/` and the Markdown files do not need to be uploaded. Keep `data-private/` on the server and back it up.

## Project Structure

```text
index.html        Home page (gallery, reviews, about, contact)
server.py         Local/production server: static files, booking API, /admin login
data-private/     Created at runtime; bookings.jsonl (not in git, not served)
public/
  fonts/          Static font assets
  images/         Gallery images (set cover and images in src/data/gallery.json)
src/
  data/           Editable content: shop.json, prices.json, reviews.json, gallery.json
  pages/          contact, booking, prices and admin pages
  scripts/        Page scripts, language switcher (common.js) and texts (translations.js)
  styles/         Shared styles (main.css)
  components/     Reserved for reusable interface components (empty)
docs/             Project notes
.github/          Repository-specific Copilot instructions
```

## Editing Content

- Shop name, phone, address and opening hours: `src/data/shop.json` (`openingHours` has one entry per weekday, `null` means closed).
- Prices: `src/data/prices.json` (names in German, English and Vietnamese).
- Reviews: `src/data/reviews.json`, entries like `{ "author": "Name", "text": "..." }`.
- Gallery: put images in `public/images/` and edit `src/data/gallery.json`: `cover` is the faded banner picture behind the "Galerie" title, and `images` lists every picture shown in the overlay that opens on click.
- Interface texts: `src/scripts/translations.js` (German is the default).

## Known Gaps

- The owner gets no email or other notification for new requests; she must check `/admin`.
- Shop details and prices are placeholders.
- The opening hours in `src/data/shop.json` are placeholders.
- The reviews in `src/data/reviews.json` are dummy entries; replace them with real customer reviews.

## Working Notes

- Record each meaningful project change in [CHANGELOG.md](CHANGELOG.md), including a brief description and any checks run.
- Keep implementation and setup decisions documented here as the project takes shape.
- Choose the framework, package manager, and deployment target before adding application code.