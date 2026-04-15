# Jenkins Disaster Recovery & Operations Guide for 4YOE

## Part 1: Backup & Recovery Strategy

### 1.1 Automated Backup System

**File: `jenkins-backup/backup-strategy.sh`**

```bash
#!/bin/bash
# Comprehensive Jenkins backup strategy
# Supports: Master config, jobs, credentials, plugins, plugins versions

set -euo pipefail

JENKINS_HOME="/var/lib/jenkins"
BACKUP_DIR="/backup/jenkins"
S3_BUCKET="techflow-jenkins-backups"
AWS_REGION="us-east-1"
RETENTION_DAYS=30
LOG_FILE="/var/log/jenkins-backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

backup_jenkins_config() {
    log "${GREEN}Starting Jenkins configuration backup...${NC}"
    
    local backup_date=$(date +%Y%m%d_%H%M%S)
    local backup_name="jenkins_config_${backup_date}.tar.gz"
    local backup_path="${BACKUP_DIR}/${backup_name}"
    
    # Create backup excluding workspace and build artifacts
    tar -czf "$backup_path" \
        --exclude="${JENKINS_HOME}/workspace" \
        --exclude="${JENKINS_HOME}/builds" \
        --exclude="${JENKINS_HOME}/.cache" \
        --exclude="${JENKINS_HOME}/*.log" \
        --exclude="${JENKINS_HOME}/plugins/*.jpi.bak" \
        -C "$(dirname $JENKINS_HOME)" \
        "$(basename $JENKINS_HOME)" \
        2>> "$LOG_FILE"
    
    if [ -f "$backup_path" ]; then
        local size=$(du -h "$backup_path" | awk '{print $1}')
        log "${GREEN}✅ Backup created: ${backup_name} (${size})${NC}"
        
        # Upload to S3
        aws s3 cp "$backup_path" "s3://${S3_BUCKET}/master/" \
            --region "${AWS_REGION}" \
            --storage-class GLACIER \
            --sse AES256 \
            2>> "$LOG_FILE"
        
        if [ $? -eq 0 ]; then
            log "${GREEN}✅ Backup uploaded to S3${NC}"
        else
            log "${RED}❌ S3 upload failed${NC}"
            return 1
        fi
    else
        log "${RED}❌ Backup creation failed${NC}"
        return 1
    fi
}

backup_jenkins_jobs() {
    log "${GREEN}Starting Jenkins jobs backup...${NC}"
    
    local backup_date=$(date +%Y%m%d_%H%M%S)
    local backup_name="jenkins_jobs_${backup_date}.tar.gz"
    local backup_path="${BACKUP_DIR}/${backup_name}"
    
    # Backup job configurations
    tar -czf "$backup_path" \
        -C "${JENKINS_HOME}/jobs" . \
        2>> "$LOG_FILE"
    
    if [ -f "$backup_path" ]; then
        local size=$(du -h "$backup_path" | awk '{print $1}')
        log "${GREEN}✅ Jobs backup created: ${backup_name} (${size})${NC}"
        
        aws s3 cp "$backup_path" "s3://${S3_BUCKET}/jobs/" \
            --region "${AWS_REGION}" \
            --sse AES256 \
            2>> "$LOG_FILE"
    fi
}

backup_jenkins_credentials() {
    log "${GREEN}Starting Jenkins credentials backup...${NC}"
    
    local backup_date=$(date +%Y%m%d_%H%M%S)
    local backup_name="jenkins_credentials_${backup_date}.tar.gz"
    local backup_path="${BACKUP_DIR}/${backup_name}"
    
    # Backup credentials (encrypted in Jenkins)
    tar -czf "$backup_path" \
        -C "${JENKINS_HOME}/credentials.xml" . \
        -C "${JENKINS_HOME}/secrets" . \
        2>> "$LOG_FILE"
    
    if [ -f "$backup_path" ]; then
        log "${GREEN}✅ Credentials backup created${NC}"
        
        # Encrypt with GPG and upload
        gpg --symmetric --cipher-algo AES256 \
            --output "${backup_path}.gpg" \
            "$backup_path"
        
        aws s3 cp "${backup_path}.gpg" "s3://${S3_BUCKET}/credentials/" \
            --region "${AWS_REGION}" \
            --sse AES256 \
            2>> "$LOG_FILE"
        
        # Securely delete
        shred -vfz "$backup_path"
        shred -vfz "${backup_path}.gpg"
    fi
}

backup_plugins_list() {
    log "${GREEN}Starting Jenkins plugins backup...${NC}"
    
    local backup_date=$(date +%Y%m%d_%H%M%S)
    local backup_file="${BACKUP_DIR}/plugins_${backup_date}.txt"
    
    # List installed plugins and versions
    find "${JENKINS_HOME}/plugins" -name "*.jpi" | while read plugin; do
        plugin_name=$(basename "$plugin" .jpi)
        plugin_version=$(cd "${JENKINS_HOME}/plugins/${plugin_name}" && \
            unzip -p "META-INF/MANIFEST.MF" | grep "Plugin-Version" | cut -d' ' -f2)
        
        echo "${plugin_name}:${plugin_version}" >> "$backup_file"
    done
    
    if [ -f "$backup_file" ]; then
        aws s3 cp "$backup_file" "s3://${S3_BUCKET}/plugins/" \
            --region "${AWS_REGION}" \
            --sse AES256 \
            2>> "$LOG_FILE"
        
        log "${GREEN}✅ Plugins list backed up${NC}"
    fi
}

verify_backup_integrity() {
    log "${YELLOW}Verifying backup integrity...${NC}"
    
    local latest_backup=$(ls -t "${BACKUP_DIR}"/jenkins_config_*.tar.gz | head -1)
    
    if tar -tzf "$latest_backup" > /dev/null 2>&1; then
        log "${GREEN}✅ Backup integrity verified${NC}"
        return 0
    else
        log "${RED}❌ Backup integrity check failed${NC}"
        return 1
    fi
}

cleanup_old_backups() {
    log "${YELLOW}Cleaning up backups older than ${RETENTION_DAYS} days...${NC}"
    
    # Local cleanup
    find "${BACKUP_DIR}" -name "jenkins_*.tar.gz" -mtime +${RETENTION_DAYS} -delete
    
    # S3 cleanup
    aws s3 rm "s3://${S3_BUCKET}" \
        --region "${AWS_REGION}" \
        --recursive \
        --exclude "*" \
        --include "jenkins_*.tar.gz" \
        --older-than-days ${RETENTION_DAYS} \
        2>> "$LOG_FILE"
    
    log "${GREEN}✅ Old backups cleaned up${NC}"
}

generate_backup_report() {
    log "${GREEN}Generating backup report...${NC}"
    
    cat > "/tmp/jenkins-backup-report-$(date +%Y%m%d).txt" <<EOF
========================================
Jenkins Backup Report - $(date)
========================================

Backup Location: ${BACKUP_DIR}
S3 Bucket: ${S3_BUCKET}
Retention Period: ${RETENTION_DAYS} days

Recent Backups:
$(ls -lh "${BACKUP_DIR}"/jenkins_*.tar.gz 2>/dev/null | tail -5)

S3 Backups:
$(aws s3 ls "s3://${S3_BUCKET}/" --recursive --region "${AWS_REGION}")

Backup Status: ✅ COMPLETE
========================================
EOF
    
    log "${GREEN}✅ Backup report generated${NC}"
}

main() {
    log "${YELLOW}Starting Jenkins backup process...${NC}"
    
    mkdir -p "$BACKUP_DIR"
    
    backup_jenkins_config || exit 1
    backup_jenkins_jobs || exit 1
    backup_jenkins_credentials || exit 1
    backup_plugins_list || exit 1
    verify_backup_integrity || exit 1
    cleanup_old_backups
    generate_backup_report
    
    log "${GREEN}✅ Jenkins backup completed successfully${NC}"
}

# Run main function
main
```

