# 🌱 LEVEL 1: BEGINNER - Foundation Skills (0-6 months)

**Target**: Fresh Linux users, developers new to DevOps, 0-1 year experience  
**Duration**: 4-6 weeks of study  
**Goal**: Master Linux basics, understand system administration fundamentals

---

## 📚 Learning Path for Level 1

### Week 1-2: Linux Fundamentals
**Topics**: SSH, file system, basic commands
- ✅ SSH access and navigation
- ✅ File permissions (chmod, chown)
- ✅ User and group management
- ✅ Basic package management (apt/yum)

**Location**: See `LINUX-SCENARIOS-SCRATCH-TO-ADVANCED.md` - **Section: LEVEL 1: SCRATCH**
- Scenario 1.1: Your First Linux Server - SSH Access & Navigation
- Scenario 1.2: File Permissions & Ownership Basics
- Scenario 1.3: Basic User & Group Management
- Scenario 1.4: Installing Software & Package Management

**Hands-on Tasks**:
```bash
# Task 1: SSH into a server
ssh user@server.com

# Task 2: List files with permissions
ls -la

# Task 3: Change file permissions
chmod 755 script.sh

# Task 4: Install a package
sudo apt install -y htop
```

---

### Week 3-4: System Administration Basics
**Topics**: Processes, disk management, networking, logs
- ✅ Process monitoring (ps, top, htop)
- ✅ Disk space management
- ✅ Network basics (ping, DNS, ports)
- ✅ Basic log analysis

**Location**: See `LINUX-SCENARIOS-SCRATCH-TO-ADVANCED.md` - **Section: LEVEL 2: BEGINNER**
- Scenario 2.1: Process Management & Monitoring
- Scenario 2.2: Disk Space Troubleshooting
- Scenario 2.3: Network Connectivity & Port Troubleshooting

**Hands-on Tasks**:
```bash
# Task 1: Monitor processes
top
ps aux --sort=-%mem | head -10

# Task 2: Check disk usage
df -h
du -sh /var/log

# Task 3: Test network
ping 8.8.8.8
netstat -tlnp | grep 8080

# Task 4: Check logs
tail -50 /var/log/syslog
```

---

### Week 5-6: Intro to Automation & Services
**Topics**: Systemd, cron, basic automation
- ✅ Systemd service management
- ✅ Cron jobs
- ✅ Log rotation
- ✅ Basic troubleshooting

**Location**: See `LINUX-SCENARIOS-SCRATCH-TO-ADVANCED.md` - **Section: LEVEL 3: INTERMEDIATE**
- Scenario 3.1: Systemd Service Management & Troubleshooting
- Scenario 3.2: Cron Jobs & Scheduled Tasks
- Scenario 3.3: Log Management & Analysis

**Hands-on Tasks**:
```bash
# Task 1: Create a systemd service
sudo vim /etc/systemd/system/myapp.service
sudo systemctl enable myapp.service
sudo systemctl start myapp.service

# Task 2: Create a cron job
crontab -e
# Add: 0 2 * * * /opt/backup.sh

# Task 3: Configure log rotation
sudo vim /etc/logrotate.d/myapp
```

---

## 📖 Reference Documents

**Primary Learning Material**:
- `../LINUX-SCENARIOS-SCRATCH-TO-ADVANCED.md` - Levels 1-2 sections (all scenarios with hands-on practice)

**Quick Reference**:
- Command cheat sheet (end of above document)
- Common file permissions: 755, 644, 600, 700
- SSH keys and password management

---

## ✅ Level 1 Completion Checklist

- [ ] Can SSH into a Linux server
- [ ] Understand file permissions and can change them
- [ ] Can create users and manage groups
- [ ] Can install packages with apt/yum
- [ ] Can monitor processes (ps, top)
- [ ] Can troubleshoot disk space issues
- [ ] Can check network connectivity
- [ ] Can create and manage systemd services
- [ ] Can create and manage cron jobs
- [ ] Can read and analyze log files
- [ ] Can restart services and check status
- [ ] Understand basic directory structure (/etc, /var, /home, etc)

---

## 🎯 Next Steps

Once you complete all Level 1 scenarios and checklist:
- Move to **Level 2: Intermediate**
- Topics: Advanced troubleshooting, kernel tuning, security basics
- Time estimate: 6-8 weeks

---

## 💡 Tips for Success

1. **Practice on a real/virtual Linux server** - Not just reading
2. **Type commands, don't copy-paste** - Build muscle memory
3. **Break things** - Safe way to learn (use VMs)
4. **Keep a learning journal** - Document what you learn
5. **Do all hands-on tasks** - Reading alone won't make you proficient

---

## 📞 Common Issues & Solutions

**Q: "Permission denied" when running commands?**
A: Need `sudo` prefix or belong to correct group. Check with `id` command.

**Q: How do I become root?**
A: `sudo su -` but be careful! Better to use `sudo` with specific commands.

**Q: My disk is full, what do I do?**
A: Follow Scenario 2.2: Find large files with `du -sh /*` then `rm` old logs.

**Q: Service won't start, how to debug?**
A: Check logs: `journalctl -u service-name -f` then `systemctl status service-name`

---

## 📊 Estimated Time Investment

- Reading: 20 hours
- Hands-on practice: 30 hours
- Troubleshooting practice: 10 hours
- **Total: ~60 hours to master Level 1**

---

**Ready to advance? Proceed to Level 2: Intermediate** 🚀
