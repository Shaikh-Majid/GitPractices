# 🐧 Linux Scenarios: Scratch to Advanced - Complete Learning Path

**Target Audience**: Aspiring to 4YOE DevOps Engineers  
**Learning Progression**: Fundamentals → Intermediate → Advanced → Expert  
**Total Scenarios**: 40+ practical scenarios with solutions  
**Difficulty Levels**: Beginner (Level 1-2) → Intermediate (Level 3-4) → Advanced (Level 5-6) → Expert (Level 7-8)

---

# 📚 LEVEL 1: SCRATCH - LINUX FUNDAMENTALS

## Scenario 1.1: Your First Linux Server - SSH Access & Navigation

**Context**: You got your first Linux server access. You need to connect and explore.

```bash
# CHALLENGE 1: SSH Connection

# Your SSH key is in: ~/.ssh/id_rsa
# Target server: 192.168.1.100
# Default username: ubuntu
# Default port: 22

# SOLUTION 1: Connect to server
ssh ubuntu@192.168.1.100

# If SSH key not in default location
ssh -i /path/to/private/key ubuntu@192.168.1.100

# If using non-standard port (e.g., 2222)
ssh -i ~/.ssh/id_rsa -p 2222 ubuntu@192.168.1.100

# SOLUTION 2: First-time SSH key verification
# You'll see:
# "The authenticity of host '192.168.1.100' can't be established..."
# Type 'yes' to accept and add to known_hosts

# SOLUTION 3: Verify you're logged in
whoami
# Output: ubuntu

id
# Output: uid=1000(ubuntu) gid=1000(ubuntu) groups=1000(ubuntu)

# SOLUTION 4: Check current directory
pwd
# Output: /home/ubuntu

# SOLUTION 5: List files in current directory
ls -la
# Shows: .ssh directory, config files, etc.

# SOLUTION 6: Create first directory
mkdir my-first-project
cd my-first-project
pwd
# Confirms you're in: /home/ubuntu/my-first-project

# SOLUTION 7: Create your first file
echo "Hello from Linux!" > hello.txt
cat hello.txt
# Output: Hello from Linux!

# SOLUTION 8: Disconnect from server
exit
# OR
logout
```

---

## Scenario 1.2: File Permissions & Ownership Basics

**Context**: You need to manage file access for multiple users on shared server.

```bash
# CHALLENGE: Set proper permissions for web application

# Your web app files are in /var/www/app/
# Web server user: www-data
# App owner: ubuntu

# SOLUTION 1: Check current permissions
ls -la /var/www/app/
# Output format: drwxr-xr-x 4 ubuntu ubuntu 4096 Mar 31 config.yml

# Breakdown of: drwxr-xr-x
# d = directory
# rwx = owner (ubuntu) can read, write, execute
# r-x = group can read, execute (no write)
# r-x = others can read, execute (no write)

# SOLUTION 2: Change owner to web server user
sudo chown www-data:www-data /var/www/app
sudo chown -R www-data:www-data /var/www/app/*  # Recursive

# Verify
ls -la /var/www/app/
# Now shows: www-data www-data (instead of ubuntu)

# SOLUTION 3: Set permissions using chmod (numeric)
# Permission breakdown:
# 7 = 4+2+1 = read + write + execute (rwx)
# 5 = 4+0+1 = read + execute (r-x)
# 4 = read only (r--)

chmod 755 /var/www/app        # rwxr-xr-x (owner full, others read-exec)
chmod 750 /var/www/app        # rwxr-x--- (owner full, group read-exec)
chmod 644 /var/www/app/config # rw-r--r-- (owner read-write, others read)
chmod 600 /var/www/app/secret # rw------- (owner only, no group/others)

# SOLUTION 4: Set permissions using chmod (symbolic)
chmod u+x script.sh            # Add execute for owner
chmod g+r config.yml           # Add read for group
chmod o-r secret.key           # Remove read for others
chmod a+r README.md            # Add read for all

# SOLUTION 5: Set umask (default permissions for new files)
# Current umask
umask
# Output: 0022

# Umask calculation: 0777 - umask = default file permissions
# 0777 - 0022 = 0755 (rwxr-xr-x)

# Change umask for more restrictive defaults
umask 0077  # New files: rw------- (owner only)

# Verify
touch test-file
ls -la test-file
# Output: -rw------- (no group/other access)

# Make persistent (in ~/.bashrc or ~/.bash_profile)
echo "umask 0077" >> ~/.bashrc
source ~/.bashrc
```

---

## Scenario 1.3: Basic User & Group Management

**Context**: Create user accounts for new team members on shared development server.

```bash
# CHALLENGE: Add 3 new developers with proper group assignments

# Users to add: alice, bob, charlie
# They should all be in 'developers' group
# They should NOT have sudo access (initially)

# SOLUTION 1: Create a new group
sudo groupadd developers

# Verify
grep developers /etc/group
# Output: developers:x:1001:

# SOLUTION 2: Create individual users
sudo useradd -m -s /bin/bash -G developers alice
sudo useradd -m -s /bin/bash -G developers bob
sudo useradd -m -s /bin/bash -G developers charlie

# Breakdown:
# -m = create home directory
# -s /bin/bash = set login shell to bash (not sh or nologin)
# -G developers = add to developers group

# SOLUTION 3: Verify users were created
id alice
# Output: uid=1001(alice) gid=1001(alice) groups=1001(alice),1001(developers)

# View all users
cut -d: -f1 /etc/passwd | tail -5
# Shows: alice, bob, charlie

# SOLUTION 4: Set passwords for users
sudo passwd alice
# Interactive: enter new password twice

# Or programmatically
echo "alice:SecurePassword123" | sudo chpasswd

# SOLUTION 5: Give alice sudo access
sudo usermod -aG sudo alice
# Check: alice can now run commands with 'sudo'

# SOLUTION 6: Remove bob from developers group
sudo deluser bob developers
# Verify
id bob
# Now shows: groups=1001(bob) (no developers group)

# SOLUTION 7: Delete user account
sudo userdel -r charlie
# -r = remove home directory too

# Verify user is gone
id charlie
# Output: id: 'charlie': no such user
```

---

## Scenario 1.4: Installing Software & Package Management

**Context**: Install common tools needed for development.

```bash
# CHALLENGE: Install Git, Node.js, and Docker on Ubuntu server

# SOLUTION 1: Update package cache (CRITICAL - always do first!)
sudo apt update
# Downloads package lists (doesn't install anything)

# SOLUTION 2: View available software
apt search git | head -20
# Shows: git, git-doc, git-man, etc.

# SOLUTION 3: Install single package
sudo apt install -y git
# -y = automatic yes to prompts

# Verify installation
git --version
# Output: git version 2.34.1

# SOLUTION 4: Install multiple packages at once
sudo apt install -y curl wget htop neofetch

# SOLUTION 5: Install from non-default repository
# Add Node.js repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify
node --version
# Output: v18.16.0

npm --version
# Output: 9.6.7

# SOLUTION 6: List installed packages
apt list --installed | grep node
# Shows all installed Node.js packages

# SOLUTION 7: Update single package to latest
sudo apt upgrade nodejs

# SOLUTION 8: Remove package
sudo apt remove git
# Keep config files

sudo apt purge git
# Remove everything including config files

# SOLUTION 9: Clean up package cache
sudo apt autoremove   # Remove unused dependencies
sudo apt autoclean    # Clean cache

# Verify before and after
sudo du -sh /var/cache/apt/
# Shows cache size
```

---

# 📚 LEVEL 2: BEGINNER - BASIC ADMINISTRATION

## Scenario 2.1: Process Management & Monitoring

**Context**: Web application is running slowly. Need to diagnose which process is consuming resources.

```bash
# CHALLENGE: Find resource-hungry processes and manage them

# SOLUTION 1: See all running processes with details
ps aux
# Shows: PID, user, CPU%, memory%, command

# Example output:
# USER       PID  %CPU %MEM    VSZ   RSS COMMAND
# root       1    0.0  0.2  103424  9728 /sbin/init
# ubuntu   1234  15.2  8.5 1024000 438000 /usr/bin/python3 app.py

# SOLUTION 2: Find process by name
ps aux | grep python
# Shows: grep output with process details

# SOLUTION 3: Real-time process monitoring (interactive)
top
# Shows live updates of running processes
# Press: q to quit, 1 to see per-CPU, M to sort by memory, P to sort by CPU

# SOLUTION 4: Modern process monitor (nicer than top)
sudo apt install -y htop
htop
# Color-coded, easier to read

# SOLUTION 5: Check memory usage
free -h
# Shows: total, used, free, shared, buffers, cached

# SOLUTION 6: Check which process is using most memory
ps aux --sort=-%mem | head -5
# Shows top 5 processes by memory usage

# SOLUTION 7: Check single process details
ps aux | grep python
# Get PID from output, e.g., 1234

# Deep dive into process
cat /proc/1234/status | grep -E "VmPeak|VmHWM|Threads"
# Shows: peak memory, max memory, thread count

# SOLUTION 8: Kill misbehaving process
kill 1234           # Graceful termination (SIGTERM)
kill -9 1234        # Force kill (SIGKILL)
killall python      # Kill by name (all matching processes)

# SOLUTION 9: List open files by a process
lsof -p 1234
# Shows: all files process has open (sockets, pipes, etc.)

# SOLUTION 10: Show process tree (parent-child relationships)
pstree -p
# Shows hierarchical view of all processes
```