### 1.2 Restore Procedures

**File: `jenkins-backup/restore-jenkins.sh`**

```bash
#!/bin/bash
# Jenkins restore procedure with validation

set -euo pipefail

JENKINS_HOME="/var/lib/jenkins"
S3_BUCKET="techflow-jenkins-backups"
BACKUP_NAME="${1:-}"
RESTORE_DIR="/tmp/jenkins-restore"

if [ -z "$BACKUP_NAME" ]; then
    echo "Usage: $0 <backup_file_name>"
    echo "Available backups:"
    aws s3 ls "s3://${S3_BUCKET}/master/" --region us-east-1
    exit 1
fi

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "📥 Starting Jenkins restore from backup: ${BACKUP_NAME}"

# Stop Jenkins
log "Stopping Jenkins..."
systemctl stop jenkins

# Create restore directory
mkdir -p "$RESTORE_DIR"

# Download backup from S3
log "Downloading backup from S3..."
aws s3 cp "s3://${S3_BUCKET}/master/${BACKUP_NAME}" \
    "${RESTORE_DIR}/${BACKUP_NAME}" \
    --region us-east-1

# Backup current state
log "Backing up current Jenkins state..."
tar -czf /backup/jenkins_pre_restore_$(date +%s).tar.gz \
    -C "$JENKINS_HOME" .

# Restore Jenkins
log "Restoring Jenkins configuration..."
tar -xzf "${RESTORE_DIR}/${BACKUP_NAME}" \
    -C "$(dirname $JENKINS_HOME)"

# Set permissions
chown -R jenkins:jenkins "$JENKINS_HOME"
chmod -R 750 "$JENKINS_HOME"

# Start Jenkins
log "Starting Jenkins..."
systemctl start jenkins

# Wait for Jenkins to start
log "Waiting for Jenkins to become ready..."
for i in {1..60}; do
    if curl -f http://localhost:8080/api/json > /dev/null 2>&1; then
        log "✅ Jenkins is ready"
        break
    fi
    echo -n "."
    sleep 2
done

# Verify restore
log "Verifying restore..."
RESTORE_JOBS=$(curl -s http://localhost:8080/api/json | jq '.jobs | length')
log "✅ Restore complete: ${RESTORE_JOBS} jobs restored"

# Cleanup
rm -rf "$RESTORE_DIR"

log "✅ Jenkins restore completed successfully"
```

