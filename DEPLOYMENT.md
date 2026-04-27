# Deployment Guide

## Prerequisites

### GitHub Secrets Setup

Add the following secrets to your GitHub repository (Settings → Secrets and variables → Actions):

| Secret Name | Description | Example |
|---|---|---|
| `DEPLOY_HOST` | VM hostname or domain | `app.example.com` |
| `DEPLOY_USER` | SSH username | `deploy` or `root` |
| `DEPLOY_KEY` | SSH private key (base64 encoded) | Output of `cat ~/.ssh/id_ed25519 \| base64` |
| `PROD_DATABASE_PASSWORD` | PostgreSQL password | Generate a strong password |
| `PROD_APP_PASSWORD` | Application user password | `MirtelPohlaTissid` or custom |
| `PROD_ADMIN_PASSWORD` | Admin password | `admin` or custom |

**To encode your SSH key:**
```bash
cat ~/.ssh/id_ed25519 | base64 -w 0
```

### VM Setup (One-time)

On your CentOS/RHEL VM:

1. **Install Docker & Docker Compose:**
   ```bash
   sudo yum update -y
   sudo yum install -y docker docker-compose-plugin
   sudo systemctl enable docker
   sudo systemctl start docker
   sudo usermod -aG docker $USER  # Add your deploy user to docker group
   ```

2. **Create deployment directory:**
   ```bash
   sudo mkdir -p /opt/ois2
   sudo chown deploy:deploy /opt/ois2  # Change 'deploy' to your user
   ```

3. **Generate SSH key for GitHub Actions:**
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/github-actions -N ""
   cat ~/.ssh/github-actions.pub >> ~/.ssh/authorized_keys
   ```

4. **Optional: Set up log rotation:**
   ```bash
   sudo bash -c 'cat > /etc/docker/daemon.json << EOF
   {
     "log-driver": "json-file",
     "log-opts": {
       "max-size": "10m",
       "max-file": "3"
     }
   }
   EOF'
   sudo systemctl restart docker
   ```

## First-Time Deployment

After the GitHub Actions workflow successfully deploys, SSH into your VM and initialize the database:

```bash
ssh user@your-vm-hostname

# Navigate to deployment directory
cd /opt/ois2

# Initialize database schema
docker compose -f docker-compose.prod.yml exec -T db psql -U konvent -d konvent_pos -f - << 'EOF'
$(cat /path/to/database/schema.sql)
EOF

# Seed sample data
docker compose -f docker-compose.prod.yml exec -T db psql -U konvent -d konvent_pos -f - << 'EOF'
$(cat /path/to/database/seed.sql)
EOF
```

Or if `database/` files are available on the VM:
```bash
cat database/schema.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U konvent -d konvent_pos
cat database/seed.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U konvent -d konvent_pos
```

## Subsequent Deployments

Push to `main` branch:
```bash
git push origin main
```

GitHub Actions will automatically:
1. Build Docker images
2. Transfer them to your VM
3. Deploy with `docker compose up -d`

## Monitoring Deployments

### View workflow status:
- GitHub: Actions tab → Build and Deploy workflow

### SSH to VM and check status:
```bash
# See running containers
docker ps

# View logs
docker compose -f docker-compose.prod.yml logs -f server
docker compose -f docker-compose.prod.yml logs -f client
docker compose -f docker-compose.prod.yml logs -f db

# Check container health
docker compose -f docker-compose.prod.yml ps
```

## Troubleshooting

### GitHub Actions fails to connect
- **Error:** `Permission denied (publickey)`
- **Solution:** Verify `DEPLOY_KEY` secret is base64 encoded correctly
  ```bash
  echo "$DEPLOY_KEY" | base64 -d | ssh-keygen -y -f /dev/stdin
  ```

### SSH fingerprint issues
- **Error:** `Host key verification failed`
- **Solution:** Already handled in workflow with `ssh-keyscan`, but verify manually:
  ```bash
  ssh-keyscan your-vm-hostname >> ~/.ssh/known_hosts
  ```

### Docker images not loading
- **Error:** `docker load` fails
- **Solution:** 
  ```bash
  # Check available disk space
  df -h /opt/ois2
  
  # Check tar files exist
  ls -lh /tmp/*.tar
  ```

### Services not starting
- **Error:** Container exits immediately
- **Solution:** Check logs and environment variables
  ```bash
  docker compose -f docker-compose.prod.yml logs db
  docker compose -f docker-compose.prod.yml logs server
  
  # Verify .env file exists and has correct format
  cat /opt/ois2/.env
  ```

## Rolling Back

To revert to a previous deployment:

```bash
ssh user@your-vm-hostname

cd /opt/ois2

# Stop current deployment
docker compose -f docker-compose.prod.yml down

# Check git to find previous commit SHA
git log --oneline | head -5

# Rebuild with previous commit (requires re-pushing code)
# Or manually load and run a previously built image
```

## Updating Production Credentials

1. Update secret in GitHub (Settings → Secrets)
2. Push a new commit to `main` (even empty commit: `git commit --allow-empty -m "Rotate credentials"`)
3. GitHub Actions redeploys with new credentials

## Port Configuration

By default:
- Server: `localhost:3000`
- Client: `localhost:5173`
- Database: `localhost:5433`

To customize, either:
- Modify `docker-compose.prod.yml` ports
- Set up Nginx reverse proxy on port 80/443

## Database Backups

Create a cron job for backups:

```bash
# On VM, add to crontab
crontab -e

# Add this line (daily backup at 2 AM)
0 2 * * * docker compose -f /opt/ois2/docker-compose.prod.yml exec -T db pg_dump -U konvent konvent_pos | gzip > /backups/konvent_pos_$(date +\%Y\%m\%d).sql.gz
```

## Security Best Practices

1. **SSH Key:** Never commit private keys; rotate periodically
2. **Credentials:** Use strong, unique passwords for production
3. **Database:** Consider separate DB credentials for production vs. staging
4. **Network:** Restrict firewall rules to only needed ports and IPs
5. **Updates:** Keep Docker and OS packages updated regularly
6. **Monitoring:** Set up alerts for failed deployments or unhealthy containers
