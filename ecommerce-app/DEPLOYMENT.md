# 🚀 Deployment Guide

Production-ready deployment instructions for ShopHub.

## Cloud Deployment Options

### Option 1: Heroku Deployment

#### Backend Deployment
```bash
# Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Login
heroku login

# Create app
heroku create your-app-name

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:hobby-dev

# Create Procfile
echo "web: java -Dserver.port=\$PORT \$JAVA_OPTS -jar build/libs/ecommerce-api.jar" > Procfile

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

#### Frontend Deployment (Netlify)
```bash
# Netlify CLI
npm install -g netlify-cli

cd frontend
netlify deploy

# Select your site or create new
# Choose frontend as publish directory
```

### Option 2: AWS Deployment

#### RDS PostgreSQL
1. Create RDS instance
2. Note endpoint, username, password
3. Update `application.yml` environment variables

#### Elastic Beanstalk (Backend)
```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init -p java-17 ecommerce-api

# Create environment
eb create ecommerce-prod

# Deploy
eb deploy

# Open
eb open
```

#### S3 + CloudFront (Frontend)
```bash
# Create S3 bucket
aws s3 mb s3://ecommerce-frontend-prod

# Upload
aws s3 sync frontend/ s3://ecommerce-frontend-prod/

# Create CloudFront distribution
# Set S3 bucket as origin
```

### Option 3: Docker + Any VPS

#### Build and Push Image
```bash
# Build backend JAR first
cd backend
./gradlew bootJar

# Build Docker image
docker build -t ecommerce-api:latest .

# Tag for registry (Docker Hub/ECR)
docker tag ecommerce-api:latest YOUR_REGISTRY/ecommerce-api:latest

# Push
docker push YOUR_REGISTRY/ecommerce-api:latest
```

#### Run with Docker Compose
```bash
# Update docker-compose.yml with production settings
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop
docker-compose down
```

### Option 4: Self-Hosted (VPS/Dedicated Server)

#### Setup Ubuntu Server
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Java 17
sudo apt install openjdk-17-jdk-headless -y

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Nginx (reverse proxy)
sudo apt install nginx -y

# Start services
sudo systemctl start postgresql
sudo systemctl start nginx
```

#### Deploy Application
```bash
# Clone repository
git clone <your-repo> /opt/ecommerce

# Build backend
cd /opt/ecommerce/backend
./gradlew bootJar

# Create systemd service
sudo tee /etc/systemd/system/ecommerce-api.service > /dev/null <<EOF
[Unit]
Description=ShopHub eCommerce API
After=network.target

[Service]
Type=simple
User=appuser
WorkingDirectory=/opt/ecommerce/backend
ExecStart=/usr/bin/java -jar build/libs/ecommerce-api.jar
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable ecommerce-api
sudo systemctl start ecommerce-api
```

#### Nginx Configuration
```nginx
# /etc/nginx/sites-available/ecommerce

upstream ecommerce_api {
    server localhost:8080;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend
    location / {
        root /opt/ecommerce/frontend;
        try_files $uri /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://ecommerce_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/ecommerce /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Environment Configuration

### Production Environment Variables

```bash
# Backend
SPRING_DATASOURCE_URL=jdbc:postgresql://prod-db.com:5432/ecommerce_db
SPRING_DATASOURCE_USERNAME=prod_user
SPRING_DATASOURCE_PASSWORD=STRONG_PASSWORD_HERE
JWT_SECRET=VERY_LONG_RANDOM_STRING_AT_LEAST_32_CHARS
JWT_EXPIRATION=86400000
SPRING_JPA_HIBERNATE_DDL_AUTO=validate
SERVER_PORT=8080
SPRING_PROFILES_ACTIVE=prod
```

### Frontend Configuration

```javascript
// production-config.js
const config = {
    API_URL: 'https://yourdomain.com/api',
    ENVIRONMENT: 'production'
};
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Enable HTTPS with SSL certificate (Let's Encrypt)
- [ ] Set strong JWT secret (32+ chars, random)
- [ ] Enable PostgreSQL password authentication
- [ ] Configure firewall (allow only 80, 443, 5432 if needed)
- [ ] Enable database backups
- [ ] Set up monitoring and logging
- [ ] Enable rate limiting
- [ ] Configure CORS for production domain only
- [ ] Enable HTTP Security Headers
- [ ] Set up automated deployments (GitHub Actions, GitLab CI)

## SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

## Monitoring & Logging

### Application Logs
```bash
# View logs
sudo journalctl -u ecommerce-api -f

# Docker logs
docker-compose logs -f
```

### Database Backups
```bash
# Backup
pg_dump -U postgres ecommerce_db > backup-$(date +%Y%m%d).sql

# Restore
psql -U postgres ecommerce_db < backup.sql

# Automated backup (cron)
0 2 * * * pg_dump -U postgres ecommerce_db | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz
```

### Performance Monitoring
```bash
# Monitor database
psql -U postgres -d ecommerce_db
SELECT * FROM pg_stat_statements;

# Monitor application
curl http://localhost:8080/actuator/health
```

## Scaling Considerations

### Database Optimization
```sql
-- Add indexes
CREATE INDEX idx_user_username ON users(username);
CREATE INDEX idx_product_category ON products(category);
CREATE INDEX idx_order_user ON orders(user_id);
CREATE INDEX idx_cart_user ON cart(user_id);
```

### Load Balancing
```bash
# Multiple backend instances behind Nginx
upstream ecommerce_api {
    server localhost:8080;
    server localhost:8081;
    server localhost:8082;
}
```

### Caching
```yaml
# Redis cache (optional)
spring:
  cache:
    type: redis
  redis:
    host: localhost
    port: 6379
```

## Backup & Recovery

### Database Backup Strategy
```bash
# Daily incremental backup
0 3 * * * pg_dump -U postgres ecommerce_db > /backups/daily-$(date +\%w).sql

# Weekly full backup
0 4 * * 0 pg_dump -U postgres ecommerce_db | gzip > /backups/weekly-$(date +\%Y\%m\%d).sql.gz

# Monthly archive
0 5 1 * * cp /backups/weekly-*.sql.gz /archive/
```

### Disaster Recovery
```bash
# Full system restore procedure:
1. Restore PostgreSQL database
2. Deploy latest application JAR
3. Rebuild frontend assets
4. Verify data integrity
5. Test all critical features
```

## Continuous Deployment

### GitHub Actions Example
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build Backend
        run: cd backend && ./gradlew bootJar
      
      - name: Deploy to Server
        run: |
          scp backend/build/libs/ecommerce-api.jar user@prod-server:/opt/ecommerce/
          ssh user@prod-server 'sudo systemctl restart ecommerce-api'
```

## Post-Deployment

1. ✅ Test all features in production
2. ✅ Verify database backups running
3. ✅ Monitor server resources
4. ✅ Set up alerts for errors
5. ✅ Document deployment process
6. ✅ Train support team
7. ✅ Plan maintenance schedule

## Support & Maintenance

- Monitor error logs daily
- Update dependencies monthly
- Perform security audits quarterly
- Test disaster recovery annually
- Document all changes

---

**Ready to go live? Follow these steps and you'll be production-ready! 🚀**