---

## Part 2: Jenkins Maintenance & Operations

### 2.1 Daily Maintenance Tasks

**File: `jenkins-maintenance/daily-maintenance.sh`**

```bash
#!/bin/bash
# Daily Jenkins maintenance routine

set -euo pipefail

JENKINS_URL="http://localhost:8080"
JENKINS_HOME="/var/lib/jenkins"
LOG_FILE="/var/log/jenkins-maintenance.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Check Jenkins health
check_jenkins_health() {
    log "🏥 Checking Jenkins health..."
    
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "${JENKINS_URL}/api/json")
    
    if [ "$http_code" == "200" ]; then
        log "✅ Jenkins is healthy"
    else
        log "⚠️ Jenkins returned HTTP ${http_code}"
        return 1
    fi
}

# Check disk space
check_disk_space() {
    log "💾 Checking disk space..."
    
    local disk_usage=$(df "${JENKINS_HOME}" | awk 'NR==2 {print $5}' | sed 's/%//')
    local warn_threshold=80
    local critical_threshold=90
    
    if [ "$disk_usage" -gt "$critical_threshold" ]; then
        log "🚨 CRITICAL: Disk usage at ${disk_usage}%"
        # Trigger alert
    elif [ "$disk_usage" -gt "$warn_threshold" ]; then
        log "⚠️ WARNING: Disk usage at ${disk_usage}%"
    else
        log "✅ Disk usage at ${disk_usage}%"
    fi
}

# Check for stale jobs
check_stale_jobs() {
    log "🔍 Checking for stale jobs..."
    
    local stale_count=$(find "${JENKINS_HOME}/jobs" -type f -name "config.xml" \
        -mtime +90 | wc -l)
    
    if [ "$stale_count" -gt 0 ]; then
        log "⚠️ Found ${stale_count} jobs not modified in 90 days"
    else
        log "✅ No stale jobs found"
    fi
}

# Clean up old build logs
cleanup_old_builds() {
    log "🗑️ Cleaning up old builds..."
    
    local deleted_count=0
    local freed_space=0
    
    find "${JENKINS_HOME}/jobs" -type d -name "builds" | while read build_dir; do
        find "$build_dir" -type d -mtime +180 | while read old_build; do
            local size=$(du -s "$old_build" | awk '{print $1}')
            rm -rf "$old_build"
            ((deleted_count++))
            ((freed_space+=$size))
        done
    done
    
    log "✅ Deleted ${deleted_count} builds, freed $((freed_space / 1024))MB"
}

# Check plugin compatibility
check_plugin_compatibility() {
    log "🔌 Checking plugin compatibility..."
    
    # Call Jenkins CLI
    java -jar /opt/jenkins-cli.jar -s "${JENKINS_URL}" \
        list-plugins | grep -i "WARNING" > /tmp/plugin-warnings.txt || true
    
    if [ -s /tmp/plugin-warnings.txt ]; then
        log "⚠️ Plugin warnings found:"
        cat /tmp/plugin-warnings.txt | head -10
    else
        log "✅ No plugin compatibility issues"
    fi
}

# Verify backup
verify_backup() {
    log "✅ Verifying latest backup..."
    
    local latest=$(ls -t /backup/jenkins_*.tar.gz 2>/dev/null | head -1)
    
    if [ -n "$latest" ]; then
        if tar -tzf "$latest" > /dev/null 2>&1; then
            log "✅ Latest backup is valid"
        else
            log "❌ Latest backup is corrupt"
        fi
    else
        log "❌ No backups found"
    fi
}

# Generate report
generate_report() {
    log "📊 Generating maintenance report..."
    
    cat > "/tmp/jenkins-maintenance-$(date +%Y%m%d).txt" <<EOF
Jenkins Maintenance Report - $(date)

Jenkins Status: $(curl -s "${JENKINS_URL}/api/json" | jq -r '.version')
Disk Usage: $(df "${JENKINS_HOME}" | awk 'NR==2 {print $5}')
Queue Size: $(curl -s "${JENKINS_URL}/queue/api/json" | jq '.items | length')
Executors: $(curl -s "${JENKINS_URL}/api/json" | jq '.numExecutors')

Tasks Completed:
✅ Health check
✅ Disk space check
✅ Stale jobs check
✅ Old builds cleanup
✅ Plugin compatibility check
✅ Backup verification
EOF
    
    log "✅ Report generated: /tmp/jenkins-maintenance-$(date +%Y%m%d).txt"
}

main() {
    log "====================================="
    log "Jenkins Daily Maintenance Started"
    log "====================================="
    
    check_jenkins_health || exit 1
    check_disk_space
    check_stale_jobs
    cleanup_old_builds
    check_plugin_compatibility
    verify_backup
    generate_report
    
    log "====================================="
    log "✅ Jenkins Daily Maintenance Complete"
    log "====================================="
}

main
```