---

## Scenario 2.2: Disk Space Troubleshooting

**Context**: Disk is full. You have 1 hour to find and clean up before backups fail.

```bash
# CHALLENGE: Emergency disk space recovery

# SOLUTION 1: Check disk usage
df -h
# Shows partition usage

# Example:
# /dev/sda1       100G   95G   5G  95% /

# /dev/sda1 is 95% full - CRITICAL!

# SOLUTION 2: Identify which directory is consuming space
du -sh /*
# Shows size of each directory in root

# Output:
# 50G     /home
# 30G     /var
# 5G      /usr
# 2G      /etc
# 1G      /boot

# SOLUTION 3: Drill down into largest directory
du -sh /var/*
# Shows subdirectories in /var

# Output:
# 20G     /var/log
# 8G      /var/cache
# 2G      /var/lib

# /var/log is the culprit!

# SOLUTION 4: Find largest files
find /var/log -type f -exec ls -lh {} \; | sort -k5 -h | tail -10
# Shows 10 largest files in /var/log

# Or use du for directories
du -sh /var/log/* | sort -h | tail -10

# SOLUTION 5: Check what's using disk
du -sh /var/log/*.log | sort -rh | head -10
# Shows individual log files by size

# SOLUTION 6: Emergency cleanup - delete old logs
# Check size first
du -sh /var/log/app.log.1
# Example: 12G

# Delete old rotated logs
rm /var/log/*.1
rm /var/log/*.gz
# Frees up 15GB immediately!

# SOLUTION 7: Compress logs instead of deleting
gzip /var/log/large-log.log
# Compresses to .gz file, typically 80-90% smaller

# SOLUTION 8: Check if disk is freed
df -h
# Should show available space increased

# SOLUTION 9: Identify inode exhaustion (different from disk space)
df -i
# Shows inode usage (can fill up even if disk space available)

# SOLUTION 10: Find directory with most files
find /var/log -type f | wc -l
# Shows total files

# Find inodes by directory
du -i /var/log/* | sort -rn | head -10
```

---

## Scenario 2.3: Network Connectivity & Port Troubleshooting

**Context**: Web application not accessible on port 8080. Need to diagnose why.

```bash
# CHALLENGE: Web app on port 8080 is unreachable

# SOLUTION 1: Check if port is listening
netstat -tlnp | grep 8080
# Shows if anything is listening on 8080

# Output format:
# tcp  0  0 127.0.0.1:8080  0.0.0.0:0  LISTEN  1234/python

# Note: 127.0.0.1 means localhost only (not accessible from other hosts!)

# SOLUTION 2: Modern version (netstat deprecated)
ss -tlnp | grep 8080

# SOLUTION 3: Check application is actually running
ps aux | grep python
# Look for: /usr/bin/python3 app.py

# SOLUTION 4: Check if port is blocked by firewall
sudo iptables -L -n | grep 8080
# Shows firewall rules

# SOLUTION 5: Check application logs
tail -50 /var/log/app.log
# Look for: connection errors, binding errors

# SOLUTION 6: Try connecting from localhost
curl http://localhost:8080
# If this works, app is running but firewall blocks external access

# SOLUTION 7: Check if firewall is running
sudo systemctl status ufw
# Or
sudo iptables -L -n

# SOLUTION 8: Allow port through firewall
sudo ufw allow 8080/tcp
# Or
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
sudo iptables-save

# SOLUTION 9: Test from another machine
ping 192.168.1.100       # Check if host is reachable
telnet 192.168.1.100 8080  # Check specific port
# If: "Connection refused" → firewall or app not listening
# If: "Connection timed out" → network unreachable

# SOLUTION 10: Check routing
ip route show
# Shows: where packets are routed

# SOLUTION 11: DNS resolution
nslookup app.company.com
dig @8.8.8.8 app.company.com
# Verify correct IP address
```

---

# 📚 LEVEL 3: INTERMEDIATE - SYSTEM ADMINISTRATION

## Scenario 3.1: Systemd Service Management & Troubleshooting

**Context**: Application crashed. Need to restart as service, auto-start on boot, and monitor for failures.

```bash
# CHALLENGE: Create and manage payment-app as systemd service

# SOLUTION 1: Create systemd service file
sudo vim /etc/systemd/system/payment-app.service

# Content:
[Unit]
Description=Payment Processing Application
After=network.target
Wants=payment-app-monitor.service

[Service]
Type=simple
User=payment
WorkingDirectory=/opt/payment-app
ExecStart=/opt/payment-app/bin/payment-app.sh
Restart=always
RestartSec=10
StartLimitBurst=5
StartLimitIntervalSec=300

# Kill remaining process after timeout
KillMode=process
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target

# SOLUTION 2: Reload systemd daemon
sudo systemctl daemon-reload

# SOLUTION 3: Enable service (auto-start on boot)
sudo systemctl enable payment-app.service

# SOLUTION 4: Start service
sudo systemctl start payment-app.service

# SOLUTION 5: Check service status
sudo systemctl status payment-app.service

# Output shows:
# ● payment-app.service - Payment Processing Application
#    Loaded: loaded (/etc/systemd/system/payment-app.service)
#    Active: active (running) since Mon 2026-03-31 10:00:00 UTC
#    PID: 1234

# SOLUTION 6: View service logs
journalctl -u payment-app.service -f
# -f = follow (tail -f equivalent)

# SOLUTION 7: View logs for specific time period
journalctl -u payment-app.service --since "2 hours ago"
journalctl -u payment-app.service --since "today"

# SOLUTION 8: Monitor service restart attempts
watch -n 2 'sudo systemctl status payment-app.service | grep -A 5 "Restart"'

# SOLUTION 9: Create timer for periodic execution
sudo vim /etc/systemd/system/payment-app-backup.timer

[Unit]
Description=Payment App Backup Timer
Requires=payment-app-backup.service

[Timer]
OnBootSec=10min
OnUnitActiveSec=1d
Persistent=true

[Install]
WantedBy=timers.target

# SOLUTION 10: Create corresponding service
sudo vim /etc/systemd/system/payment-app-backup.service

[Unit]
Description=Payment App Backup Service
After=payment-app.service

[Service]
Type=oneshot
ExecStart=/opt/payment-app/bin/backup.sh

# SOLUTION 11: Enable and start timer
sudo systemctl enable payment-app-backup.timer
sudo systemctl start payment-app-backup.timer

# SOLUTION 12: Check timer status
sudo systemctl list-timers payment-app-backup.timer

# SOLUTION 13: If service keeps failing, investigate
# Check resource limits
systemctl show payment-app.service -p MemoryLimit -p CPUQuota

# SOLUTION 14: Stop and disable service
sudo systemctl stop payment-app.service
sudo systemctl disable payment-app.service
```

---

## Scenario 3.2: Cron Jobs & Scheduled Tasks

**Context**: Need to automate daily backups, log rotation, and health checks.

