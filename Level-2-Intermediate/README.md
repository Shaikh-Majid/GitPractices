# 📊 LEVEL 2: INTERMEDIATE - System Administration (6-18 months)

**Target**: Linux admins, DevOps engineers, 1-2 years experience  
**Duration**: 6-8 weeks of study  
**Goal**: Advanced troubleshooting, performance tuning, security basics

---

## 📚 Learning Path for Level 2

### Week 1-2: Advanced Troubleshooting
**Topics**: Performance analysis, network debugging, complex issues
- ✅ System performance deep dive (CPU, memory, I/O)
- ✅ Packet analysis and network debugging
- ✅ Complex log analysis and pattern matching
- ✅ Correlation of multiple symptoms

**Location**: See `LINUX-SCENARIOS-SCRATCH-TO-ADVANCED.md` - **Section: LEVEL 4: INTERMEDIATE-ADVANCED**
- Scenario 4.1: System Performance Deep Dive
- Scenario 4.2: Network Debugging - Packet Analysis

**Reference Documents**:
- `../LINUX-PRODUCTION-4YOE.md` - Scenario 1-2 (Memory & Disk I/O crises)

**Hands-on Tasks**:
```bash
# Task 1: Full performance analysis
uptime
free -h
vmstat 1 10
iostat -x 1 5
top -b -n 1 | head -20

# Task 2: Find slow processes
ps aux --sort=-%cpu | head -10
ps aux --sort=-%mem | head -10

# Task 3: Analyze disk I/O
iotop -o -b -n 1
fio --name=benchmark --ioengine=libaio --rw=randread --bs=4k --runtime=60

# Task 4: Capture and analyze packets
sudo tcpdump -i eth0 -w traffic.pcap 'tcp port 3306'
```

---

### Week 3-4: Security & Hardening
**Topics**: SSH hardening, firewall, access control
- ✅ SSH security and key management
- ✅ PAM authentication
- ✅ Sudo policies and privilege escalation
- ✅ Firewall rules (iptables/ufw)

**Location**: See `LINUX-SCENARIOS-SCRATCH-TO-ADVANCED.md` - **Section: LEVEL 6: ADVANCED (Security)**
- Scenario 6.1: Linux Security Module - AppArmor & SELinux
- Scenario 6.2: Firewall Mastery - iptables & ufw

**Reference Documents**:
- `../LINUX-PRODUCTION-4YOE.md` - Scenario 2 (SSH security incident)

**Hands-on Tasks**:
```bash
# Task 1: SSH hardening
sudo vim /etc/ssh/sshd_config
# Set: PermitRootLogin no, PasswordAuthentication no
sudo systemctl restart ssh

# Task 2: Firewall setup
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Task 3: Create firewall rules
sudo iptables -A INPUT -p tcp --dport 22 -m state --state NEW -j ACCEPT
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
```

---

### Week 5-6: Storage & Filesystem Management
**Topics**: LVM, RAID, disk management
- ✅ LVM volume management
- ✅ RAID configuration and recovery
- ✅ Filesystem types and optimization
- ✅ Disk replacement procedures

**Location**: See `LINUX-SCENARIOS-SCRATCH-TO-ADVANCED.md` - **Section: LEVEL 7: EXPERT (Storage)**
- Scenario 7.1: LVM, RAID & Advanced Storage
- Scenario 7.2: Advanced Filesystem Optimization

**Hands-on Tasks**:
```bash
# Task 1: LVM operations
sudo pvs
sudo vgs
sudo lvs
sudo lvextend -L +10G /dev/vg0/root
sudo resize2fs /dev/vg0/root

# Task 2: Check RAID status
cat /proc/mdstat
sudo mdadm --detail /dev/md0

# Task 3: Filesystem check
sudo e2fsck -n /dev/mapper/vg0-root
sudo xfs_fsr /dev/mapper/vg0-root
```

---