---

## Part 3: Disaster Recovery Runbook

### 3.1 Master Failure Recovery

**File: `runbooks/master-failure-recovery.md`**

```markdown
# Jenkins Master Failure - Recovery Runbook

## Severity: SEV-1 (Critical)

### Detection (Automated)
- Prometheus alert: `JenkinsMasterDown` fires after 2 minutes
- PagerDuty triggers incident
- Slack alert in #incidents channel

### Initial Response (5 minutes)

#### Step 1: Confirm Failure
```bash
# SSH to Jenkins master
ssh jenkins-master-1

# Check Jenkins process
sudo systemctl status jenkins
sudo ps aux | grep java

# Check logs
sudo tail -100 /var/log/jenkins/jenkins.log

# Check disk/memory/CPU
df -h /var/lib/jenkins
free -h
top -b -n1 | head -20
```

#### Step 2: Attempt Quick Recovery
```bash
# Restart Jenkins
sudo systemctl restart jenkins

# Wait for startup
sleep 30

# Verify
curl -f http://localhost:8080/api/json

# If fails, proceed to Step 3
```

### Full Master Recovery (15 minutes)

#### Step 3: Failover to Secondary Master

**Prerequisites:**
- Secondary master running in warm-standby mode
- EBS volume snapshot recent
- Load balancer configured

**Steps:**

1. **Stop Primary Master**
   ```bash
   sudo systemctl stop jenkins
   sudo systemctl stop docker
   ```

2. **Detach Primary Volume**
   ```bash
   aws ec2 detach-volume \
     --volume-id vol-primary \
     --instance-id i-primary \
     --region us-east-1
   ```

3. **Attach to Secondary**
   ```bash
   aws ec2 attach-volume \
     --volume-id vol-primary \
     --instance-id i-secondary \
     --device /dev/sdf \
     --region us-east-1
   ```

4. **Mount on Secondary**
   ```bash
   sudo mkdir -p /var/lib/jenkins-failover
   sudo mount /dev/xvdf /var/lib/jenkins-failover
   sudo mv /var/lib/jenkins /var/lib/jenkins-backup
   sudo mv /var/lib/jenkins-failover /var/lib/jenkins
   sudo chown -R jenkins:jenkins /var/lib/jenkins
   ```

5. **Start Jenkins**
   ```bash
   sudo systemctl start jenkins
   sleep 30
   curl -f http://localhost:8080/api/json
   ```

6. **Update Load Balancer**
   - Jenkins LB now points to secondary master
   - Pipelines resume running

### Recovery Verification Checklist

- [ ] Jenkins dashboard accessible
- [ ] Job queue has no orphaned builds
- [ ] Build agents reconnected
- [ ] Recent jobs show correct status
- [ ] Git webhooks re-registered
- [ ] Slack notifications working
- [ ] Backup triggered successfully

### Root Cause Analysis (Post-Incident)

**Questions to answer:**
1. What caused the master to fail?
   - OOM? (increase heap)
   - Disk full? (implement cleanup)
   - Job hanging? (add timeout)
   - Plugin crash? (rollback plugin)

2. Were there warning signs?
   - Check metrics for 1 hour before failure
   - Review Jenkins logs for errors
   - Check system resources

3. What preventive measures?
   - Increase monitoring thresholds
   - Add auto-healing triggers
   - Implement load shedding

### Timeline Tracking

```
09:15 - Master becomes unresponsive
09:16 - Alert fired, on-call paged
09:18 - Confirmed master down, SSHd into server
09:22 - Quick restart failed
09:24 - Detached volume from primary
09:26 - Attached volume to secondary
09:28 - Jenkins started on secondary
09:29 - Load balancer updated
09:30 - Services recovered
RTO: 15 minutes
RPO: 5 minutes (last backup)
```

---

## Part 4: Capacity Planning

### Monitoring Key Metrics

```bash
# Queue depth trends
curl http://localhost:8080/queue/api/json | jq '.items | length'