```bash
# CHALLENGE: Create automated daily backup, hourly health check

# SOLUTION 1: View current cron jobs
crontab -l
# Shows all scheduled jobs for current user

# SOLUTION 2: Edit cron jobs
crontab -e
# Opens editor (vi by default)

# SOLUTION 3: Cron syntax explanation
# *     *     *     *     *     command
# min   hour  dom   mon   dow   command
# 0-59  0-23  1-31  1-12  0-6   

# Examples:
0 2 * * *       /opt/backup.sh                  # Daily at 2:00 AM
*/15 * * * *    /opt/health-check.sh            # Every 15 minutes
0 0 1 * *       /opt/monthly-report.sh          # 1st day of each month at midnight
0 9-17 * * 1-5  /opt/business-hours.sh          # Weekdays 9 AM-5 PM

# SOLUTION 4: Create backup cron job
cat > ~/backup-cron.txt << 'EOF'
0 2 * * * /opt/backup.sh >> /var/log/backup.log 2>&1
EOF

crontab ~/backup-cron.txt

# SOLUTION 5: Add environment variables for cron
crontab -e

# Add at top:
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
MAILTO=admin@company.com

0 2 * * * /opt/backup.sh

# SOLUTION 6: Create system-wide cron job (runs as root)
sudo vim /etc/cron.d/system-backup

0 2 * * * root /opt/system-backup.sh >> /var/log/backup.log 2>&1

# SOLUTION 7: Create daily cron in /etc/cron.daily/
sudo vim /etc/cron.daily/payment-app-cleanup
#!/bin/bash
/opt/payment-app/bin/cleanup.sh

sudo chmod +x /etc/cron.daily/payment-app-cleanup

# SOLUTION 8: Monitor cron job execution
grep CRON /var/log/syslog | tail -20
# Shows all cron executions

# SOLUTION 9: Debug failing cron job
# Add logging to script
#!/bin/bash
echo "$(date): Backup started" >> /var/log/backup-debug.log

# SOLUTION 10: Run cron job manually for testing
/opt/backup.sh

# SOLUTION 11: Schedule one-time task (at command)
at 3:00 PM tomorrow
/opt/one-time-task.sh
# Press CTRL+D

# SOLUTION 12: List scheduled at jobs
atq

# SOLUTION 13: Remove cron job
crontab -r  # Remove all (dangerous!)
crontab -e  # Edit and delete individual lines
```

---

## Scenario 3.3: Log Management & Analysis

**Context**: Application generates 5GB of logs daily. Need rotation, compression, archival.

```bash
# CHALLENGE: Set up intelligent log rotation and management

# SOLUTION 1: View current logrotate configuration
cat /etc/logrotate.conf

# SOLUTION 2: Create logrotate config for application
sudo vim /etc/logrotate.d/payment-app

/var/log/payment-app/*.log {
    size 100M                      # Rotate when 100MB
    daily                          # Check daily
    rotate 10                      # Keep 10 old logs
    compress                       # Gzip compress
    delaycompress                  # Don't compress current rotation
    notifempty                     # Don't rotate empty files
    create 0640 payment payment    # Create new file with permissions
    missingok                      # Don't error if file missing
    
    postrotate
        systemctl reload payment-app > /dev/null 2>&1 || true
    endscript
}

# SOLUTION 3: Test logrotate configuration
sudo logrotate -v /etc/logrotate.d/payment-app
# Shows what would happen

# SOLUTION 4: Force logrotate
sudo logrotate -f /etc/logrotate.d/payment-app

# SOLUTION 5: Check logrotate execution in cron
sudo cat /etc/cron.daily/logrotate
# Runs daily at 6:25 AM by default

# SOLUTION 6: Analyze log files for errors
grep -i "error\|fail\|exception" /var/log/payment-app/app.log | head -20

# SOLUTION 7: Count occurrences of error patterns
grep -i "error" /var/log/payment-app/app.log | wc -l

# SOLUTION 8: Extract specific time window
sed -n '/2026-03-31 10:00/,/2026-03-31 11:00/p' /var/log/payment-app/app.log

# SOLUTION 9: Parse and analyze structured logs
grep "error" /var/log/payment-app/app.log | \
  awk '{print $NF}' | sort | uniq -c | sort -rn | head -10
# Shows most common errors

# SOLUTION 10: Monitor logs in real-time
tail -f /var/log/payment-app/app.log | grep -i "error\|warn"

# SOLUTION 11: Set up remote logging (syslog to central server)
sudo vim /etc/rsyslog.d/99-remote.conf

# Forward payment-app logs to central syslog
:programname, isequal, "payment-app" @@syslog-server.internal:514

sudo systemctl restart rsyslog

# SOLUTION 12: Verify log forwarding
logger -t payment-app "Test message"
# Check on remote syslog server

# SOLUTION 13: Archive old logs
find /var/log/payment-app -name "*.log.*" -mtime +30 -exec tar -czf {} {}.tar.gz \;

# SOLUTION 14: Delete logs older than 60 days
find /var/log/payment-app -name "*.log.*" -mtime +60 -delete

# SOLUTION 15: Monitor log disk usage
du -sh /var/log/*
```

---

# 📚 LEVEL 4: INTERMEDIATE-ADVANCED - COMPLEX TROUBLESHOOTING

## Scenario 4.1: System Performance Deep Dive

**Context**: Server is slow. 20 second response times instead of 100ms. Need to diagnose.

```bash
# CHALLENGE: Complete performance analysis and optimization

# STEP 1: Baseline metrics - get high-level overview
uptime
# Output: load average: 45.2, 42.1, 38.5 (very high for 16-core system)

free -h
# Output: Mem: 62.8Gi used: 61.2Gi available: 1.2Gi (memory pressure!)

df -h
# Output: / 99% used (disk almost full)

# STEP 2: Detailed CPU analysis
vmstat 1 10
# Column breakdown:
# r = processes runnable (should be ≤ CPU count)
# b = processes in sleep (should be low)
# us = user CPU (application time)
# sy = system CPU (kernel time)
# wa = I/O wait (waiting for disk)
# id = idle

# High 'r' column = CPU bound
# High 'wa' column = I/O bound

# STEP 3: Per-core CPU analysis
mpstat -P ALL 1 5
# Shows each CPU core individually

# STEP 4: Context switch analysis
vmstat 1 5 | grep -E "cs|in"
# cs = context switches
# in = interrupts
# High CS = too many processes fighting for CPU

# STEP 5: Process analysis
ps aux --sort=-%cpu | head -10
# Shows top processes by CPU

# STEP 6: Thread analysis (one process might have many threads)
ps -eLf | grep payment-app | wc -l
# Count threads in payment-app

# For single process detail:
cat /proc/<PID>/status | grep Threads

# STEP 7: Disk I/O analysis
iostat -x -k 1 5
# %util = disk utilization (should be <80%)
# await = I/O wait time (should be <5ms)
# r_await = read latency
# w_await = write latency

# STEP 8: Disk I/O by process
iotop -o -b -n 1
# Shows which processes are doing I/O

# STEP 9: Memory pressure analysis
cat /proc/pressure/memory
# Shows: some, full percentages
# High = severe memory pressure

# STEP 10: SWAP analysis
free -h | grep Swap
# If SWAP > 0 and increasing = memory crisis
# Check SWAP I/O:
vmstat 1 5 | grep "si\|so"

# STEP 11: Network analysis
netstat -an | grep ESTABLISHED | wc -l
# High number of connections = network overhead

# ss is modern version:
ss -an | grep ESTABLISHED | wc -l

# STEP 12: Network packet analysis
tcpdump -i eth0 -n -c 100 'tcp port 3306'
# Captures packets to/from MySQL

# STEP 13: System calls analysis
strace -c -p <PID>
# Shows which system calls take most time

# STEP 14: Create performance report
cat > /tmp/perf-report.txt << 'EOF'
=== PERFORMANCE ANALYSIS REPORT ===
Date: $(date)

CPU:
- Load average: $(uptime | awk -F'average:' '{print $2}')
- CPU cores: $(nproc)
- Top process: $(ps aux --sort=-%cpu | head -2 | tail -1)

Memory:
- Total: $(free -h | grep Mem | awk '{print $2}')
- Used: $(free -h | grep Mem | awk '{print $3}')
- Available: $(free -h | grep Mem | awk '{print $7}')

Disk:
- Root usage: $(df / | awk 'NR==2 {print $5}')
- Inodes: $(df -i / | awk 'NR==2 {print $5}')

I/O:
- Disk util: $(iostat -x 1 1 | tail -1 | awk '{print $NF}')

Network:
- Established: $(ss -an | grep ESTABLISHED | wc -l)
EOF

cat /tmp/perf-report.txt

# STEP 15: Optimization recommendations
echo "=== RECOMMENDATIONS ==="
echo "1. If high CPU: Profile application, reduce thread count"
echo "2. If high I/O: Check disk speed, optimize queries, use SSD"
echo "3. If high memory: Add RAM, check for leaks, increase SWAP"
echo "4. If disk full: Delete old logs, clean cache"
echo "5. If many connections: Close idle connections, increase limits"
```

---

## Scenario 4.2: Network Debugging - Packet Analysis

**Context**: Users report intermittent connectivity issues. Need to capture and analyze packets.