### Week 7-8: Kernel Tuning & Performance Optimization
**Topics**: Kernel parameters, system limits, resource management
- ✅ Sysctl tuning for TCP/networking
- ✅ Process limits and ulimits
- ✅ Memory management and cgroups
- ✅ I/O scheduler optimization

**Location**: See `LINUX-SCENARIOS-SCRATCH-TO-ADVANCED.md` - **Section: LEVEL 5: ADVANCED (Kernel)**
- Scenario 5.1: Kernel Parameter Tuning for High-Performance Systems
- Scenario 5.2: Memory Management - Cgroups & Resource Limits

**Reference Documents**:
- `../LINUX-PRODUCTION-4YOE.md` - Scenario 1 (Memory crisis)

**Hands-on Tasks**:
```bash
# Task 1: Tune kernel for high connection count
sudo sysctl -w net.core.somaxconn=4096
sudo sysctl -w net.ipv4.tcp_max_syn_backlog=8192

# Task 2: Set resource limits
ulimit -n
ulimit -n 65536

# Task 3: Create cgroup for resource limits
sudo mkdir -p /sys/fs/cgroup/payment-app
echo "8589934592" | sudo tee /sys/fs/cgroup/payment-app/memory.max
```

---

## 📖 Reference Documents

**Primary Learning Materials**:
- `../LINUX-SCENARIOS-SCRATCH-TO-ADVANCED.md` - Levels 4-5 sections
- `../LINUX-PRODUCTION-4YOE.md` - Scenarios 1-3 (production issues)

**Supporting Materials**:
- Kernel tuning guide (end of LINUX-PRODUCTION-4YOE.md)
- Security hardening checklist
- Performance profiling tools guide

---

## ✅ Level 2 Completion Checklist

- [ ] Can diagnose performance issues (CPU, memory, I/O)
- [ ] Can capture and analyze network packets
- [ ] Can debug complex system problems
- [ ] Can configure SSH with strong security
- [ ] Can set up and manage firewall rules
- [ ] Can implement PAM authentication
- [ ] Can configure sudo policies
- [ ] Can manage LVM volumes
- [ ] Can recover from disk failures
- [ ] Can monitor RAID arrays
- [ ] Can tune kernel parameters
- [ ] Can set process resource limits with cgroups
- [ ] Can optimize filesystem performance
- [ ] Can implement apparmor/SELinux

---

## 🎯 Next Steps

Once you complete Level 2:
- Move to **Level 3: Advanced**
- Topics: Architect HA systems, design disaster recovery, complex automation
- Time estimate: 8-10 weeks

---

## 💡 Tips for Success

1. **Set up a home lab** - Multiple Linux VMs for practice
2. **Break and fix things** - The best learning method
3. **Read kernel documentation** - Understand the "why"
4. **Keep tuning notebooks** - Document your parameters
5. **Study existing configs** - Analyze production setups

---

## 📞 Common Issues & Solutions

**Q: "Too many open files" error?**
A: Increase ulimit: `ulimit -n 65536` or set in `/etc/security/limits.conf`

**Q: System is slow but doesn't look it in top?**
A: Check I/O wait: `vmstat 1 5` look at 'wa' column. Use iotop to find culprit.

**Q: Firewall rules not working?**
A: Check order with `sudo iptables -L -n -v`. Rules are evaluated top-to-bottom.

**Q: LVM extend failing?**
A: Check free space: `sudo vgdisplay | grep "Free PE"`. Add new disk if needed.

---

## 📊 Estimated Time Investment

- Reading: 30 hours
- Hands-on labs: 50 hours
- Troubleshooting practice: 20 hours
- **Total: ~100 hours to master Level 2**

---

## 🏆 You Should Be Able To

- **Independently manage production Linux systems**
- **Diagnose and fix complex system problems**
- **Optimize system performance**
- **Implement enterprise-grade security**
- **Manage storage and filesystems**
- **Handle disaster recovery scenarios**
- **Mentor other junior admins**

---

**Ready for advanced? Proceed to Level 3: Advanced** 🚀
