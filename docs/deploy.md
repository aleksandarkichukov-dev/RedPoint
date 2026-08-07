# Deploying Red Point

The server is a SuperHosting Cloud VPS C2-R2-D60: two cores, **2 GB of RAM**,
60 GB NVMe, Ubuntu 24.04. That one number decides most of what follows.

## The rule that shapes everything

**Never build on the server.** `next build` peaks around 2 GB on its own, on a
machine with 2 GB that is already running the shop. Images are built here (or
in CI), pushed, and pulled down. Everything below assumes that.

The consequences are worth naming, because each one is a thing that would
otherwise be discovered at the worst moment:

- The storefront reads `MEDUSA_BACKEND_URL` and `MEDUSA_PUBLISHABLE_KEY` at run
  time, not build time. Both used to carry a `NEXT_PUBLIC_` prefix, which Next
  compiles into the bundle — and the publishable key is precisely the thing
  that changes at go-live. A rebuild for a changed key is not available here.
- Medusa runs as one process (`MEDUSA_WORKER_MODE=shared`). It is ~750 MB per
  process, and the brief's separate API and worker containers would need
  ~1.9 GB before anything else started.
- Photo uploads are written to disk rather than held in memory, capped at
  150 MB. See `apps/backend/src/api/middlewares.ts`.

## First time

### 1. The server

```bash
ssh root@<ip>
adduser redpoint && usermod -aG sudo redpoint
```

Docker, from Docker's own repository rather than Ubuntu's — Ubuntu ships an
older `docker.io` package that lags on compose:

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker redpoint
```

Swap. Not because 2 GB is expected to run out, but so that a brief spike costs
a slow minute rather than a killed process. On NVMe this is cheap:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Firewall — only the two ports nginx uses, plus ssh. Medusa on 9000 and the
storefront on 3000 must never be reachable from outside:

```bash
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
```

### 2. DNS

Point `redpointbg.com`, `www.redpointbg.com` AND the old `red-point.bg` at the server's IP. Wait until
`dig +short redpointbg.com` answers with it before going near certbot — a
certificate request against un-propagated DNS fails, and enough failures get
the domain rate-limited by Let's Encrypt for a week.

**This is the step that takes the old shop down.** Until it is done, the old
site keeps serving. Do it last, and only when everything below has been tested
on a temporary subdomain.

**Pointing red-point.bg here is not optional.** The shop is moving to a new
domain, so the 301 map is only half the job: those rules match on path and can
only fire for requests that arrive at this server. If the old domain keeps
pointing at the old host — or at nothing — then every link, bookmark and search
result made since 2014 goes somewhere else, and ten years of authority is spent
on a dead address. nginx has a block for it that forwards to the new domain
with the path intact, which the Next rules then translate.

### 3. The code and the secrets

```bash
git clone https://github.com/aleksandarkichukov-dev/RedPoint.git /srv/redpoint
cd /srv/redpoint
cp .env.example .env
```

Fill in `.env`. Generate the two secrets rather than inventing them:

```bash
openssl rand -base64 32
```

The myPOS private key and certificate are **files**, not variables. Copy them
into `apps/backend/secrets/`; compose mounts that directory read-only. A
multi-line PEM escaped into an environment variable fails as a bad signature
with nothing useful in the message.

Quote any value containing `#`. An unquoted `#` starts a comment and truncates
the value silently — this cost an evening on the Speedy password.

### 4. The images

Built here, not there:

```bash
docker compose --profile full build
docker save redpoint-storefront redpoint-backend | gzip > images.tar.gz
scp images.tar.gz redpoint@<ip>:/srv/redpoint/
```

On the server:

```bash
gunzip -c images.tar.gz | docker load
```

A registry (ghcr.io is free for this repo) is tidier once this happens more
than twice.

### 5. Database and seed

Data services first, then migrate, then seed. Migrations are run explicitly so
a restart loop can never half-apply a schema change:

```bash
docker compose up -d postgres redis
docker compose --profile full run --rm backend npx medusa db:migrate
docker compose --profile full run --rm backend npm run seed
```

**The seed prints a publishable key.** Put it in `.env` as
`MEDUSA_PUBLISHABLE_KEY` before starting the storefront, or every catalogue
read answers 401 and the shop renders empty with no error.

Create the admin user — this is the one command whose password goes in by hand:

```bash
docker compose --profile full run --rm backend npx medusa user -e <email> -p <password>
```

### 6. The certificate

nginx has to be up to answer the challenge, but its config references a
certificate that does not exist yet, so it will not start. Break the circle by
issuing the certificate standalone first:

```bash
docker compose --profile full run --rm -p 80:80 \
  -v letsencrypt:/etc/letsencrypt certbot \
  certonly --standalone -d redpointbg.com -d www.redpointbg.com -d red-point.bg -d www.red-point.bg \
  --agree-tos -m <email> --no-eff-email
```

Then bring everything up. Renewal after that is the `certbot` service in
compose, which tries twice a day and does nothing until there are thirty days
left.

```bash
docker compose --profile full up -d
```

### 7. Backups

```bash
crontab -e
# 0 3 * * * cd /srv/redpoint && ./deploy/backup.sh >> /var/log/redpoint-backup.log 2>&1
```

Both the database and the photography, because the photographs are on a volume
and not in the database. Restoring only the database gives a shop where every
product has an empty frame.

**Run a restore once, on purpose, before you need one.** A backup nobody has
restored is a file, not a backup.

## Updating

```bash
# here
docker compose --profile full build
docker save … | gzip | ssh redpoint@<ip> 'gunzip | docker load'

# there
cd /srv/redpoint && git pull
docker compose --profile full run --rm backend npx medusa db:migrate   # if the schema moved
docker compose --profile full up -d
```

## Things that will look like bugs and are not

- **Every image 404s.** The local file provider serves `/static` from the
  working directory, which is the build output at `.medusa/server`. The compose
  volume mounts there for that reason; mounted a directory higher, uploads land
  in the container's own layer and vanish on the next restart.
- **The admin dies on "Could not find index.html".** Medusa resolves the admin
  bundle from `<cwd>/public/admin`, so it has to run from `.medusa/server`.
- **The shop is empty and nothing errors.** Wrong or missing publishable key.
- **A confirmation email never arrives.** With `SENDGRID_API_KEY` and
  `SENDGRID_FROM` unset the backend writes messages to the log instead of
  sending them, and says so at boot. `check-order-email.ts` proves the chain.

## What is not done

- **The legal pages are the OLD shop's, and describe a shop this is not.**
  They were copied verbatim from red-point.bg on the client's instruction. Four
  contradictions are listed at the top of `src/lib/legal.ts`: they require
  registration where this shop has guest checkout, they name cash on delivery
  as the only payment method, they say returns must be carried into a Varna
  shop in person, and they link to a GDPR request page that belongs to the old
  system. A lawyer has to read them before the shop takes a real order.
- **Card payment has never taken a payment.** Cash on delivery works end to
  end. The myPOS notification path can only be exercised once there is a public
  address, which is this deployment.
- **No refund path.** A return means refunding by hand in the myPOS portal, and
  Medusa will not know it happened.