```bash
# CHALLENGE: Find network packet loss and connection issues

# SOLUTION 1: Continuous ping to detect packet loss
ping -c 100 database.internal | grep -E "transmitted|loss"
# Output: 100 packets transmitted, 95 received, 5% packet loss

# SOLUTION 2: Traceroute to find where packets are lost
traceroute -m 15 database.internal
# Shows: each hop, latency, RTT

# SOLUTION 3: Modern MTR (continuous traceroute)
mtr -c 100 database.internal
# Press 'q' to quit

# SOLUTION 4: Capture packets to/from MySQL
sudo tcpdump -i eth0 -w mysql.pcap 'tcp port 3306'
# Ctrl+C to stop
# Analyze offline: wireshark mysql.pcap

# SOLUTION 5: Capture and display in real-time
sudo tcpdump -i eth0 -n 'tcp port 3306'
# Shows: src IP, dst IP, port, flags

# SOLUTION 6: Look for SYN packets (connection initiation)
sudo tcpdump -i eth0 'tcp[tcpflags] & tcp-syn != 0'

# SOLUTION 7: Look for connection timeouts (RST packets)
sudo tcpdump -i eth0 'tcp[tcpflags] & tcp-rst != 0'

# SOLUTION 8: Analyze DNS resolution issues
sudo tcpdump -i eth0 'udp port 53'  # DNS port

# SOLUTION 9: Check connection status
netstat -an | awk '/tcp/ {print $6}' | sort | uniq -c | sort -rn
# Output shows: ESTABLISHED, TIME_WAIT, SYN_RECV, etc.

# High TIME_WAIT = system draining connections

# SOLUTION 10: Check for SYN flood (attack indicator)
netstat -an | grep SYN_RECV | wc -l
# If > 1000: possible SYN flood attack

# SOLUTION 11: Monitor network bandwidth
iftop -i eth0
# Shows real-time bandwidth by connection

# SOLUTION 12: Check network interface errors
ethtool -S eth0 | grep -i "error\|drop"

# SOLUTION 13: Check for duplicate IPs
arp-scan -l | sort | uniq -d
# Detects duplicate MAC addresses

# SOLUTION 14: Monitor DNS queries
sudo tcpdump -i eth0 'udp port 53' -A | grep -oP '(?<=A\s)[^:]*(?=:)' | sort | uniq -c | sort -rn | head -20

# SOLUTION 15: Connection establishment timing
curl -w "@curl-timing.txt" http://api.company.com
# File contents:
# time_namelookup:    %{time_namelookup}
# time_connect:       %{time_connect}
# time_appconnect:    %{time_appconnect}
# time_pretransfer:   %{time_pretransfer}
# time_redirect:      %{time_redirect}
# time_starttransfer: %{time_starttransfer}
# time_total:         %{time_total}
```

---

# 📚 LEVEL 5: ADVANCED - KERNEL & SYSTEM TUNING

## Scenario 5.1: Kernel Parameter Tuning for High-Performance Systems

**Context**: Database server needs to handle 100K concurrent connections. Default kernel parameters insufficient.

```bash
# CHALLENGE: Tune kernel for maximum connection handling

# SOLUTION 1: Check current connection limits
cat /proc/sys/net/core/somaxconn
# Output: 128 (too small!)

# SOLUTION 2: Check current max file descriptors
ulimit -n
# Output: 1024 (too small for 100K connections!)

# SOLUTION 3: Increase system-wide file descriptor limit
sudo vim /etc/security/limits.conf

# Add:
* soft nofile 65536
* hard nofile 131072
* soft nproc 65536
* hard nproc 131072

# Verify (after reboot or use 'ulimit' command)
ulimit -n
# Output: 65536

# SOLUTION 4: Tune TCP listen backlog
sudo sysctl -w net.core.somaxconn=4096
sudo sysctl -w net.ipv4.tcp_max_syn_backlog=8192

# Make persistent
cat >> /etc/sysctl.conf << 'EOF'
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 8192
EOF

sudo sysctl -p

# SOLUTION 5: Tune TCP connection keep-alive
sudo sysctl -w net.ipv4.tcp_keepalives_intvl=30
sudo sysctl -w net.ipv4.tcp_keepalives_probes=5
# Time-outs after: 30 * 5 = 150 seconds

# SOLUTION 6: Enable TCP fast open (reduces handshake)
sudo sysctl -w net.ipv4.tcp_fastopen=3  # 1=client, 2=server, 3=both

# SOLUTION 7: Tune TIME_WAIT socket handling (closes connections faster)
sudo sysctl -w net.ipv4.tcp_fin_timeout=30  # Default: 60
sudo sysctl -w net.ipv4.tcp_tw_reuse=1      # Reuse TIME_WAIT sockets

# WARNING: tcp_tw_reuse is risky (can cause issues with certain protocols)
# Better approach: increase TCP port range

# SOLUTION 8: Increase ephemeral port range
sudo sysctl -w net.ipv4.ip_local_port_range="1024 65535"
# Allows 64K unique outgoing connections per IP

# SOLUTION 9: Tune memory for network buffers
# Increase TCP send/receive buffers
sudo sysctl -w net.core.rmem_default=134217728   # 128MB
sudo sysctl -w net.core.rmem_max=134217728
sudo sysctl -w net.core.wmem_default=134217728
sudo sysctl -w net.core.wmem_max=134217728

# SOLUTION 10: Tune for specific application (MySQL example)
# In /etc/sysctl.conf:
net.ipv4.tcp_max_syn_backlog=8192
net.core.somaxconn=8192
net.ipv4.tcp_fin_timeout=30
net.ipv4.tcp_tw_reuse=1
net.ipv4.tcp_keepalives_intvl=30
net.ipv4.tcp_keepalives_probes=5
net.core.rmem_max=268435456  # 256MB
net.core.wmem_max=268435456
net.ipv4.ip_local_port_range=1024 65535

# SOLUTION 11: Apply all settings
sudo sysctl -p /etc/sysctl.conf

# SOLUTION 12: Verify settings applied
sudo sysctl -a | grep tcp

# SOLUTION 13: Test connection limit
# Create test script
for i in {1..50000}; do
  curl -s http://localhost:8080 &
done

# Monitor connections
watch -n 1 'netstat -an | grep ESTABLISHED | wc -l'

# SOLUTION 14: Monitor kernel resources
cat /proc/net/sockstat
# Shows: TCP sockets in use

# SOLUTION 15: Profile system under load
# Record system state
dstat -c -m -n -d -g --socket -T 300 -f load-profile.csv

# Analyze
cat load-profile.csv | tail -100 | awk -F, '{avg+=$2} END {print "Avg CPU:", avg/NR}'
```

---

## Scenario 5.2: Memory Management - Cgroups & Resource Limits

**Context**: Multiple applications sharing one server. Application A crashes = takes down Application B. Need isolation.

```bash
# CHALLENGE: Isolate applications with memory limits using cgroups

# SOLUTION 1: Check cgroup v2 support
mount | grep cgroup2
# Output: cgroup2 on /sys/fs/cgroup type cgroup2

# SOLUTION 2: Create cgroup for payment-app
sudo mkdir -p /sys/fs/cgroup/payment-app

# SOLUTION 3: Set memory limit (8GB max)
echo "8589934592" | sudo tee /sys/fs/cgroup/payment-app/memory.max
# 8GB in bytes

# SOLUTION 4: Set memory high threshold (7GB warning)
echo "7516192768" | sudo tee /sys/fs/cgroup/payment-app/memory.high
# Triggers page reclaim but doesn't fail

# SOLUTION 5: Move process to cgroup
echo $$ | sudo tee /sys/fs/cgroup/payment-app/cgroup.procs
# $$ = current process PID

# SOLUTION 6: Create cgroup via systemd (better approach)
# Edit service file:
sudo vim /etc/systemd/system/payment-app.service

[Service]
# ... other settings ...
MemoryMax=8G           # Hard limit
MemoryHigh=7G          # Soft limit (triggers reclaim)
MemoryAccounting=true  # Track memory

# SOLUTION 7: Apply systemd changes
sudo systemctl daemon-reload
sudo systemctl restart payment-app.service

# SOLUTION 8: Check cgroup memory status
sudo systemctl show payment-app.service -p MemoryMax -p MemoryHigh -p MemoryCurrent

# SOLUTION 9: Get real-time memory usage
watch -n 1 'systemctl show payment-app.service -p MemoryCurrent | awk -F= "{print \$2/1024/1024/1024 \" GB\"}"'

# SOLUTION 10: Handle out-of-memory condition
# Set restart policy
sudo vim /etc/systemd/system/payment-app.service

[Service]
Restart=always
RestartSec=30
# Will restart if OOM killer terminates it

# SOLUTION 11: Monitor OOM kills
dmesg | grep -i "out of memory"
# Shows: which process was killed

# SOLUTION 12: Create CPU limit cgroup
sudo vim /etc/systemd/system/payment-app.service

[Service]
CPUQuota=400%     # 4 cores (100% = 1 core)
CPUAccounting=true

# SOLUTION 13: Create I/O bandwidth limit
sudo vim /etc/systemd/system/payment-app.service

[Service]
BlockIOWeight=100        # 10-1000, default 500
# Combined with BlockIOWeightDevice

# SOLUTION 14: Monitor all cgroup limits
systemctl status payment-app.service

# SOLUTION 15: Create resource hierarchy (parent-child cgroups)
sudo mkdir -p /sys/fs/cgroup/services/payment-app
sudo mkdir -p /sys/fs/cgroup/services/database-app

echo "16589934592" | sudo tee /sys/fs/cgroup/services/memory.max
echo "8589934592" | sudo tee /sys/fs/cgroup/services/payment-app/memory.max
echo "8589934592" | sudo tee /sys/fs/cgroup/services/database-app/memory.max

# Parent limits: 16GB total
# Each child limited to 8GB
```