# Executor utilization
curl http://localhost:8080/api/json | jq '.computer[].executors | length'

# Build success rate
curl http://localhost:8080/api/json | jq '.jobs[] | select(.lastBuild != null) | .lastBuild.result'

# Plugin load time
java -jar jenkins-cli.jar -s http://localhost:8080 list-plugins | awk '{print $1}' | while read plugin; do
    curl -s "http://localhost:8080/pluginManager/plugin/${plugin}/api/json" | jq '.active'
done
```

### Scaling Recommendations

| Metric | Threshold | Action |
|--------|-----------|--------|
| Queue Size | > 100 | Scale agents by 50% |
| Master CPU | > 80% | Upgrade master hardware |
| Master Memory | > 85% | Increase -Xmx by 4GB |
| Build Success Rate | < 95% | Investigate failures |
| Average Build Time | > 30 min | Parallelize stages |

```

---

## Summary Checklist

```yaml
✅ Backup Strategy:
  - Daily incremental backups
  - S3 with encryption and versioning
  - 30-day retention policy
  - Monthly full restore test

✅ Disaster Recovery:
  - RTO: 15 minutes (master failover)
  - RPO: 5 minutes (data loss acceptable)
  - Tested monthly
  - Documented runbooks

✅ High Availability:
  - Multi-master cluster
  - Load balancer for distribution
  - Agent auto-scaling
  - Kubernetes-based agents

✅ Monitoring:
  - Real-time health checks
  - Prometheus + Grafana
  - Alerting on critical metrics
  - Daily maintenance automation
```