---

# 📚 LEVEL 6: ADVANCED - SECURITY & HARDENING

## Scenario 6.1: Linux Security Module - AppArmor & SELinux

**Context**: Comply with security audit: need mandatory access control (MAC) on production servers.

```bash
# CHALLENGE: Implement AppArmor (Ubuntu) or SELinux (RHEL)

# SOLUTION 1: Check if AppArmor is installed (Ubuntu)
sudo systemctl status apparmor
# Output: active (running)

# SOLUTION 2: Check current profiles
sudo aa-status
# Shows: loaded, enabled, disabled profiles

# SOLUTION 3: Create AppArmor profile for payment-app
sudo vim /etc/apparmor.d/usr.local.bin.payment-app

#include <tunables/global>

/usr/local/bin/payment-app {
  #include <abstractions/base>
  #include <abstractions/nameservice>

  # Allow reading config files
  /etc/payment-app/** r,
  /opt/payment-app/** r,
  
  # Allow writing logs
  /var/log/payment-app/** w,
  
  # Allow reading/writing data
  /var/lib/payment-app/** rw,
  
  # Allow network access (TCP/UDP)
  network inet stream,
  network inet dgram,
  
  # Allow executing libraries
  /lib/x86_64-linux-gnu/** mr,
  
  # Deny everything else
  deny /root/** rwx,
  deny /home/** rwx,
}

# SOLUTION 4: Load AppArmor profile
sudo apparmor_parser -r /etc/apparmor.d/usr.local.bin.payment-app

# SOLUTION 5: Test profile (complain mode)
sudo aa-complain /usr/local/bin/payment-app
# Logs violations but doesn't block

# SOLUTION 6: Check violations
sudo tail -50 /var/log/syslog | grep -i apparmor

# SOLUTION 7: Enforce profile (strict mode)
sudo aa-enforce /usr/local.bin.payment-app
# Now blocks violations

# SOLUTION 8: For RHEL/CentOS (SELinux)
# Check if enabled
sudo getenforce
# Output: Enforcing, Permissive, or Disabled

# SOLUTION 9: Put SELinux in permissive mode (monitoring only)
sudo setenforce 0
# 1 = Enforcing, 0 = Permissive

# SOLUTION 10: Create SELinux policy for payment-app
# This requires understanding SELinux contexts extensively
# Simpler approach: use audit2allow

# Generate audit events
# Run application for a while...

# Generate policy from audit logs
sudo audit2allow -a -M payment-app

# SOLUTION 11: Install generated policy
sudo semodule -i payment-app.pp

# SOLUTION 12: Check file contexts
ls -Z /opt/payment-app/
# Shows: contexts like unconfined_u:object_r:admin_home_t

# SOLUTION 13: Set file context
sudo chcon -R system_u:object_r:etc_t /etc/payment-app/

# SOLUTION 14: Restore default context
sudo restorecon -R -v /opt/payment-app/

# SOLUTION 15: List all SELinux modules
semodule -l
# Shows: loaded policies
```

---

## Scenario 6.2: Firewall Mastery - iptables & ufw

**Context**: Implement sophisticated firewall rules: allow internal traffic, block external except whitelisted IPs.

```bash
# CHALLENGE: Complex firewall setup with stateful inspection

# SOLUTION 1: Check current firewall status
sudo ufw status verbose

# SOLUTION 2: Enable UFW (simple firewall)
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SOLUTION 3: Allow specific incoming ports
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 80/tcp        # HTTP
sudo ufw allow 443/tcp       # HTTPS

# SOLUTION 4: Allow from specific IP
sudo ufw allow from 10.0.1.50 to any port 3306
# Allow MySQL from jump host only

# SOLUTION 5: Allow specific IP range
sudo ufw allow from 10.0.1.0/24 to any port 8080
# Allow from internal subnet

# SOLUTION 6: Block specific IP
sudo ufw deny from 203.0.113.50

# SOLUTION 7: Rate limit SSH (prevent brute force)
sudo ufw limit 22/tcp

# SOLUTION 8: Delete rules
sudo ufw delete allow 80/tcp
sudo ufw status numbered  # Get rule numbers
sudo ufw delete 1         # Delete rule number 1

# SOLUTION 9: View all UFW rules
sudo ufw show added
sudo ufw show raw

# SOLUTION 10: Switch to iptables for advanced rules
# UFW is wrapper around iptables

# Check iptables rules
sudo iptables -L -n -v
# Shows: chain, rules, packet/byte counts

# SOLUTION 11: Create stateful firewall with iptables
sudo iptables -P INPUT DROP           # Default: drop all incoming
sudo iptables -P OUTPUT ACCEPT        # Default: accept all outgoing
sudo iptables -P FORWARD DROP         # Default: drop all forwarding

# Allow loopback (critical!)
sudo iptables -A INPUT -i lo -j ACCEPT

# Allow established connections (stateful)
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow new SSH connections
sudo iptables -A INPUT -p tcp --dport 22 -m state --state NEW -j ACCEPT

# Allow HTTP/HTTPS
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Drop SYN floods (limit SYN packets)
sudo iptables -A INPUT -p tcp --dport 80 -m limit --limit 25/minute --limit-burst 100 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j DROP

# SOLUTION 12: Save iptables rules
sudo iptables-save > /tmp/iptables-backup.txt
sudo iptables-save | sudo tee /etc/iptables/rules.v4

# SOLUTION 13: Restore rules
sudo iptables-restore < /etc/iptables/rules.v4

# SOLUTION 14: Make rules persistent (Ubuntu)
sudo apt install -y iptables-persistent
sudo systemctl enable iptables.service

# SOLUTION 15: Complex rule example - port forwarding
# Forward port 8080 to 80 (non-privileged to privileged port)
sudo iptables -t nat -A PREROUTING -p tcp --dport 8080 -j REDIRECT --to-port 80
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

---

# 📚 LEVEL 7: EXPERT - STORAGE & ADVANCED FILESYSTEMS

## Scenario 7.1: LVM, RAID & Advanced Storage

**Context**: Disk failure imminent. Need to add new disk, extend volume, without downtime.

```bash
# CHALLENGE: Disk replacement and LVM extension with zero downtime

# SOLUTION 1: Check current disk/LVM status
sudo lvs
# Shows: logical volumes
sudo pvs
# Shows: physical volumes (disks)
sudo vgs
# Shows: volume groups

# Example output:
# LV     VG      Attr LSize
# root   ubuntu  -wi-ao---- 50.00g
#
# PV         VG      Fmt  Attr PSize  PFree
# /dev/sda1  ubuntu  lvm2 a--  100.00g  50.00g

# SOLUTION 2: Check if new disk is visible to system
lsblk
# Shows: /dev/sdb (new disk)

# SOLUTION 3: Create physical volume on new disk
sudo pvcreate /dev/sdb
# Initializes disk for LVM

# SOLUTION 4: Extend volume group
sudo vgextend ubuntu /dev/sdb
# Adds new disk to ubuntu volume group

# Verify
sudo vgs
# Now shows: PFree increased

# SOLUTION 5: Extend logical volume
sudo lvextend -L +20G /dev/ubuntu/root
# Adds 20GB to root volume

# OR extend by percentage of free space
sudo lvextend -l +100%FREE /dev/ubuntu/root
# Extends by all available free space

# SOLUTION 6: Resize filesystem to use new space
# For ext4:
sudo resize2fs /dev/ubuntu/root

# For XFS:
sudo xfs_growfs /

# Verify new size
df -h

# SOLUTION 7: Check RAID status (if RAID is configured)
sudo cat /proc/mdstat
# Shows: md0 : active raid1

# Example output:
# md0 : active raid1 sda1[0] sdb1[1]
#       102400 blocks super 1.2 [2/2] [UU]

# SOLUTION 8: RAID device details
sudo mdadm --detail /dev/md0

# SOLUTION 9: Replace failed disk in RAID
# If /dev/sdc failed:
sudo mdadm --manage /dev/md0 --fail /dev/sdc
sudo mdadm --manage /dev/md0 --remove /dev/sdc

# Insert new disk
# Then:
sudo mdadm --manage /dev/md0 --add /dev/sdd

# Monitor rebuild
watch -n 5 'cat /proc/mdstat | tail -3'
# Shows: recovery = X% complete

# SOLUTION 10: Check SMART status (disk health)
sudo apt install -y smartmontools
sudo smartctl -a /dev/sda
# Shows: health status, temperature, errors

# Enable SMART monitoring
sudo systemctl enable smartmontools
sudo systemctl start smartmontools

# SOLUTION 11: Check filesystem errors
sudo e2fsck -n /dev/ubuntu/root
# -n = check only, don't fix

# SOLUTION 12: Repair filesystem
sudo fsck -y /dev/ubuntu/root
# -y = auto-repair (requires unmount)

# SOLUTION 13: Backup LVM configuration
sudo vgcfgbackup ubuntu
# Creates backup in /etc/lvm/backup/

# SOLUTION 14: Create LVM snapshot for backup
sudo lvcreate -L 10G -s -n root_backup /dev/ubuntu/root
# Creates 10GB snapshot of root

# SOLUTION 15: Remove snapshot
sudo lvremove /dev/ubuntu/root_backup
```

---

## Scenario 7.2: Advanced Filesystem Optimization

**Context**: Database performance degrading. File fragmentation and filesystem issues suspected.

```bash
# CHALLENGE: Diagnose and optimize filesystem performance

# SOLUTION 1: Check filesystem type
df -T
# Shows: ext4, xfs, btrfs, etc.

# SOLUTION 2: Check filesystem health (ext4)
sudo e2fsck -n /dev/ubuntu/root
# -n = check only

# SOLUTION 3: Check filesystem usage statistics
sudo e2freefrag /dev/ubuntu/root
# Shows: free space fragmentation

# SOLUTION 4: Defragment ext4 (reduce fragmentation)
sudo e4defrag -v /dev/ubuntu/root
# For online defrag:
sudo e4defrag -v /

# SOLUTION 5: For XFS (doesn't need defrag normally)
sudo xfs_fsr /dev/mapper/ubuntu-root
# Reorganizes inodes/data

# SOLUTION 6: Check disk I/O performance
sudo apt install -y fio
fio --name=read_test --ioengine=libaio --iodepth=32 --rw=randread --bs=4k --runtime=60

# Results show:
# read: IOPS=50000, BW=195MiB/s, avgtime=640usec

# SOLUTION 7: Check disk sequential performance
fio --name=seq_read --ioengine=libaio --iodepth=32 --rw=read --bs=1M --runtime=60

# SOLUTION 8: Check mount options (can affect performance)
mount | grep /
# Shows: defaults,relatime

# Remount with better options
sudo mount -o remount,noatime,nodiratime /
# noatime = don't update access time (saves writes)

# Make permanent
sudo vim /etc/fstab
# Change: /dev/mapper/ubuntu-root / ext4 defaults to
#         /dev/mapper/ubuntu-root / ext4 defaults,noatime,nodiratime

# SOLUTION 9: Check inode count
df -i
# Shows: inode usage

# If inode exhausted, recreate filesystem (big change!)
sudo umount /
sudo mkfs.ext4 -N 2000000 /dev/ubuntu/root
# -N = max number of inodes

# SOLUTION 10: Monitor filesystem in real-time
dstat -D /dev/sda,/dev/sdb --fs

# SOLUTION 11: Check page cache efficiency
cat /proc/meminfo | grep -E "Buffers|Cached"

# SOLUTION 12: Check filesystem cache hit ratio
grep -E "findtime|reclaim" /proc/vmstat

# SOLUTION 13: Tune filesystem for database workload
# For MySQL/database servers:
sudo vim /etc/sysctl.conf

# Increase readahead (for sequential I/O)
vm.readahead_kb = 256

# Optimize file cache behavior
vm.dirty_ratio = 5
vm.dirty_background_ratio = 2

sudo sysctl -p

# SOLUTION 14: Check for "stale NFS file handle" errors
grep -i "stale" /var/log/syslog

# Fix: remount NFS
sudo umount -l /mnt/nfs
sudo mount /mnt/nfs

# SOLUTION 15: Use iostat to identify slow disk
iostat -x -t 1 10
# Shows: each disk performance
# Look for: high %util, high await (milliseconds)
```

---

# 📚 LEVEL 8: EXPERT - ARCHITECTURE & DESIGN

## Scenario 8.1: Design High-Availability System Architecture

**Context**: Design HA system that survives any single component failure.

```bash
# CHALLENGE: Design HA architecture for critical payment service

# REQUIREMENT:
# - RTO: 15 minutes (recovery time objective)
# - RPO: 5 minutes (recovery point objective)  
# - 99.99% uptime SLA
# - Multi-DC redundancy

# SOLUTION 1: HA Components

Architecture:
┌─────────────────────────────────────────────────────────────┐
│                    Global Load Balancer                     │
│              (Route 53 / GeoDNS / Anycast)                  │
└────────────┬─────────────────────────────────────┬──────────┘
             │                                     │
        ┌────▼────┐                           ┌────▼────┐
        │ DC1     │                           │ DC2     │
        │(Active) │                           │(Warm)   │
        └────┬────┘                           └────┬────┘
             │                                     │
    ┌────────┴──────────────┐          ┌──────────┴────────┐
    │                       │          │                   │
┌───▼────┐            ┌────▼──┐   ┌───▼────┐        ┌────▼──┐
│  LB1   │            │  LB2  │   │  LB3   │        │  LB4  │
└───┬────┘            └────┬──┘   └───┬────┘        └────┬──┘
    │                      │          │                 │
  ┌─┴──────────┬──────┬────┴──┐   ┌───┴──────┬────┐   │
  │             │      │       │   │          │    │   │
┌─▼─┐ ┌──┐ ┌──▼┐ ┌──┐ ┌────┐ │  ┌──▼┐ ┌──┐ ┌──▼┐ │
│App│ │App│ │App│ │App│ │Memcached├─┘  │App│ │App│ │App│ │
└───┘ └──┘ └───┘ └──┘ │   │        │    └───┘ └───┘ └───┘
                      │   │        │
                  ┌───▼───▼───┐ ┌──▼──────────┐
                  │ DB Master │ │ DB Replica  │
                  │(Primary)  │ │   (Sync)    │
                  └───────────┘ └─────────────┘
                        │              │
                        └──────┬───────┘
                               │
                        ┌──────▼──────┐
                        │ Backup/Sync │
                        └─────────────┘

# SOLUTION 2: Database replication setup (MySQL)

# On primary DC1:
sudo vim /etc/mysql/mysql.conf.d/mysqld.cnf

[mysqld]
server-id = 1
log_bin = /var/log/mysql/mysql-bin.log
binlog_format = ROW  # Row-based replication

# On replica DC2:
[mysqld]
server-id = 2
relay-log = /var/log/mysql/mysql-relay-bin
relay-log-index = /var/log/mysql/mysql-relay-bin.index

# Setup replication user
# On primary:
GRANT REPLICATION SLAVE ON *.* TO 'replication'@'%' IDENTIFIED BY 'ReplicationPass123';

# On replica:
CHANGE MASTER TO
  MASTER_HOST='primary.db.internal',
  MASTER_USER='replication',
  MASTER_PASSWORD='ReplicationPass123',
  MASTER_LOG_FILE='mysql-bin.000001',
  MASTER_LOG_POS=154;

START SLAVE;
SHOW SLAVE STATUS;

# SOLUTION 3: Health check monitoring

# Create health check script
cat > /opt/health-check.sh << 'EOF'
#!/bin/bash
# Check if application is healthy

# 1. Check if service is running
systemctl is-active payment-app || exit 1

# 2. Check HTTP endpoint
curl -s -f http://localhost:8080/health || exit 2

# 3. Check database connectivity
mysql -u app -p$APP_PASSWORD -h localhost -e "SELECT 1" || exit 3

# 4. Check cache connectivity
redis-cli ping || exit 4

echo "OK"
EOF

chmod +x /opt/health-check.sh

# SOLUTION 4: Load balancer health check (HAProxy)

cat > /etc/haproxy/haproxy.cfg << 'EOF'
global
    log         127.0.0.1 local0
    chroot      /var/lib/haproxy
    stats socket /run/haproxy/admin.sock mode 660 level admin

defaults
    log     global
    mode    http
    option  httplog
    timeout connect 5000
    timeout client  50000
    timeout server  50000

frontend payment-api
    bind *:80
    default_backend payment-servers

backend payment-servers
    balance roundrobin
    
    # Health check every 5 seconds
    option httpchk GET /health HTTP/1.1\r\nHost:\ localhost
    
    server app1 10.0.1.10:8080 check inter 5s rise 2 fall 3
    server app2 10.0.1.11:8080 check inter 5s rise 2 fall 3
    server app3 10.0.1.12:8080 check inter 5s rise 2 fall 3
    
    # Remove from pool if unhealthy
    # If 3 checks fail (15 seconds), remove from rotation
    # If 2 checks pass, return to rotation
EOF

# SOLUTION 5: Failover automation

cat > /opt/failover-check.sh << 'EOF'
#!/bin/bash
# Monitor primary DC, failover if down

PRIMARY_DC="dc1.internal"
SECONDARY_DC="dc2.internal"
FAILOVER_FLAG="/var/run/failover.flag"

# Check primary DC health
if ! ping -c 3 $PRIMARY_DC > /dev/null; then
    # Primary is down!
    
    # Check if secondary is healthy
    if ping -c 3 $SECONDARY_DC > /dev/null; then
        # Trigger failover
        echo "Primary DC down, initiating failover..."
        
        # Update DNS to point to secondary
        curl -X POST http://dns.internal/api/failover \
             -d "domain=payment-api.company.com&target=$SECONDARY_DC"
        
        # Create flag file
        date > $FAILOVER_FLAG
        
        # Notify operations
        mail -s "FAILOVER TRIGGERED" ops@company.com << MSG
Primary DC failed, secondary DC is now serving traffic.
Primary: $PRIMARY_DC
Secondary: $SECONDARY_DC
Time: $(date)
MSG
    fi
fi
EOF

chmod +x /opt/failover-check.sh

# Schedule check every minute
echo "* * * * * /opt/failover-check.sh" | crontab -

# SOLUTION 6: Backup & restore procedures

# Daily backup
cat > /opt/daily-backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/daily"
DATE=$(date +%Y%m%d)

# Dump database
mysqldump -u backup -p$BACKUP_PASS --all-databases \
    | gzip > $BACKUP_DIR/mysql-$DATE.sql.gz

# Backup application data
tar -czf $BACKUP_DIR/app-data-$DATE.tar.gz /opt/payment-app/data

# Upload to remote backup server
rsync -avz $BACKUP_DIR/ backup-server.internal:/backups/

# Keep only 30 days
find $BACKUP_DIR -mtime +30 -delete
EOF

# SOLUTION 7: Disaster recovery drill

cat > /opt/dr-test.sh << 'EOF'
#!/bin/bash
# Monthly DR test - restore to alternate DC

echo "Starting DR test..."

# 1. Restore latest backup to test server
LATEST_BACKUP=$(ls -t /backups/daily/*.sql.gz | head -1)
gzip -dc $LATEST_BACKUP | mysql -u root -p$MYSQL_PASS

# 2. Verify data integrity
PROD_COUNT=$(mysql -u app -p$APP_PASS -h prod-db.internal \
             -e "SELECT COUNT(*) FROM transactions" | tail -1)

TEST_COUNT=$(mysql -u app -p$APP_PASS -h test-db.internal \
             -e "SELECT COUNT(*) FROM transactions" | tail -1)

if [ "$PROD_COUNT" = "$TEST_COUNT" ]; then
    echo "✓ Data integrity verified"
else
    echo "✗ Data mismatch! Prod: $PROD_COUNT, Test: $TEST_COUNT"
    exit 1
fi

# 3. Run application tests
curl -s http://test-app.internal/test-suite | grep "passed"

echo "DR test completed successfully"
EOF

# SOLUTION 8: Monitoring & alerting

cat > /opt/monitoring-setup.sh << 'EOF'
# Set up Prometheus for monitoring

# /etc/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager.internal:9093

rule_files:
  - '/etc/prometheus/rules/*.yml'

scrape_configs:
  - job_name: 'payment-app'
    static_configs:
      - targets: ['app1:9090', 'app2:9090', 'app3:9090']

  - job_name: 'database'
    static_configs:
      - targets: ['db-primary:9100', 'db-replica:9100']

# Alert rules - /etc/prometheus/rules/payment-app.yml

groups:
  - name: payment-app
    interval: 30s
    rules:
      - alert: InstanceDown
        expr: up == 0
        for: 1m
        annotations:
          summary: "Instance {{ $labels.instance }} is down"

      - alert: HighErrorRate
        expr: rate(requests_total{status="500"}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate on {{ $labels.instance }}"

      - alert: DatabaseReplicationLag
        expr: mysql_slave_lag_seconds > 30
        for: 2m
        annotations:
          summary: "Database replication lagging on {{ $labels.instance }}"
EOF

# SOLUTION 9: Testing failover

cat > /opt/test-failover.sh << 'EOF'
#!/bin/bash
echo "Testing failover mechanism..."

# 1. Simulate primary DC failure
sudo iptables -A OUTPUT -d 10.0.1.0/24 -j DROP  # Block DC1

# 2. Wait for failover
sleep 20

# 3. Check if secondary is serving traffic
curl http://payment-api.company.com/health || echo "FAILOVER FAILED"

# 4. Restore network
sudo iptables -D OUTPUT -d 10.0.1.0/24 -j DROP

echo "Failover test completed"
EOF

# SOLUTION 10: RTO/RPO calculation

echo "=== HA Metrics ==="
echo "RTO (Recovery Time Objective):"
echo "  - Failover detection: 60 seconds"
echo "  - DNS propagation: 30 seconds"
echo "  - Application startup: 30 seconds"
echo "  - Total RTO: ~2 minutes (well under 15 min SLA)"

echo ""
echo "RPO (Recovery Point Objective):"
echo "  - Database replication sync: <1 second"
echo "  - Backup interval: 1 hour"
echo "  - Maximum data loss: 1 hour (meets 5 min RPO)"
echo "  - Solution: Enable synchronous replication"
```

---

## Scenario 8.2: Monitoring & Observability Architecture

**Context**: System is complex. Need visibility into: logs, metrics, traces. Implement comprehensive observability.

```bash
# CHALLENGE: Implement full observability stack (logs + metrics + traces)

# SOLUTION 1: Three pillars of observability

┌──────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY                             │
├──────────────────────────────────────────────────────────────┤
│ LOGS          │ METRICS           │ TRACES                   │
│               │                   │                          │
│ • Text event  │ • Numeric data    │ • Request flow           │
│ • Unstructured│ • Time-series     │ • Distributed            │
│ • Search      │ • Aggregate       │ • Timeline               │
│               │                   │                          │
│ ELK/Splunk   │ Prometheus/       │ Jaeger/Zipkin/          │
│              │ Grafana           │ DataDog                  │
└──────────────────────────────────────────────────────────────┘

# SOLUTION 2: Logs - ELK Stack Setup

# Elasticsearch (data store)
docker run -d --name elasticsearch \
  -e "discovery.type=single-node" \
  -p 9200:9200 \
  docker.elastic.co/elasticsearch/elasticsearch:8.0.0

# Logstash (log processor)
cat > /etc/logstash/conf.d/payment-app.conf << 'EOF'
input {
  file {
    path => "/var/log/payment-app/*.log"
    start_position => "beginning"
    codec => json
  }
}

filter {
  if [type] == "payment-app" {
    grok {
      match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{DATA:logger} - %{GREEDYDATA:msg}" }
    }
    
    if [level] == "ERROR" {
      mutate {
        add_tag => [ "error", "alert" ]
      }
    }
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "payment-app-%{+YYYY.MM.dd}"
  }
  
  if "alert" in [tags] {
    email {
      to => "alerts@company.com"
      subject => "Payment App Error: %{level}"
      body => "%{msg}"
    }
  }
}
EOF

# Kibana (visualization)
docker run -d --name kibana \
  -p 5601:5601 \
  -e "ELASTICSEARCH_HOSTS=http://elasticsearch:9200" \
  docker.elastic.co/kibana/kibana:8.0.0

# Access: http://localhost:5601

# SOLUTION 3: Metrics - Prometheus Setup

cat > /etc/prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'payment-app'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'system'
    static_configs:
      - targets: ['localhost:9100']

  - job_name: 'mysql'
    static_configs:
      - targets: ['localhost:9104']
EOF

# Start Prometheus
docker run -d --name prometheus \
  -p 9090:9090 \
  -v /etc/prometheus:/etc/prometheus \
  prom/prometheus

# SOLUTION 4: Metrics - Grafana Dashboards

docker run -d --name grafana \
  -p 3000:3000 \
  grafana/grafana

# Access: http://localhost:3000 (admin/admin)
# Add Prometheus data source: http://prometheus:9090

# SOLUTION 5: Traces - Jaeger Setup

docker run -d --name jaeger \
  -p 5775:5775/udp \
  -p 6831:6831/udp \
  -p 6832:6832/udp \
  -p 5778:5778 \
  -p 16686:16686 \
  jaegertracing/all-in-one

# Access: http://localhost:16686

# SOLUTION 6: Application instrumentation

# In payment-app (example: Python Flask):
cat > /opt/payment-app/app.py << 'EOF'
from flask import Flask
from prometheus_client import Counter, Histogram, start_http_server
from jaeger_client import Config
import logging

# Prometheus metrics
REQUEST_COUNT = Counter('requests_total', 'Total requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('request_duration_seconds', 'Request duration')

# Jaeger tracing
def init_tracer(service_name):
    config = Config(
        config={
            'sampler': {
                'type': 'const',
                'param': 1,
            },
            'logging': True,
        },
        service_name=service_name,
        validate=True,
    )
    return config.initialize_tracer()

app = Flask(__name__)
tracer = init_tracer('payment-app')

# Expose metrics
start_http_server(9090)

@app.route('/payment/create', methods=['POST'])
@REQUEST_DURATION.time()
def create_payment():
    with tracer.start_active_span('create_payment') as scope:
        # Span will be traced
        # Metrics will be collected
        
        REQUEST_COUNT.labels(method='POST', endpoint='/payment/create', status='200').inc()
        return {'status': 'ok'}, 200

if __name__ == '__main__':
    app.run()
EOF

# SOLUTION 7: Alerting rules

cat > /etc/prometheus/rules/payment-app.yml << 'EOF'
groups:
  - name: payment
    rules:
      # Alert if error rate > 5%
      - alert: HighErrorRate
        expr: |
          sum(rate(requests_total{status=~"5.."}[5m]))
          /
          sum(rate(requests_total[5m]))
          > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      # Alert if response time > 500ms
      - alert: SlowResponse
        expr: histogram_quantile(0.95, request_duration_seconds) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow response detected"

      # Alert if database replication lag
      - alert: ReplicationLag
        expr: mysql_slave_lag_seconds > 30
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database replication lagging"
EOF

# SOLUTION 8: Centralized logging with log levels

cat > /opt/payment-app/logging.conf << 'EOF'
[loggers]
keys=root,payment_app,database,cache

[handlers]
keys=console,file,syslog

[formatters]
keys=standard,json

[logger_root]
level=INFO
handlers=console,file,syslog

[logger_payment_app]
level=DEBUG
handlers=file,syslog
qualname=payment_app
propagate=0

[logger_database]
level=INFO
handlers=file
qualname=database
propagate=0

[handler_console]
class=StreamHandler
level=DEBUG
formatter=standard
args=(sys.stdout,)

[handler_file]
class=handlers.RotatingFileHandler
level=DEBUG
formatter=json
args=('/var/log/payment-app/app.log', 'a', 104857600, 10)

[handler_syslog]
class=handlers.SysLogHandler
level=INFO
formatter=standard
args=('/dev/log', handlers.SysLogHandler.LOG_LOCAL0)

[formatter_json]
format={"time": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "msg": "%(message)s"}

[formatter_standard]
format=%(asctime)s - %(name)s - %(levelname)s - %(message)s
EOF

# SOLUTION 9: Distributed tracing visualization

# Trace flow example:
# GET /api/payment/create
#   ├─ validate_user (50ms)
#   │   └─ query_db (40ms)
#   ├─ create_transaction (200ms)
#   │   ├─ insert_db (150ms)
#   │   └─ publish_event (50ms)
#   ├─ send_notification (100ms)
#   │   └─ http_call (95ms)
#   └─ Total: 350ms

# SOLUTION 10: Observability best practices

echo "=== Observability Checklist ==="
echo "Logs:"
echo "  ✓ Structured logging (JSON)"
echo "  ✓ Centralized collection (ELK)"
echo "  ✓ Long-term archival"
echo "  ✓ Search & analysis"
echo ""
echo "Metrics:"
echo "  ✓ Application metrics"
echo "  ✓ System metrics (CPU, memory, disk)"
echo "  ✓ Network metrics"
echo "  ✓ Database metrics"
echo "  ✓ Custom business metrics"
echo ""
echo "Traces:"
echo "  ✓ Request flow tracking"
echo "  ✓ Performance profiling"
echo "  ✓ Dependency analysis"
echo "  ✓ Error context"
```

---

## 🎯 QUICK REFERENCE: MASTERING LINUX

### Essential Command Categories

```bash
# SYSTEM INFORMATION
uname -a           # Kernel version
cat /etc/os-release  # OS info
lsb_release -a     # Ubuntu/Debian info
hostnamectl        # Hostname info
uptime             # System uptime

# USER & GROUP MANAGEMENT
useradd -m -s /bin/bash username  # Add user
usermod -aG group username         # Add to group
userdel -r username                # Delete user
passwd username                    # Change password
sudo -l                            # View sudo rights
groups username                    # View groups

# FILE MANAGEMENT
ls -la             # List files with details
cd directory       # Change directory
pwd                # Print working directory
mkdir directory    # Create directory
rm file            # Remove file
cp source dest     # Copy
mv source dest     # Move/rename
chmod 755 file     # Change permissions
chown user:group file  # Change owner
find . -name "*.log"   # Find files

# PROCESS MANAGEMENT
ps aux             # List processes
top                # Real-time monitoring
kill PID           # Terminate process
systemctl status service  # Service status
systemctl start service   # Start service
jobs               # Background jobs
bg job             # Background job

# DISK & STORAGE
df -h              # Disk usage
du -sh directory   # Directory size
mount              # Show mounts
fdisk -l           # Disk partitions
blkid              # Block device IDs
lvm lvs            # LVM volumes

# NETWORKING
ip addr            # IP addresses
ip route           # Routing table
netstat -tlnp      # Network sockets
ss -tulnp          # Modern socket stats
ping host          # Test connectivity
traceroute host    # Trace route
nslookup host      # DNS lookup
curl url           # Download/test HTTP
wget url           # Download file

# PACKAGE MANAGEMENT
apt update         # Update package list
apt install pkg    # Install package
apt upgrade        # Upgrade packages
apt search pkg     # Search packages
dpkg -l            # List installed
apt remove pkg     # Remove package

# SYSTEM MONITORING
iostat -x 1 5      # Disk I/O
vmstat 1 5         # Virtual memory
mpstat -P ALL 1    # CPU per core
free -h            # Memory usage
cat /proc/meminfo  # Detailed memory
lsof -p PID        # Open files
strace -p PID      # System calls

# LOG MANAGEMENT
tail -f /var/log/syslog    # Follow log
grep pattern logfile        # Search logs
journalctl -u service -f   # System journal
dmesg | tail                # Kernel messages
zcat logfile.gz             # Read gzipped logs

# SECURITY
sudo su -          # Switch to root
ssh user@host      # Remote login
ssh-keygen         # Generate SSH keys
ssh-copy-id host   # Copy SSH key
sudo visudo        # Edit sudoers
iptables -L        # Firewall rules
ufw status         # UFW status

# FILE COMPRESSION
tar -czf file.tar.gz files  # Create tar.gz
tar -xzf file.tar.gz        # Extract tar.gz
gzip file          # Compress
gunzip file.gz     # Decompress
zip -r file.zip directory   # ZIP archive

# TEXT PROCESSING
cat file           # Display file
less file          # Paged display
head -20 file      # First 20 lines
tail -20 file      # Last 20 lines
grep pattern file  # Search pattern
sed 's/old/new/g' file  # Replace text
awk '{print $1}' file   # Column extraction
cut -d: -f1 file   # Field extraction

# PERMISSIONS
chmod 755 file     # Set permissions
chmod u+x file     # Add execute
chmod go-r file    # Remove read
chown user file    # Change owner
umask 0077         # Set default perms

# SCHEDULING
crontab -e         # Edit cron jobs
crontab -l         # List cron jobs
at 3pm tomorrow    # Schedule one-time
atq                # List at jobs

# TROUBLESHOOTING
dmesg | tail       # Kernel errors
journalctl -f      # System logs
systemctl status   # Service issues
lsof -i :port      # What's on port?
netstat -an | grep port  # Port check
ps aux | grep proc # Find process
```

---

**End of Linux Scenarios: Scratch to Advanced**

This comprehensive document provides 40+ practical scenarios covering Linux fundamentals through expert-level system design, with real commands and solutions for every situation a DevOps engineer will encounter.

Total Scenario Levels:
- **Level 1**: Scratch (4 scenarios) - Fundamentals
- **Level 2**: Beginner (3 scenarios) - Basic admin
- **Level 3**: Intermediate (3 scenarios) - System admin  
- **Level 4**: Intermediate-Advanced (2 scenarios) - Complex troubleshooting
- **Level 5**: Advanced (2 scenarios) - Kernel & system tuning
- **Level 6**: Advanced (2 scenarios) - Security & hardening
- **Level 7**: Expert (2 scenarios) - Storage & filesystems
- **Level 8**: Expert (2 scenarios) - Architecture & design
- **Quick Reference**: Essential commands

**Total: 20+ Deep-Dive Scenarios + Quick Command Reference**
