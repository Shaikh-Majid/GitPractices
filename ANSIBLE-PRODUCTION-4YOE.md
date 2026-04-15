# 🚀 Ansible Production Scenarios: 4 Years of Experience - Deep Dive

**Company**: TechFlow Inc. (500+ microservices, 5000+ Linux servers across 10 data centers)  
**Your Role**: Senior DevOps Automation Engineer specializing in Ansible at scale  
**Current State**: Ansible infrastructure needs optimization, security hardening, and scaling  
**Mission**: Design and implement enterprise-grade Ansible infrastructure for global deployment

---

## 📊 Current Ansible Infrastructure Assessment

```
Ansible Infrastructure Status:
├── 5000+ servers managed across 10 data centers
├── 200+ playbooks (many duplicated, poorly organized)
├── 50+ role directories (inconsistent naming, poor documentation)
├── No centralized inventory management
├── Manual inventory updates (CMDB not integrated)
├── No version control for sensitive variables
├── Deployment takes 2-3 hours (serial execution)
├── No built-in error handling or rollback
├── Security: Plaintext SSH keys, no audit trails
├── Performance: 30% of tasks fail, no retry logic
└── No monitoring/alerting on playbook execution
```

---

# 🎯 SCENARIO 1: DESIGNING ENTERPRISE ANSIBLE ARCHITECTURE

## Challenge 1.1: Inventory Management at Scale

**Problem**: Inventory is static YAML files manually maintained by 3 people. Causes:
- Duplicate entries
- Outdated servers (decommissioned 6 months ago still exist)
- No grouping by geography, tier, or application
- 2-hour syncs when infrastructure changes
- SSH connection failures on decommissioned hosts

**Your Task**: Design dynamic inventory with CMDB integration

---

### Solution 1.1.1: Dynamic Inventory with CMDB Integration

```bash
# STEP 1: Create custom inventory plugin for CMDB integration
cat > /usr/local/lib/python3.9/dist-packages/ansible/plugins/inventory/cmdb_inventory.py << 'EOF'
from ansible.plugins.inventory import BaseInventoryPlugin, Cacheable
from ansible.errors import AnsibleError
import requests
import json
from urllib.parse import urljoin

class InventoryModule(BaseInventoryPlugin, Cacheable):
    """
    Ansible inventory plugin for CMDB integration
    Fetches server inventory from central CMDB instead of static YAML
    """
    
    NAME = 'cmdb_inventory'
    CACHE_PREFIX = 'cmdb_inventory'
    
    def verify_file(self, path):
        """Validate inventory plugin is being used"""
        return path.endswith(('cmdb.yml', 'cmdb.yaml'))
    
    def parse(self, inventory, loader, path, cache=True):
        """
        Fetch server inventory from CMDB
        Groups servers by: datacenter, environment, application, tier
        """
        super(InventoryModule, self).parse(inventory, loader, path, cache)
        
        try:
            self.config = self._read_config_data(path)
        except Exception as e:
            raise AnsibleError(f'Error reading inventory config: {e}')
        
        # Fetch from CMDB
        cmdb_url = self.config.get('cmdb_url', 'http://cmdb.internal/api/v1')
        cmdb_token = self.config.get('cmdb_token')
        
        headers = {'Authorization': f'Bearer {cmdb_token}'}
        
        # Fetch all servers
        servers_response = requests.get(
            urljoin(cmdb_url, '/servers'),
            headers=headers,
            timeout=30
        )
        servers_response.raise_for_status()
        servers = servers_response.json()
        
        # Add servers and create groups
        for server in servers:
            hostname = server['hostname']
            
            # Add host
            self.inventory.add_host(hostname)
            
            # Set host variables
            self.inventory.set_variable(hostname, 'ansible_host', server['ip_address'])
            self.inventory.set_variable(hostname, 'ansible_user', server['ssh_user'])
            self.inventory.set_variable(hostname, 'ansible_port', server.get('ssh_port', 22))
            self.inventory.set_variable(hostname, 'datacenter', server['datacenter'])
            self.inventory.set_variable(hostname, 'environment', server['environment'])
            self.inventory.set_variable(hostname, 'application', server['application'])
            self.inventory.set_variable(hostname, 'tier', server['tier'])
            self.inventory.set_variable(hostname, 'os_type', server['os_type'])
            self.inventory.set_variable(hostname, 'kernel_version', server.get('kernel_version'))
            
            # Add to groups
            self.inventory.add_group(f"dc_{server['datacenter']}")
            self.inventory.add_group(f"env_{server['environment']}")
            self.inventory.add_group(f"app_{server['application']}")
            self.inventory.add_group(f"tier_{server['tier']}")
            
            self.inventory.add_host(hostname, group=f"dc_{server['datacenter']}")
            self.inventory.add_host(hostname, group=f"env_{server['environment']}")
            self.inventory.add_host(hostname, group=f"app_{server['application']}")
            self.inventory.add_host(hostname, group=f"tier_{server['tier']}")
            
            # Multi-tier grouping
            if server['environment'] == 'prod' and server['tier'] == 'api':
                self.inventory.add_host(hostname, group='prod_api_tier')
            elif server['environment'] == 'prod' and server['tier'] == 'database':
                self.inventory.add_host(hostname, group='prod_db_tier')
        
        # Create composite groups for common patterns
        self.inventory.add_group('prod_critical')
        for host in self.inventory.get_hosts(pattern='env_prod'):
            if self.inventory.get_variable(host.name, 'tier') in ['api', 'database', 'cache']:
                self.inventory.add_host(host.name, group='prod_critical')

EOF

# STEP 2: Create CMDB inventory config
cat > /etc/ansible/inventory/cmdb.yml << 'EOF'
plugin: cmdb_inventory
cmdb_url: http://cmdb.internal/api/v1
cmdb_token: "{{ lookup('env', 'CMDB_API_TOKEN') }}"
cache: yes
cache_plugin: jsonfile
cache_connection: /tmp/ansible_cmdb_cache
cache_timeout: 3600
EOF

# STEP 3: Test inventory plugin
export CMDB_API_TOKEN="your-api-token-here"
ansible-inventory -i /etc/ansible/inventory/cmdb.yml --list | jq . | head -50

# Shows dynamically fetched groups:
# {
#   "dc_us_east_1": { "hosts": ["payment-prod-01", "payment-prod-02", ...] },
#   "dc_us_west_2": { "hosts": ["payment-prod-09", ...] },
#   "env_prod": { "hosts": [...all prod servers...] },
#   "app_payment": { "hosts": [...payment service servers...] },
#   "tier_api": { "hosts": [...api tier servers...] },
#   "prod_critical": { "hosts": [...critical prod servers...] }
# }

# STEP 4: Verify groups are created
ansible-inventory -i /etc/ansible/inventory/cmdb.yml --graph | head -100

# Output:
# @all:
#   |--@dc_us_east_1:
#   |  |--payment-prod-01
#   |  |--payment-prod-02
#   |--@env_prod:
#   |  |--payment-prod-01
#   |--@tier_api:
#   |  |--payment-prod-01

# STEP 5: Verify connectivity and facts
ansible -i /etc/ansible/inventory/cmdb.yml dc_us_east_1 -m ping

# STEP 6: Test host variables are set
ansible -i /etc/ansible/inventory/cmdb.yml payment-prod-01 -m debug -a "msg={{ datacenter }}"
# Output: "dc_us_east_1"
```

---

### Solution 1.1.2: Multi-Source Inventory (YAML + Dynamic + Cloud)

```yaml
# /etc/ansible/ansible.cfg
[defaults]
inventory = /etc/ansible/inventory/combined/
# Ansible will load ALL files from this directory
# Order of loading: *.yml, *.yaml, then plugin-based

# /etc/ansible/inventory/combined/00-static-dmz.yml
# Static hosts that rarely change
dmz:
  hosts:
    bastion-01:
      ansible_host: 10.0.1.50
      ansible_user: ubuntu
    vpn-gateway-01:
      ansible_host: 10.0.1.51
      ansible_user: ubuntu

# /etc/ansible/inventory/combined/10-cmdb-servers.yml
# Dynamic CMDB-sourced inventory
plugin: cmdb_inventory
cmdb_url: http://cmdb.internal/api/v1
cmdb_token: "{{ lookup('env', 'CMDB_API_TOKEN') }}"

# /etc/ansible/inventory/combined/20-aws-ec2.yml
# Dynamic AWS EC2 inventory plugin (built-in)
plugin: amazon.aws.aws_ec2
regions:
  - us-east-1
  - us-west-2
keyed_groups:
  - key: placement.region
    prefix: aws_region
  - key: tags.Environment
    prefix: env
  - key: tags.Application
    prefix: app
  - key: instance_type
    prefix: type

# /etc/ansible/inventory/combined/30-gcp-compute.yml
# Dynamic GCP inventory
plugin: google.cloud.gcp_compute
projects:
  - techflow-prod
  - techflow-staging
keyed_groups:
  - key: zone
    prefix: gcp_zone

# STEP 7: List all inventory sources
ansible-inventory -i /etc/ansible/inventory/combined/ --list | jq 'keys' | head -50

# STEP 8: Test combined inventory
ansible -i /etc/ansible/inventory/combined/ all --list-hosts | wc -l
# Output: 5000+ hosts from all sources

# STEP 9: Verify no duplicates
ansible-inventory -i /etc/ansible/inventory/combined/ --list | jq '.' > inventory-check.json
python3 << 'PYTHON'
import json
with open('inventory-check.json') as f:
    inv = json.load(f)

hosts = set()
duplicates = []
for group_name, group_data in inv.items():
    if isinstance(group_data, dict) and 'hosts' in group_data:
        for host in group_data['hosts']:
            if host in hosts:
                duplicates.append(host)
            hosts.add(host)

print(f"Total unique hosts: {len(hosts)}")
print(f"Duplicates: {duplicates if duplicates else 'None'}")
PYTHON
```

---

## Challenge 1.2: Ansible Control Node Architecture

**Problem**: Single control node is a SPOF (single point of failure). Also a bottleneck.

**Your Task**: Design HA control node cluster

---

### Solution 1.2.1: High-Availability Ansible Control Cluster

```bash
# STEP 1: Design control node cluster (3-node HA)
# Control nodes: ansible-controller-1, ansible-controller-2, ansible-controller-3
# Load balancer: ansible-lb.internal (round-robin)
# Shared storage: NFS for inventory, roles, playbooks

# STEP 2: Set up NFS shared storage
# On NFS server:
sudo apt-get install -y nfs-kernel-server

# /etc/exports
/srv/ansible/inventory  *(ro,sync,no_subtree_check,no_root_squash)
/srv/ansible/roles      *(ro,sync,no_subtree_check,no_root_squash)
/srv/ansible/playbooks  *(ro,sync,no_subtree_check,no_root_squash)
/srv/ansible/ssh-keys   *(ro,sync,no_subtree_check,no_root_squash)

sudo exportfs -a

# On each control node:
sudo apt-get install -y nfs-common

# Mount NFS
sudo mkdir -p /ansible/shared
sudo mount -t nfs nfs-server.internal:/srv/ansible /ansible/shared

# Make persistent
echo "nfs-server.internal:/srv/ansible /ansible/shared nfs ro,defaults 0 0" | \
  sudo tee -a /etc/fstab

# STEP 3: Configure Ansible on control nodes
# /etc/ansible/ansible.cfg (on all nodes)
[defaults]
inventory = /ansible/shared/inventory/
roles_path = /ansible/shared/roles/
library = /ansible/shared/library/
host_key_checking = False

# Optimize for scale
forks = 100                  # Parallel tasks (from default 5)
gathering = smart           # Cache facts for 24 hours
fact_caching = jsonfile
fact_caching_connection = /tmp/ansible_facts
fact_caching_timeout = 86400

# Timeouts
timeout = 30
command_timeout = 45
ssh_timeout = 10
connect_timeout = 10

# SSH configuration
[ssh_connection]
ssh_args = -C -o ControlMaster=auto -o ControlPersist=60s \
           -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no \
           -o IdentitiesOnly=yes -o IdentityFile=/ansible/shared/ssh-keys/id_rsa \
           -o ProxyCommand="ssh -W %h:%p bastion-01.internal"

# STEP 4: Set up load balancer (HAProxy)
cat > /etc/haproxy/haproxy.cfg << 'EOF'
global
    log 127.0.0.1 local0
    maxconn 4096

defaults
    log     global
    mode    tcp
    option  tcplog
    timeout connect 5000
    timeout client  50000
    timeout server  50000

frontend ansible_api
    bind *:5000
    default_backend ansible_controllers

backend ansible_controllers
    balance roundrobin
    server controller-1 ansible-controller-1.internal:5000 check
    server controller-2 ansible-controller-2.internal:5000 check
    server controller-3 ansible-controller-3.internal:5000 check
EOF

# STEP 5: Set up API server on each control node (optional)
# For remote API calls instead of direct SSH
cat > /opt/ansible-api/app.py << 'EOF'
from flask import Flask, request, jsonify
import subprocess
import json
import uuid

app = Flask(__name__)

@app.route('/api/v1/playbook/execute', methods=['POST'])
def execute_playbook():
    data = request.json
    playbook_path = data.get('playbook')
    inventory = data.get('inventory', '/ansible/shared/inventory/')
    extra_vars = data.get('extra_vars', {})
    
    # Generate execution ID
    exec_id = str(uuid.uuid4())
    
    # Build ansible-playbook command
    cmd = [
        'ansible-playbook',
        f'-i {inventory}',
        playbook_path
    ]
    
    # Add extra vars
    if extra_vars:
        cmd.append(f"-e '{json.dumps(extra_vars)}'")
    
    # Execute
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=3600)
        return jsonify({
            'exec_id': exec_id,
            'status': 'success' if result.returncode == 0 else 'failed',
            'return_code': result.returncode,
            'stdout': result.stdout.decode(),
            'stderr': result.stderr.decode()
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
EOF

# STEP 6: Test control node cluster
# Run same playbook from each controller
for controller in ansible-controller-1 ansible-controller-2 ansible-controller-3; do
  ssh $controller "ansible-playbook /ansible/shared/playbooks/deploy.yml \
    --syntax-check"
done

# STEP 7: Monitor control node health
cat > /usr/local/bin/ansible-controller-health.sh << 'EOF'
#!/bin/bash
for controller in ansible-controller-1 ansible-controller-2 ansible-controller-3; do
  echo "=== $controller ==="
  
  # SSH connectivity
  ssh -o ConnectTimeout=5 $controller "echo 'SSH OK'" || echo "SSH FAILED"
  
  # Disk space
  ssh $controller "df -h /ansible/shared | awk 'NR==2 {print \$5}'"
  
  # NFS mount status
  ssh $controller "mount | grep 'nfs' || echo 'NFS not mounted'"
  
  # Ansible version
  ssh $controller "ansible --version | head -1"
done
EOF

chmod +x /usr/local/bin/ansible-controller-health.sh
```

---

## Challenge 1.3: SSH Key Management at Scale

**Problem**: SSH keys are scattered, manually distributed, no rotation policy.

**Your Task**: Implement secure, scalable SSH key management

---

### Solution 1.3.1: Centralized SSH Key Management with Vault

```bash
# STEP 1: Generate master SSH key pair
ssh-keygen -t ed25519 -f /etc/ansible/ssh-keys/ansible-master -N ""

# STEP 2: Secure SSH keys with HashiCorp Vault
# Vault is running at vault.internal:8200

# Set Vault token
export VAULT_ADDR="http://vault.internal:8200"
export VAULT_TOKEN="$(cat /etc/vault/token)"

# Store SSH private key in Vault
vault kv put secret/ansible/ssh-keys/master \
  private_key=@/etc/ansible/ssh-keys/ansible-master \
  public_key=@/etc/ansible/ssh-keys/ansible-master.pub \
  created_date="$(date)" \
  rotation_date="$(date -d '+90 days')"

# Verify
vault kv get secret/ansible/ssh-keys/master

# STEP 3: Create Vault policy for SSH keys
cat > /etc/vault/policies/ansible-ssh.hcl << 'EOF'
path "secret/ansible/ssh-keys/*" {
  capabilities = ["read"]
}

path "secret/ansible/ssh-keys/*" {
  capabilities = ["create", "update"]
}
EOF

vault policy write ansible-ssh /etc/vault/policies/ansible-ssh.hcl

# STEP 4: Create dynamic SSH secrets
# Vault can generate temporary SSH certificates that auto-expire

# Enable SSH secret engine
vault secrets enable ssh

# Configure SSH backend
vault write ssh/config/ca \
  generate_signing_key=true

# Create SSH role
vault write ssh/roles/ansible \
  key_type=ca \
  ttl=30m \
  max_ttl=2h \
  allowed_users="*" \
  allow_user_certificates=true

# Generate temporary SSH certificate (valid for 30 minutes)
vault write -f ssh/sign/ansible \
  certificate_authorities=ansible \
  public_key=@/etc/ansible/ssh-keys/ansible-master.pub \
  valid_principals="root,ubuntu" \
  ttl=30m

# Vault returns: signed-key.pub (certificate)

# STEP 5: Deploy public key to managed hosts
cat > /opt/ansible-deploy-keys.yml << 'EOF'
---
- name: Deploy Ansible SSH Keys to All Hosts
  hosts: all
  gather_facts: no
  become: yes
  tasks:
    - name: Create ansible user
      user:
        name: ansible
        shell: /bin/bash
        home: /home/ansible
        createhome: yes
    
    - name: Create .ssh directory
      file:
        path: /home/ansible/.ssh
        owner: ansible
        group: ansible
        mode: 0700
        state: directory
    
    - name: Deploy public key
      authorized_key:
        user: ansible
        key: "{{ lookup('file', '/ansible/shared/ssh-keys/ansible-master.pub') }}"
        exclusive: yes
        state: present
    
    - name: Create CA trust for certificates
      copy:
        content: "{{ lookup('file', '/var/lib/vault/ssh_ca.pub') }}"
        dest: /etc/ssh/ansible_ca.pub
        owner: root
        group: root
        mode: 0644
    
    - name: Update sshd_config for certificate validation
      lineinfile:
        path: /etc/ssh/sshd_config
        regexp: "^TrustedUserCAKeys"
        line: "TrustedUserCAKeys /etc/ssh/ansible_ca.pub"
        state: present
      notify: restart sshd
    
    - name: Restrict certificate principals
      lineinfile:
        path: /etc/ssh/sshd_config
        regexp: "^AuthorizedPrincipals"
        line: "AuthorizedPrincipals FILE:/etc/ssh/principals/%u"
        state: present
    
    - name: Create principals file for ansible user
      file:
        path: /etc/ssh/principals/ansible
        content: |
          ansible
          automation
          devops
        owner: root
        group: root
        mode: 0644
    
    - name: Restart SSH
      service:
        name: sshd
        state: restarted
  
  handlers:
    - name: restart sshd
      service:
        name: sshd
        state: restarted
EOF

# Deploy to all hosts
ansible-playbook /opt/ansible-deploy-keys.yml -i /etc/ansible/inventory/

# STEP 6: SSH key rotation automation
cat > /usr/local/bin/rotate-ansible-ssh-keys.sh << 'EOF'
#!/bin/bash
# Rotate Ansible SSH keys every 90 days
# Triggered by cron job

set -e
LOG_FILE="/var/log/ansible-key-rotation.log"

echo "[$(date)] Starting SSH key rotation..." >> $LOG_FILE

# 1. Generate new key pair
NEW_KEY_NAME="/etc/ansible/ssh-keys/ansible-$(date +%s)"
ssh-keygen -t ed25519 -f $NEW_KEY_NAME -N "" -C "ansible@techflow-prod-$(date +%Y%m%d)"

echo "[$(date)] New key generated: $NEW_KEY_NAME" >> $LOG_FILE

# 2. Store in Vault
export VAULT_ADDR="http://vault.internal:8200"
export VAULT_TOKEN="$(cat /etc/vault/token)"

PREV_KEY=$(vault kv get -field=private_key secret/ansible/ssh-keys/master)
vault kv put secret/ansible/ssh-keys/master \
  private_key=@${NEW_KEY_NAME} \
  public_key=@${NEW_KEY_NAME}.pub \
  previous_key="$PREV_KEY" \
  created_date="$(date)" \
  rotation_date="$(date -d '+90 days')"

echo "[$(date)] Key stored in Vault" >> $LOG_FILE

# 3. Deploy new public key to all hosts (with old key still active for backup)
ansible-playbook /opt/ansible-deploy-keys.yml -i /etc/ansible/inventory/ \
  >> $LOG_FILE 2>&1

# 4. Test new key connectivity
for host in $(ansible -i /etc/ansible/inventory/ all --list-hosts | head -10); do
  ssh -i $NEW_KEY_NAME -o StrictHostKeyChecking=no ansible@$host "echo OK" \
    && echo "[$(date)] ✓ SSH OK on $host" >> $LOG_FILE \
    || echo "[$(date)] ✗ SSH FAILED on $host" >> $LOG_FILE
done

# 5. Archive old key (after 30-day grace period)
echo "[$(date)] Key rotation completed" >> $LOG_FILE
EOF

chmod +x /usr/local/bin/rotate-ansible-ssh-keys.sh

# Schedule rotation
echo "0 0 1 * * /usr/local/bin/rotate-ansible-ssh-keys.sh" | crontab -

# STEP 7: SSH key access audit
cat > /usr/local/bin/audit-ansible-keys.sh << 'EOF'
#!/bin/bash
echo "=== Ansible SSH Key Audit ==="

# Check key permissions
echo "SSH Key File Permissions:"
ls -la /etc/ansible/ssh-keys/

echo -e "\nKey Age:"
for key in /etc/ansible/ssh-keys/*; do
  echo "$(stat -c '%y' $key | cut -d. -f1): $(basename $key)"
done

echo -e "\nVault Key History:"
export VAULT_ADDR="http://vault.internal:8200"
vault kv metadata get secret/ansible/ssh-keys/master

echo -e "\nKey Usage (last 7 days):"
grep "ansible-master" /var/log/auth.log | tail -100
EOF

chmod +x /usr/local/bin/audit-ansible-keys.sh
```

---

# 🎯 SCENARIO 2: COMPLEX PLAYBOOK DESIGN & PATTERNS

## Challenge 2.1: Large-Scale Multi-Datacenter Deployment

**Problem**: Deploy application across 10 data centers with:
- Zero downtime
- Rolling updates
- Health checks
- Automatic rollback on failure
- Database migration coordination
- Load balancer integration

---

### Solution 2.1.1: Production-Grade Deployment Playbook

```yaml
# /etc/ansible/playbooks/deploy-payment-app-global.yml
---
- name: Global Payment App Deployment (Multi-DC, Zero-Downtime)
  hosts: localhost
  gather_facts: yes
  
  vars:
    app_name: payment-app
    app_version: "{{ deploy_version | mandatory }}"
    deployment_id: "{{ ansible_date_time.iso8601_basic_short }}"
    deployment_log: "/var/log/deployments/{{ deployment_id }}.log"
    rollback_enabled: true
    max_parallel_dcs: 2
    
    # Deployment stages
    stages:
      - name: pre_deployment
        description: "Pre-deployment checks"
      - name: database_migration
        description: "Database schema migrations"
      - name: deployment
        description: "Application deployment"
      - name: post_deployment
        description: "Health checks and verification"
  
  pre_tasks:
    - name: Initialize deployment
      block:
        - name: Create deployment log directory
          file:
            path: "{{ deployment_log | dirname }}"
            state: directory
            mode: 0755
        
        - name: Log deployment start
          lineinfile:
            path: "{{ deployment_log }}"
            create: yes
            line: "[{{ ansible_date_time.iso8601 }}] Deployment started - Version: {{ app_version }}, ID: {{ deployment_id }}"
        
        - name: Validate deployment version
          block:
            - name: Check version format
              assert:
                that:
                  - app_version is match('^v[0-9]+\.[0-9]+\.[0-9]+$')
                fail_msg: "Version must be in format: v1.2.3"
            
            - name: Check version exists in artifact repository
              uri:
                url: "http://artifact-repo.internal/api/v1/artifacts/{{ app_name }}/{{ app_version }}"
                method: HEAD
                status_code: 200
              register: version_check
              failed_when: version_check.status != 200
        
        - name: Check if deployment already in progress
          block:
            - name: Look for lock file
              stat:
                path: "/var/run/ansible/{{ app_name }}.lock"
              register: lock_file
            
            - name: Fail if deployment in progress
              fail:
                msg: "Deployment already in progress. Lock file: {{ lock_file.stat.path }}"
              when: lock_file.stat.exists
            
            - name: Create deployment lock
              copy:
                content: "{{ deployment_id }}"
                dest: "/var/run/ansible/{{ app_name }}.lock"
      
      rescue:
        - name: Log initialization failure
          lineinfile:
            path: "{{ deployment_log }}"
            line: "[{{ ansible_date_time.iso8601 }}] ERROR: Pre-deployment checks failed - {{ ansible_failed_result.msg }}"
        - fail:
            msg: "Pre-deployment checks failed"

  tasks:
    # STAGE 1: PRE-DEPLOYMENT VALIDATION
    - name: Stage 1 - Pre-Deployment Checks
      block:
        - name: Verify all datacenters are reachable
          command: "ansible -i /etc/ansible/inventory/cmdb.yml all -m ping --limit 'dc_*'"
          register: ping_result
          changed_when: false
          failed_when: "'failed' in ping_result.stdout"
        
        - name: Validate artifact exists and is healthy
          uri:
            url: "http://artifact-repo.internal/api/v1/artifacts/{{ app_name }}/{{ app_version }}/verify"
            method: POST
            body_format: json
            body:
              checksum: "{{ artifact_checksum | default('auto') }}"
          register: artifact_check
        
        - name: Pre-deployment system checks on sample servers
          block:
            - name: Check disk space (need 20% free minimum)
              shell: |
                ansible -i /etc/ansible/inventory/cmdb.yml dc_us_east_1 -m shell -a "df / | awk 'NR==2 {if (\$4 > 1000000) print \"OK\"; else exit 1}'"
              register: disk_check
              failed_when: disk_check.rc != 0
            
            - name: Check load average (should be < cores)
              shell: |
                ansible -i /etc/ansible/inventory/cmdb.yml dc_us_east_1 -m shell -a "uptime | awk -F'load average:' '{print \$2}'"
              register: load_check
            
            - name: Check available memory
              shell: |
                ansible -i /etc/ansible/inventory/cmdb.yml dc_us_east_1 -m shell -a "free -b | awk 'NR==2 {if (\$7 > 2000000000) print \"OK\"; else exit 1}'"
              register: memory_check
              failed_when: memory_check.rc != 0
        
        - name: Notify stakeholders of deployment
          mail:
            host: smtp.internal
            port: 25
            to: devops@company.com,payment-team@company.com
            subject: "Deployment Started: {{ app_name }} {{ app_version }}"
            body: |
              Deployment started at {{ ansible_date_time.iso8601 }}
              Version: {{ app_version }}
              Deployment ID: {{ deployment_id }}
              Target: All 10 datacenters (rolling deployment)
              Expected duration: 90 minutes
      
      rescue:
        - name: Abort deployment and notify
          block:
            - name: Remove lock file
              file:
                path: "/var/run/ansible/{{ app_name }}.lock"
                state: absent
            
            - name: Send failure notification
              mail:
                host: smtp.internal
                to: devops@company.com
                subject: "ALERT: Deployment FAILED - {{ app_name }} {{ app_version }}"
                body: "Pre-deployment checks failed: {{ ansible_failed_result.msg }}"
          always:
            - fail:
                msg: "Pre-deployment checks failed - deployment aborted"

    # STAGE 2: DATABASE MIGRATION (One-time, on primary)
    - name: Stage 2 - Database Migration
      block:
        - name: Connect to database master
          block:
            - name: Get database master IP
              shell: "ansible -i /etc/ansible/inventory/cmdb.yml db_masters -m setup -a 'filter=ansible_default_ipv4' | grep 'ansible_default_ipv4'"
              register: db_master_ip
            
            - name: Execute database migrations
              shell: |
                ssh {{ db_master_ip.stdout }} "
                  cd /opt/payment-db && \
                  export DB_VERSION={{ app_version }} && \
                  ./bin/migrate.sh --version {{ app_version }} --dry-run
                "
              register: migration_dry_run
            
            - name: Display migration changes
              debug:
                msg: "{{ migration_dry_run.stdout }}"
            
            - name: Confirm migration execution (pause for manual review)
              pause:
                prompt: |
                  ===== DATABASE MIGRATION PREVIEW =====
                  {{ migration_dry_run.stdout }}
                  
                  Press ENTER to continue migration or CTRL+C to abort
                  This will execute actual database changes!
            
            - name: Execute actual migration
              shell: |
                ssh {{ db_master_ip.stdout }} "
                  cd /opt/payment-db && \
                  ./bin/migrate.sh --version {{ app_version }} --execute && \
                  echo 'MIGRATION_SUCCESS' > /tmp/migration_{{ deployment_id }}.status
                "
              register: migration_result
              timeout: 1800
              async: 1800
              poll: 30
            
            - name: Verify migration success
              shell: |
                ssh {{ db_master_ip.stdout }} "test -f /tmp/migration_{{ deployment_id }}.status && cat /tmp/migration_{{ deployment_id }}.status"
              register: migration_status
              failed_when: "'MIGRATION_SUCCESS' not in migration_status.stdout"
            
            - name: Wait for replication catch-up (if using replicas)
              shell: |
                ssh {{ db_master_ip.stdout }} "
                  mysql -u devops -p{{ db_password }} -e \
                  \"SELECT COUNT(*) as ReplicationLag FROM performance_schema.replication_connection_status WHERE service_state = 'OFF'\"
                "
              register: repl_status
              until: "'0' in repl_status.stdout"
              retries: 60
              delay: 10
      
      rescue:
        - name: Rollback database migration
          block:
            - name: Execute database rollback
              shell: |
                ssh {{ db_master_ip.stdout }} "
                  cd /opt/payment-db && \
                  ./bin/migrate.sh --version {{ app_version }} --rollback
                "
            - fail:
                msg: "Database migration failed and was rolled back"

    # STAGE 3: APPLICATION DEPLOYMENT (Parallel across DCs)
    - name: Stage 3 - Application Deployment Across DCs
      block:
        - name: Deploy to each datacenter (rolling, limited parallelism)
          include_tasks: deploy-to-datacenter.yml
          loop: "{{ datacenters }}"
          loop_control:
            loop_var: dc_name
            max_items: "{{ max_parallel_dcs }}"
          vars:
            datacenters: "{{ groups.keys() | select('match', '^dc_') | list }}"
        
        - name: Monitor deployment progress
          block:
            - name: Check deployment status on all servers
              shell: |
                ansible -i /etc/ansible/inventory/cmdb.yml all -m shell -a \
                  "cat /opt/payment-app/.version"
              register: version_check_result
              until: "version_check_result.stdout is search(app_version)"
              retries: 30
              delay: 10
      
      rescue:
        - name: Initiate deployment rollback
          block:
            - name: Stop new deployments
              meta: clear_host_errors
            
            - name: Execute rollback playbook
              include_tasks: rollback-deployment.yml
              vars:
                previous_version: "{{ running_version | default('v1.0.0') }}"
            
            - fail:
                msg: "Application deployment failed - automatic rollback initiated"

    # STAGE 4: POST-DEPLOYMENT VERIFICATION
    - name: Stage 4 - Post-Deployment Verification
      block:
        - name: Health checks
          block:
            - name: Check application health endpoints
              uri:
                url: "http://{{ groups['tier_api'][item] }}:8080/health"
                method: GET
                status_code: 200
              loop: "{{ range(groups['tier_api'] | length) }}"
              register: health_check
              until: health_check.status == 200
              retries: 10
              delay: 10
            
            - name: Check metrics
              shell: |
                curl -s http://{{ groups['tier_api'][0] }}:9090/metrics | \
                grep -E "requests_total|error_rate|response_time"
              register: metrics
            
            - name: Validate metrics are healthy
              assert:
                that:
                  - "'error_rate{job=\"payment-app\"} < 0.01' in metrics.stdout"
                fail_msg: "Error rate too high post-deployment"
        
        - name: Smoke tests
          block:
            - name: Execute payment transaction test (small amount)
              uri:
                url: "http://{{ groups['tier_api'][0] }}:8080/api/v1/payment/test"
                method: POST
                body_format: json
                body:
                  amount: 0.01
                  currency: "USD"
              register: smoke_test
              failed_when: smoke_test.status != 200
            
            - name: Verify transaction in database
              shell: |
                mysql -u devops -p{{ db_password }} payment_db -e \
                  "SELECT COUNT(*) FROM transactions WHERE amount = 0.01 AND created_date > DATE_SUB(NOW(), INTERVAL 5 MINUTE)"
              register: db_verification
              failed_when: "'0' in db_verification.stdout"
        
        - name: Performance baseline
          block:
            - name: Check response times
              uri:
                url: "http://{{ groups['tier_api'][0] }}:8080/api/v1/payment/status"
                method: GET
              register: perf_check
              
            - name: Assert response time < 100ms
              assert:
                that:
                  - "perf_check.elapsed < 0.1"
                fail_msg: "Response time degraded post-deployment"
        
        - name: Deployment success notification
          mail:
            host: smtp.internal
            to: devops@company.com,payment-team@company.com
            subject: "✓ Deployment Successful: {{ app_name }} {{ app_version }}"
            body: |
              Deployment completed successfully!
              Version: {{ app_version }}
              Deployment ID: {{ deployment_id }}
              Duration: {{ (ansible_date_time.epoch | int) - (deployment_start_time | int) }} seconds
              
              All health checks passed.
              All smoke tests passed.
              Performance is nominal.
      
      rescue:
        - name: Failed smoke test recovery
          block:
            - name: Alert and prepare rollback
              mail:
                host: smtp.internal
                to: devops@company.com,payment-team@company.com
                subject: "ALERT: Post-Deployment Tests FAILED"
                body: "Post-deployment health checks failed. Initiating rollback..."
            
            - name: Automatic rollback on failed tests
              include_tasks: rollback-deployment.yml

  always:
    - name: Cleanup and finalize
      block:
        - name: Remove deployment lock
          file:
            path: "/var/run/ansible/{{ app_name }}.lock"
            state: absent
        
        - name: Archive deployment logs
          shell: |
            gzip {{ deployment_log }}
            mv {{ deployment_log }}.gz /var/log/deployments/archive/
        
        - name: Update deployment record in CMDB
          uri:
            url: "http://cmdb.internal/api/v1/deployments"
            method: POST
            body_format: json
            body:
              deployment_id: "{{ deployment_id }}"
              app_name: "{{ app_name }}"
              version: "{{ app_version }}"
              status: "{{ 'success' if not ansible_failed_result else 'failed' }}"
              duration: "{{ (ansible_date_time.epoch | int) - (deployment_start_time | int) }}"
              deployed_at: "{{ ansible_date_time.iso8601 }}"
```

---

### Solution 2.1.2: Include Tasks for Per-Datacenter Deployment

```yaml
# /etc/ansible/playbooks/tasks/deploy-to-datacenter.yml
---
- name: Deploy to datacenter {{ dc_name }}
  block:
    - name: Initialize datacenter deployment
      set_fact:
        dc_deployment_start: "{{ ansible_date_time.epoch }}"
        dc_host_group: "{{ dc_name }}"
    
    - name: Drain connections from load balancer
      block:
        - name: Get load balancer for this DC
          shell: "ansible -i /etc/ansible/inventory/cmdb.yml {{ dc_host_group }} -m debug -a 'msg={{ hostvars[inventory_hostname].load_balancer }}' | grep -oP '(?<=msg\": \")[^\"]+'"
          register: lb_info
        
        - name: Remove servers from load balancer pool
          shell: |
            for server in $(ansible -i /etc/ansible/inventory/cmdb.yml {{ dc_host_group }} --list-hosts | tail -n +2); do
              curl -X DELETE http://{{ lb_info.stdout }}/api/v1/pool/$server
            done
          register: lb_drain
        
        - name: Wait for connection draining
          pause:
            seconds: 30
    
    - name: Backup current application state
      shell: |
        ansible -i /etc/ansible/inventory/cmdb.yml {{ dc_host_group }} -m shell -a \
          "tar -czf /tmp/payment-app-backup-{{ deployment_id }}.tar.gz /opt/payment-app"
      async: 600
      poll: 30
    
    - name: Stop application gracefully
      block:
        - name: Send SIGTERM to application
          shell: |
            ansible -i /etc/ansible/inventory/cmdb.yml {{ dc_host_group }} -m shell -a \
              "systemctl stop payment-app --no-block && sleep 30"
        
        - name: Verify process stopped
          shell: |
            ansible -i /etc/ansible/inventory/cmdb.yml {{ dc_host_group }} -m shell -a \
              "pgrep -f payment-app" | grep -v "grep"
          register: process_check
          failed_when: process_check.rc == 0  # Process still running = failure
    
    - name: Deploy new version
      block:
        - name: Download artifact
          shell: |
            ansible -i /etc/ansible/inventory/cmdb.yml {{ dc_host_group }} -m shell -a \
              "wget -q http://artifact-repo.internal/builds/{{ app_name }}/{{ app_version }}/app.tar.gz -O /tmp/app.tar.gz && md5sum /tmp/app.tar.gz"
          register: download_result
        
        - name: Verify artifact checksum
          shell: |
            echo '{{ artifact_checksum }} /tmp/app.tar.gz' | md5sum -c -
          register: checksum_verify
          failed_when: checksum_verify.rc != 0
        
        - name: Extract and install
          shell: |
            ansible -i /etc/ansible/inventory/cmdb.yml {{ dc_host_group }} -m shell -a \
              "mkdir -p /opt/payment-app-new && \
               tar -xzf /tmp/app.tar.gz -C /opt/payment-app-new && \
               rm -rf /opt/payment-app.old && \
               mv /opt/payment-app /opt/payment-app.old && \
               mv /opt/payment-app-new /opt/payment-app"
        
        - name: Update version file
          shell: |
            ansible -i /etc/ansible/inventory/cmdb.yml {{ dc_host_group }} -m shell -a \
              "echo '{{ app_version }}' > /opt/payment-app/.version"
    
    - name: Start application
      block:
        - name: Start payment-app service
          shell: |
            ansible -i /etc/ansible/inventory/cmdb.yml {{ dc_host_group }} -m shell -a \
              "systemctl start payment-app"
        
        - name: Wait for app to be ready
          shell: |
            ansible -i /etc/ansible/inventory/cmdb.yml {{ dc_host_group }} -m shell -a \
              "for i in {1..60}; do \
                 curl -s http://localhost:8080/health && break; \
                 sleep 1; \
               done"
          register: app_ready
          failed_when: app_ready.rc != 0
    
    - name: Health verification in DC
      block:
        - name: Check all endpoints in DC
          shell: |
            ansible -i /etc/ansible/inventory/cmdb.yml {{ dc_host_group }} -m uri -a \
              "url=http://localhost:8080/health method=GET status_code=200" \
              -o "{{ dc_name }}_health_check.json"
          register: health_result
          failed_when: "'failed' in health_result.stdout"
    
    - name: Re-register with load balancer
      shell: |
        for server in $(ansible -i /etc/ansible/inventory/cmdb.yml {{ dc_host_group }} --list-hosts | tail -n +2); do
          curl -X POST http://{{ lb_info.stdout }}/api/v1/pool \
            -d "server=$server&weight=100&healthy=true"
        done
    
    - name: Monitor new deployment in DC
      shell: |
        ansible -i /etc/ansible/inventory/cmdb.yml {{ dc_host_group }} -m shell -a \
          "tail -100 /var/log/payment-app/app.log | grep -iE 'error|exception|failed'"
      register: error_check
      failed_when: error_check.stdout != ""
  
  rescue:
    - name: Rollback this datacenter
      block:
        - name: Stop failed deployment
          shell: |
            ansible -i /etc/ansible/inventory/cmdb.yml {{ dc_host_group }} -m shell -a \
              "systemctl stop payment-app"
        
        - name: Restore previous version
          shell: |
            ansible -i /etc/ansible/inventory/cmdb.yml {{ dc_host_group }} -m shell -a \
              "rm -rf /opt/payment-app && mv /opt/payment-app.old /opt/payment-app"
        
        - name: Restart with previous version
          shell: |
            ansible -i /etc/ansible/inventory/cmdb.yml {{ dc_host_group }} -m shell -a \
              "systemctl start payment-app"
        
        - name: Alert operations team
          mail:
            host: smtp.internal
            to: oncall@company.com
            subject: "ALERT: Deployment FAILED in {{ dc_name }} - Rolled back"
            body: "Deployment to {{ dc_name }} failed and was rolled back. Check logs for details."
        
        - fail:
            msg: "Deployment failed in {{ dc_name }}"

  always:
    - name: Cleanup DC-specific temp files
      shell: |
        ansible -i /etc/ansible/inventory/cmdb.yml {{ dc_host_group }} -m shell -a \
          "rm -f /tmp/app.tar.gz /tmp/payment-app-backup-*.tar.gz"
```

---

# 🎯 SCENARIO 3: PERFORMANCE OPTIMIZATION & SCALING

## Challenge 3.1: Slow Playbook Execution - 3 Hours to Deploy

**Problem**: Deploying to 5000 servers takes 3 hours (should be 20 minutes).

**Root Causes**:
- `forks=5` (default) - only 5 servers in parallel
- Lots of `gather_facts` overhead
- Synchronous commands (no async)
- Excessive file transfers

---

### Solution 3.1: Performance Optimization

```yaml
# /etc/ansible/ansible.cfg - Performance Tuning
[defaults]
# Parallelization
forks = 200                    # Run tasks on 200 servers simultaneously
worker_processes = 4           # Use 4 worker processes
task_queue_manager_module = queue.Queue

# Fact caching (critical optimization)
gathering = smart              # Only gather facts once per host per playbook
fact_caching = jsonfile
fact_caching_connection = /var/cache/ansible
fact_caching_timeout = 86400   # Cache for 24 hours
gather_timeout = 30

# SSH tuning
ssh_args = -C -o ControlMaster=auto -o ControlPersist=60s \
           -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no \
           -o IdentitiesOnly=yes \
           -o ProxyCommand="ssh -W %h:%p bastion-01.internal" \
           -o Compression=no

pipelining = True              # Don't create separate SSH connection for each task
# ^^ Critical: reduces overhead from 3+ SSH connections per task to 1

# Timeouts
timeout = 30
command_timeout = 45

[ssh_connection]
control_path = /tmp/ansible-ssh-%%h-%%p-%%r
control_master = auto
control_persist = 60s

# /etc/ansible/playbooks/optimized-deploy.yml
---
- name: Optimized Large-Scale Deployment
  hosts: all
  
  # OPTIMIZATION 1: Disable fact gathering if not needed
  gather_facts: no
  
  vars:
    # Pre-define variables to avoid lookups during playbook
    app_version: "v2.1.0"
    deployment_user: "ansible"
    app_home: "/opt/payment-app"
  
  tasks:
    # OPTIMIZATION 2: Use ansible_user_dir fact only once at play level
    - name: Get user home directory (facts gathered once)
      setup:
        filter: ansible_user_dir
      run_once: true
      register: user_facts
    
    # OPTIMIZATION 3: Batch multiple operations into single task
    - name: Batch deployment steps (fewer SSH connections)
      block:
        - name: Download, extract, and configure in one block
          shell: |
            set -e
            # Download
            cd /tmp
            wget -q http://artifact-repo/builds/payment-app/{{ app_version }}/app.tar.gz
            
            # Extract
            mkdir -p {{ app_home }}-new
            tar -xzf app.tar.gz -C {{ app_home }}-new
            
            # Backup and swap
            [ -d {{ app_home }}.old ] && rm -rf {{ app_home }}.old
            [ -d {{ app_home }} ] && mv {{ app_home }} {{ app_home }}.old
            mv {{ app_home }}-new {{ app_home }}
            
            # Update version file
            echo '{{ app_version }}' > {{ app_home }}/.version
            
            # Cleanup
            rm -f app.tar.gz
          
          register: deploy_result
          changed_when: "'error' not in deploy_result.stderr"
      
      async: 300
      poll: 0
      register: deploy_tasks
    
    # OPTIMIZATION 4: Wait for all async tasks to complete
    - name: Wait for deployment to complete on all hosts
      async_status:
        jid: "{{ item.ansible_job_id }}"
      loop: "{{ deploy_tasks.results }}"
      register: async_poll_results
      until: async_poll_results.finished
      retries: 100
      delay: 3
    
    # OPTIMIZATION 5: Use include_tasks instead of include for dynamic content
    # (avoided here as we're using static tasks)
    
    # OPTIMIZATION 6: Serial updates for critical components
    - name: Rolling restart (with serial to prevent full outage)
      block:
        - name: Restart payment-app service
          systemd:
            name: payment-app
            state: restarted
            daemon_reload: yes
      
      serial: 10%  # Restart 10% of servers at a time (500 servers)
    
    # OPTIMIZATION 7: Aggregate results instead of reporting per-host
    - name: Check deployment status (aggregate report)
      shell: "cat {{ app_home }}/.version"
      register: version_check
      changed_when: false
    
    - name: Report deployment summary
      debug:
        msg: |
          Deployment Summary:
          ==================
          Total Hosts: {{ ansible_play_hosts | length }}
          Successful: {{ version_check.results | selectattr('rc', 'equalto', 0) | list | length }}
          Failed: {{ version_check.results | selectattr('rc', 'notequalto', 0) | list | length }}
      run_once: true

# Execution comparison:
# Before optimization: ansible-playbook deploy.yml took 3 hours
# After optimization: ansible-playbook deploy.yml took ~8 minutes
#
# Improvements:
# - forks: 5 -> 200 (40x parallelism improvement)
# - pipelining enabled (saves SSH connection setup)
# - fact caching (skip facts gathering)
# - async/poll (don't wait for each host to complete)
# - batch operations (fewer tasks = fewer SSH connections)
```

---

### Solution 3.2: Playbook Execution Profiling

```bash
# STEP 1: Enable Ansible callback plugin for timing analysis
cat > /usr/share/ansible/plugins/callback/profile_tasks.py << 'EOF'
# Ansible callback plugin to show task execution times
import time
from ansible.plugins.callback import CallbackBase

class CallbackModule(CallbackBase):
    CALLBACK_VERSION = 2.0
    CALLBACK_TYPE = 'aggregate'
    CALLBACK_NAME = 'profile_tasks'

    def __init__(self):
        self.stats = {}
        super(CallbackModule, self).__init__()

    def v2_runner_on_start(self, host, task):
        self.stats[task._uuid] = {'task': task.name, 'start': time.time()}

    def v2_runner_on_ok(self, result, **kwargs):
        task_uuid = result._task._uuid
        elapsed = time.time() - self.stats[task_uuid]['start']
        task_name = self.stats[task_uuid]['task']
        
        if elapsed > 1.0:  # Only show tasks longer than 1 second
            self._display.display(
                f"⏱️  {task_name} on {result._host.get_name()} took {elapsed:.2f}s"
            )

    def v2_playbook_on_stats(self, stats):
        self._display.display("\n=== Slowest Tasks ===")
        sorted_tasks = sorted(self.stats.items(), 
                            key=lambda x: x[1].get('duration', 0), 
                            reverse=True)
        for task_id, task_info in sorted_tasks[:10]:
            print(f"{task_info['task']}: {task_info.get('duration', 0):.2f}s")
EOF

# STEP 2: Enable callback plugin
echo "callbacks_enabled = profile_tasks" >> /etc/ansible/ansible.cfg

# STEP 3: Run playbook with profiling
ANSIBLE_STDOUT_CALLBACK=profile_tasks ansible-playbook deploy.yml -i inventory/ | grep "⏱️"

# Output:
# ⏱️  Download artifact took 15.23s
# ⏱️  Extract application took 8.45s
# ⏱️  Restart service took 5.67s
# ⏱️  Health check took 45.23s
```

---

# 🎯 SCENARIO 4: ERROR HANDLING, RETRIES & RESILIENCE

## Challenge 4.1: Transient Failures Causing Deployment Failures

**Problem**: Occasional network hiccups, timeouts, or service restart delays cause playbooks to fail.

---

### Solution 4.1: Comprehensive Error Handling & Retry Strategy

```yaml
# /etc/ansible/playbooks/resilient-deployment.yml
---
- name: Resilient Deployment with Advanced Error Handling
  hosts: all
  
  vars:
    max_retries: 5
    retry_delay: 10
    circuit_breaker_threshold: 3
    failed_hosts: []
  
  tasks:
    - name: Download artifact with exponential backoff
      block:
        - name: Attempt download (with automatic retries)
          get_url:
            url: "http://artifact-repo/builds/app-{{ version }}.tar.gz"
            dest: "/tmp/app-{{ version }}.tar.gz"
            checksum: "sha256:{{ artifact_sha256 }}"
            timeout: 30
          
          register: download_result
          retries: 5                # Retry up to 5 times
          delay: "{{ [2 ** item, 60] | min }}"  # Exponential backoff: 2, 4, 8, 16, 32, 60 seconds
          until: download_result is successful
          
          rescue:
            - name: Fail with detailed error
              fail:
                msg: |
                  Failed to download after {{ max_retries }} attempts
                  Last error: {{ download_result.msg }}
                  Host: {{ inventory_hostname }}
    
    - name: Extract with validation
      block:
        - name: Extract archive
          unarchive:
            src: "/tmp/app-{{ version }}.tar.gz"
            dest: "/opt/app-new"
            remote_src: yes
          
          register: extract_result
          retries: 3
          delay: 5
          until: extract_result is successful
        
        - name: Validate extracted files
          block:
            - name: Check if critical files exist
              stat:
                path: "/opt/app-new/{{ item }}"
              register: file_check
              loop:
                - "bin/app"
                - "config/app.yml"
                - "lib/dependencies.jar"
              failed_when: not file_check.stat.exists
        
        - name: Fallback: extract from backup location
          block:
            - name: Try alternate repo
              get_url:
                url: "http://backup-repo/builds/app-{{ version }}.tar.gz"
                dest: "/tmp/app-backup-{{ version }}.tar.gz"
              
              register: backup_download
              retries: 3
              delay: 5
              until: backup_download is successful
          
          rescue:
            - name: Handle critical failure
              fail:
                msg: "Failed to obtain artifact from all sources"
          
          when: extract_result is failed
    
    - name: Start service with health check integration
      block:
        - name: Start application service
          systemd:
            name: payment-app
            state: started
            daemon_reload: yes
          
          register: service_start
          retries: 3
          delay: 10
          until: service_start is successful
        
        - name: Wait for application to be ready (custom health check)
          block:
            - name: Poll health endpoint
              uri:
                url: "http://localhost:8080/health"
                method: GET
                status_code: 200
              
              register: health_check
              retries: 30
              delay: 2
              until: health_check.status == 200
            
            - name: Verify key metrics
              uri:
                url: "http://localhost:8080/metrics"
                method: GET
              
              register: metrics
              retries: 5
              delay: 2
              until: |
                metrics.status == 200 and 
                'requests_total' in metrics.content
          
          rescue:
            - name: Collect diagnostics on health check failure
              block:
                - name: Get service status
                  shell: "systemctl status payment-app"
                  register: service_status
                
                - name: Get recent logs
                  shell: "journalctl -u payment-app -n 50 --no-pager"
                  register: service_logs
                
                - name: Get error details
                  debug:
                    msg: |
                      Service Status:
                      {{ service_status.stdout }}
                      
                      Recent Logs:
                      {{ service_logs.stdout }}
                
                - name: Attempt service restart
                  systemd:
                    name: payment-app
                    state: restarted
                  register: restart_result
                
                - name: Verify health after restart
                  uri:
                    url: "http://localhost:8080/health"
                    method: GET
                    status_code: 200
                  
                  register: post_restart_health
                  retries: 10
                  delay: 5
                  until: post_restart_health.status == 200
              
              rescue:
                - name: Mark host as failed for remediation
                  set_fact:
                    failed_hosts: "{{ failed_hosts + [inventory_hostname] }}"
                
                - name: Alert operations team
                  mail:
                    host: smtp.internal
                    to: oncall@company.com
                    subject: "ALERT: Host {{ inventory_hostname }} failed to start payment-app"
                    body: |
                      Host: {{ inventory_hostname }}
                      Error: {{ service_logs.stdout }}
                
                - fail:
                    msg: "Service health check failed on {{ inventory_hostname }}"
    
    - name: Monitoring and circuit breaker
      block:
        - name: Count failed hosts
          set_fact:
            failed_count: "{{ failed_hosts | length }}"
        
        - name: Check if failure threshold exceeded
          block:
            - name: Calculate failure percentage
              set_fact:
                failure_percentage: "{{ (failed_count | int / ansible_play_hosts | length * 100) | int }}"
            
            - name: Trigger circuit breaker if too many failures
              fail:
                msg: |
                  CIRCUIT BREAKER TRIGGERED
                  Failed hosts: {{ failed_count }} / {{ ansible_play_hosts | length }}
                  Failure rate: {{ failure_percentage }}%
                  Threshold: 10%
              when: failure_percentage | int > 10
          
          when: failed_count | int > 0
  
  rescue:
    - name: Global error handler
      block:
        - name: Log failure
          copy:
            content: |
              Playbook execution failed at {{ ansible_date_time.iso8601 }}
              Failed hosts: {{ failed_hosts | join(', ') }}
              Total failures: {{ failed_hosts | length }}
            dest: "/var/log/ansible-failure-{{ deployment_id }}.log"
        
        - name: Send comprehensive failure report
          mail:
            host: smtp.internal
            to: devops@company.com
            subject: "Deployment FAILED - Investigation Required"
            body: |
              Deployment ID: {{ deployment_id }}
              Version: {{ version }}
              Failed Hosts: {{ failed_hosts | length }}
              
              Failed hosts:
              {% for host in failed_hosts %}
              - {{ host }}
              {% endfor %}
              
              Check /var/log/ansible-failure-{{ deployment_id }}.log for details

  always:
    - name: Print deployment summary
      debug:
        msg: |
          ===== Deployment Summary =====
          Total Hosts: {{ ansible_play_hosts | length }}
          Successful: {{ (ansible_play_hosts | length) - (failed_hosts | length) }}
          Failed: {{ failed_hosts | length }}
          Duration: {{ ansible_date_time.epoch | int - play_start_time | int }} seconds
```

---

# 🎯 SCENARIO 5: INFRASTRUCTURE AS CODE (IaC) - ANSIBLE + TERRAFORM INTEGRATION

## Challenge 5.1: Managing Infrastructure Provisioning at Scale

**Problem**: 5000 servers provisioned manually across 10 data centers. Need IaC automation.

---

### Solution 5.1: Terraform + Ansible Integration

```bash
# STEP 1: Create Terraform configuration
cat > /terraform/main.tf << 'EOF'
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket         = "terraform-state"
    key            = "production/main.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC and networking
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  
  tags = {
    Name        = "techflow-vpc"
    Environment = "production"
  }
}

# Payment API tier servers
resource "aws_instance" "payment_api" {
  count                = var.payment_api_count
  ami                  = data.aws_ami.ubuntu.id
  instance_type        = "c5.2xlarge"
  subnet_id            = aws_subnet.private[count.index % 3].id
  iam_instance_profile = aws_iam_instance_profile.ec2_profile.name
  
  vpc_security_group_ids = [aws_security_group.payment_api.id]
  
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 100
    delete_on_termination = true
    encrypted             = true
  }
  
  tags = {
    Name        = "payment-api-${count.index + 1}"
    Environment = "production"
    Application = "payment"
    Tier        = "api"
    ManagedBy   = "terraform"
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# Output inventory for Ansible
resource "local_file" "ansible_inventory" {
  filename = "/etc/ansible/inventory/terraform-generated/hosts.yml"
  
  content = yamlencode({
    all = {
      children = {
        payment_api = {
          hosts = {
            for i, instance in aws_instance.payment_api : "payment-api-${i + 1}" => {
              ansible_host = instance.private_ip
              instance_id  = instance.id
            }
          }
        }
      }
    }
  })
}

# Output variables
output "payment_api_instances" {
  value = [for instance in aws_instance.payment_api : instance.id]
}
EOF

# STEP 2: Execute Terraform
cd /terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan

# STEP 3: Create inventory plugin to read Terraform state
cat > /usr/lib/python3/dist-packages/ansible/plugins/inventory/terraform.py << 'EOF'
from ansible.plugins.inventory import BaseInventoryPlugin
import json
import subprocess

class InventoryModule(BaseInventoryPlugin):
    NAME = 'terraform'
    
    def verify_file(self, path):
        return path.endswith('terraform.yml')
    
    def parse(self, inventory, loader, path, cache=True):
        super(InventoryModule, self).parse(inventory, loader, path, cache)
        
        # Read Terraform state
        state_file = '/terraform/terraform.tfstate'
        with open(state_file) as f:
            state = json.load(f)
        
        # Parse resources from state
        for resource in state['resources']:
            if resource['type'] == 'aws_instance':
                for instance in resource['instances']:
                    hostname = instance['attributes']['tags']['Name']
                    ip = instance['attributes']['private_ip']
                    
                    self.inventory.add_host(hostname)
                    self.inventory.set_variable(hostname, 'ansible_host', ip)
                    self.inventory.set_variable(hostname, 'instance_id', instance['attributes']['id'])
                    
                    # Add to groups
                    tier = instance['attributes']['tags']['Tier']
                    app = instance['attributes']['tags']['Application']
                    
                    self.inventory.add_group(f'tier_{tier}')
                    self.inventory.add_group(f'app_{app}')
                    self.inventory.add_host(hostname, group=f'tier_{tier}')
                    self.inventory.add_host(hostname, group=f'app_{app}')
EOF

# STEP 4: Create Ansible playbook to provision instances post-Terraform
cat > /etc/ansible/playbooks/configure-terraform-instances.yml << 'EOF'
---
- name: Configure Terraform-Provisioned Instances
  hosts: all
  gather_facts: yes
  become: yes
  
  tasks:
    - name: Update system packages
      apt:
        update_cache: yes
        upgrade: dist
      when: ansible_os_family == 'Debian'
    
    - name: Install base packages
      package:
        name: "{{ packages }}"
        state: present
      vars:
        packages:
          - python3-pip
          - git
          - curl
          - wget
          - htop
          - net-tools
          - ntp
          - collectd
    
    - name: Configure payment-app application
      block:
        - name: Create app user
          user:
            name: payment
            home: /opt/payment-app
            shell: /bin/bash
        
        - name: Install payment-app
          shell: |
            cd /opt && \
            git clone https://github.com/company/payment-app.git && \
            cd payment-app && \
            git checkout {{ app_version }}
        
        - name: Install dependencies
          shell: "cd /opt/payment-app && pip install -r requirements.txt"
        
        - name: Configure systemd service
          template:
            src: payment-app.service.j2
            dest: /etc/systemd/system/payment-app.service
          notify: restart payment-app
    
    - name: Setup monitoring
      block:
        - name: Install Prometheus node exporter
          shell: |
            wget https://github.com/prometheus/node_exporter/releases/download/v1.3.1/node_exporter-1.3.1.linux-amd64.tar.gz
            tar -xzf node_exporter-1.3.1.linux-amd64.tar.gz
            mv node_exporter-1.3.1.linux-amd64/node_exporter /usr/local/bin/
        
        - name: Setup node exporter service
          systemd:
            name: node-exporter
            enabled: yes
            state: started
  
  handlers:
    - name: restart payment-app
      systemd:
        name: payment-app
        state: restarted
        daemon_reload: yes
EOF

# STEP 5: Execute post-provisioning playbook
ansible-playbook -i /etc/ansible/inventory/terraform.yml \
  /etc/ansible/playbooks/configure-terraform-instances.yml
```

---

# 🎯 SCENARIO 6: CONFIGURATION MANAGEMENT AT SCALE

## Challenge 6.1: Managing Configuration Across 5000 Servers

**Problem**: 10,000+ configuration files, inconsistent versions, manual updates cause outages.

---

### Solution 6.1: Configuration as Code with Ansible

```yaml
# /etc/ansible/roles/payment-app/defaults/main.yml
---
# Default configuration values
payment_app_version: "v2.1.0"
payment_app_port: 8080
payment_app_debug: false
payment_db_host: "payment-db.internal"
payment_db_port: 3306
payment_db_pool_size: 20
payment_cache_redis_host: "redis.internal"
payment_cache_redis_port: 6379
payment_log_level: "INFO"
payment_metrics_enabled: true

# /etc/ansible/roles/payment-app/vars/main.yml
---
# Override defaults with environment-specific values
payment_app_config_dir: "/etc/payment-app"
payment_app_log_dir: "/var/log/payment-app"
payment_app_data_dir: "/var/lib/payment-app"

# /etc/ansible/roles/payment-app/templates/app.yml.j2
---
# Jinja2 template for application configuration
server:
  port: {{ payment_app_port }}
  address: 0.0.0.0
  debug: {{ payment_app_debug | default(false) }}
  servlet:
    context-path: /api/v1
    
spring:
  application:
    name: payment-app
  
  datasource:
    url: "jdbc:mysql://{{ payment_db_host }}:{{ payment_db_port }}/payment_db"
    username: "{{ payment_db_user }}"
    password: "{{ payment_db_password }}"
    hikari:
      maximum-pool-size: {{ payment_db_pool_size }}
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 300000
  
  redis:
    host: {{ payment_cache_redis_host }}
    port: {{ payment_cache_redis_port }}
    
  jpa:
    hibernate:
      ddl-auto: validate
  
  jackson:
    serialization:
      write-dates-as-timestamps: false

logging:
  level:
    com.company.payment: {{ payment_log_level }}
  file:
    name: {{ payment_app_log_dir }}/app.log
    max-size: 100MB
    max-history: 30

management:
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus
  metrics:
    enabled: {{ payment_metrics_enabled }}

# /etc/ansible/roles/payment-app/tasks/main.yml
---
- name: Deploy payment-app configuration
  block:
    - name: Create configuration directory
      file:
        path: "{{ payment_app_config_dir }}"
        owner: payment
        group: payment
        mode: 0755
        state: directory
    
    - name: Generate application configuration (dynamic)
      template:
        src: app.yml.j2
        dest: "{{ payment_app_config_dir }}/application.yml"
        owner: payment
        group: payment
        mode: 0640
        backup: yes
      notify: validate app configuration
    
    - name: Generate database configuration (with secrets from Vault)
      template:
        src: database.yml.j2
        dest: "{{ payment_app_config_dir }}/database.yml"
        owner: payment
        group: payment
        mode: 0600  # Restricted: only owner can read (contains password)
        backup: yes
      vars:
        # Fetch database password from Vault
        payment_db_password: "{{ lookup('hashi_vault', 'secret=secret/payment-app/database:password') }}"
      notify: validate app configuration
    
    - name: Validate configuration syntax
      shell: |
        python3 -c "import yaml; yaml.safe_load(open('{{ payment_app_config_dir }}/application.yml'))"
      changed_when: false
      register: config_validate
      failed_when: config_validate.rc != 0
    
    - name: Generate configuration audit log
      lineinfile:
        path: "/var/log/payment-app/config-changes.log"
        create: yes
        line: "[{{ ansible_date_time.iso8601 }}] Config deployed to {{ inventory_hostname }} by {{ ansible_user_id }}"
      
    - name: Restart service if configuration changed
      systemd:
        name: payment-app
        state: restarted
        daemon_reload: yes
      when: config_validate is changed
  
  rescue:
    - name: Restore previous configuration on failure
      shell: |
        if [ -f "{{ payment_app_config_dir }}/application.yml.bak" ]; then
          cp "{{ payment_app_config_dir }}/application.yml.bak" "{{ payment_app_config_dir }}/application.yml"
          systemctl restart payment-app
        fi
    - fail:
        msg: "Configuration deployment failed and was rolled back"

  handlers:
    - name: validate app configuration
      shell: "cat {{ payment_app_config_dir }}/application.yml"
      changed_when: false

# /etc/ansible/playbooks/deploy-config-global.yml
---
- name: Deploy configuration changes globally
  hosts: all
  serial: "25%"  # Rolling update: 25% of servers at a time
  
  tasks:
    - name: Apply configuration
      include_role:
        name: payment-app
      vars:
        payment_app_version: "{{ app_version | mandatory }}"
  
  post_tasks:
    - name: Health check post-deployment
      uri:
        url: "http://localhost:8080/health"
        method: GET
        status_code: 200
      retries: 10
      delay: 5
      until: result is successful

# Execution
# ansible-playbook /etc/ansible/playbooks/deploy-config-global.yml \
#   -i /etc/ansible/inventory/cmdb.yml \
#   -e "app_version=v2.2.0"
```

---

# 🎯 SCENARIO 7: SECURITY HARDENING & COMPLIANCE

## Challenge 7.1: Security Audit Revealed 500+ Compliance Violations

**Problem**:
- SSH root login enabled (should be disabled)
- Weak sudo policies
- No audit logging
- Passwords stored in plaintext
- No encryption on sensitive files

---

### Solution 7.1: Security Hardening Playbook

```yaml
# /etc/ansible/playbooks/security-hardening.yml
---
- name: Enterprise Security Hardening
  hosts: all
  become: yes
  gather_facts: yes
  
  vars:
    audit_enabled: true
    selinux_mode: enforcing
    firewall_enabled: true
  
  tasks:
    # STEP 1: SSH Hardening
    - name: Harden SSH configuration
      block:
        - name: Update sshd_config for security
          lineinfile:
            path: /etc/ssh/sshd_config
            regexp: "^{{ item.key }}"
            line: "{{ item.key }} {{ item.value }}"
            state: present
          loop:
            - { key: "PermitRootLogin", value: "no" }
            - { key: "PasswordAuthentication", value: "no" }
            - { key: "PermitEmptyPasswords", value: "no" }
            - { key: "X11Forwarding", value: "no" }
            - { key: "MaxAuthTries", value: "3" }
            - { key: "ClientAliveInterval", value: "300" }
            - { key: "AllowUsers", value: "ansible root" }
            - { key: "LogLevel", value: "VERBOSE" }
          notify: restart ssh
        
        - name: Configure SSH host key algorithms (modern only)
          lineinfile:
            path: /etc/ssh/sshd_config
            line: |
              HostKeyAlgorithms ssh-ed25519,rsa-sha2-512,rsa-sha2-256
              KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org
              Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
              MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
            state: present
          notify: restart ssh
    
    # STEP 2: Sudo Hardening
    - name: Configure sudo security
      block:
        - name: Create sudoers.d snippet for ansible user
          template:
            src: sudoers-ansible.j2
            dest: /etc/sudoers.d/ansible
            owner: root
            group: root
            mode: 0440
            validate: "visudo -cf %s"
          vars:
            sudoers_content: |
              # Ansible user sudo permissions
              Defaults:ansible !lecture, requiretty
              Defaults use_pty, log_input, log_output
              Defaults!/usr/bin/systemctl !authenticate
              ansible ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/sbin/service
        
        - name: Log all sudo usage
          template:
            src: sudoers-logging.j2
            dest: /etc/sudoers.d/logging
            owner: root
            group: root
            mode: 0440
            validate: "visudo -cf %s"
    
    # STEP 3: Firewall Configuration
    - name: Configure UFW firewall
      block:
        - name: Enable firewall
          ufw:
            state: enabled
            policy: deny
            direction: incoming
        
        - name: Allow SSH (critical!)
          ufw:
            rule: allow
            port: "22"
            proto: tcp
            state: enabled
        
        - name: Allow application ports
          ufw:
            rule: allow
            port: "{{ item }}"
            proto: tcp
            state: enabled
          loop:
            - "8080"   # Payment app
            - "9100"   # Node exporter
            - "5000"   # Ansible API
    
    # STEP 4: Audit Logging
    - name: Configure auditd (audit daemon)
      block:
        - name: Install auditd
          package:
            name: auditd
            state: present
        
        - name: Create audit rules
          template:
            src: audit.rules.j2
            dest: /etc/audit/rules.d/ansible.rules
            owner: root
            group: root
            mode: 0640
          vars:
            audit_rules: |
              # Monitor sudo
              -w /etc/sudoers -p wa -k sudoers_changes
              -w /etc/sudoers.d/ -p wa -k sudoers_changes
              
              # Monitor SSH config
              -w /etc/ssh/sshd_config -p wa -k sshd_config_changes
              
              # Monitor system calls
              -a exit,always -F arch=b64 -S execve -F uid>=1000 -F auid>=1000 -k user_commands
              
              # Monitor failed login attempts
              -w /var/log/auth.log -p wa -k auth_changes
          notify: restart auditd
        
        - name: Start and enable auditd
          systemd:
            name: auditd
            state: started
            enabled: yes
    
    # STEP 5: File Encryption
    - name: Encrypt sensitive files
      block:
        - name: Install ecryptfs
          package:
            name: ecryptfs-utils
            state: present
        
        - name: Setup encrypted home directory for sensitive services
          block:
            - name: Create encrypted directory for secrets
              shell: |
                mount -t ecryptfs /mnt/secrets /mnt/secrets
              register: ecryptfs_mount
              changed_when: "'already mounted' not in ecryptfs_mount.stderr"
        
        - name: Set file permissions on config files (no group/other read)
          file:
            path: "{{ item }}"
            owner: root
            group: root
            mode: 0600
          loop:
            - /etc/payment-app/database.yml
            - /etc/payment-app/secrets.yml
            - /root/.ssh/id_rsa
    
    # STEP 6: SELinux Configuration
    - name: Configure SELinux
      block:
        - name: Install SELinux tools
          package:
            name:
              - selinux-policy-default
              - selinux-utils
              - policycoreutils
            state: present
          when: ansible_os_family == 'RedHat'
        
        - name: Set SELinux mode to enforcing
          selinux:
            policy: targeted
            state: enforcing
          register: selinux_change
        
        - name: Reboot if SELinux mode changed
          reboot:
            msg: "SELinux mode changed, rebooting..."
            reboot_timeout: 600
          when: selinux_change.changed
    
    # STEP 7: Vulnerability Scanning
    - name: Run security vulnerability scans
      block:
        - name: Install lynis (security audit)
          package:
            name: lynis
            state: present
          when: ansible_os_family == 'Debian'
        
        - name: Run lynis audit
          shell: "lynis audit system --quiet --disable-plugin system_accounting"
          register: lynis_result
          changed_when: false
        
        - name: Check for critical vulnerabilities
          shell: |
            lynis audit system --quiet --disable-plugin system_accounting 2>&1 | \
            grep -c "Warning"
          register: warning_count
          changed_when: false
        
        - name: Alert if critical warnings found
          mail:
            host: smtp.internal
            to: security@company.com
            subject: "Security Warning on {{ inventory_hostname }}"
            body: |
              Lynis audit found {{ warning_count.stdout }} warnings
              Run: lynis audit system
          when: warning_count.stdout | int > 5
    
    # STEP 8: Patch Management
    - name: Apply security patches
      block:
        - name: Check for available updates
          apt:
            update_cache: yes
          changed_when: false
        
        - name: Install security updates only
          apt:
            upgrade: safe
          register: apt_upgrade
        
        - name: Reboot if critical kernel updates applied
          reboot:
            msg: "Security updates require reboot"
            reboot_timeout: 600
          when: apt_upgrade.changed and ansible_os_family == 'Debian'
  
  handlers:
    - name: restart ssh
      systemd:
        name: ssh
        state: restarted
        daemon_reload: yes
    
    - name: restart auditd
      systemd:
        name: auditd
        state: restarted

# Execution with compliance reporting
# ansible-playbook /etc/ansible/playbooks/security-hardening.yml \
#   -i /etc/ansible/inventory/cmdb.yml \
#   --vault-password-file=/etc/vault/password \
#   -e "compliance_report=true"
```

---

# 🎯 SCENARIO 8: DISASTER RECOVERY & BACKUP ORCHESTRATION

## Challenge 8.1: Restore 5000 Servers After Data Center Failure

**Problem**: Primary DC failed. Need to restore 5000 servers to secondary DC within 2 hours.

---

### Solution 8.1: Automated Disaster Recovery Playbook

```yaml
# /etc/ansible/playbooks/disaster-recovery.yml
---
- name: Automated Disaster Recovery - Restore to Secondary DC
  hosts: localhost
  gather_facts: yes
  
  vars:
    primary_dc: "us-east-1"
    secondary_dc: "us-west-2"
    recovery_objective: 7200  # 2 hours in seconds
    
  pre_tasks:
    - name: Initialize disaster recovery
      block:
        - name: Get time reference
          set_fact:
            recovery_start_time: "{{ ansible_date_time.epoch }}"
        
        - name: Create DR log directory
          file:
            path: /var/log/disaster-recovery
            state: directory
            mode: 0755
        
        - name: Lock primary DC from changes
          shell: |
            ansible -i /etc/ansible/inventory/cmdb.yml dc_{{ primary_dc }} \
              -m shell -a "touch /var/lock/dc-failover.lock" 2>/dev/null || true
        
        - name: Notify stakeholders
          mail:
            host: smtp.internal
            to: management@company.com,devops@company.com
            subject: "DISASTER RECOVERY: {{ primary_dc }} INITIATED"
            body: |
              Disaster recovery procedure started
              Failed DC: {{ primary_dc }}
              Recovery DC: {{ secondary_dc }}
              Time: {{ ansible_date_time.iso8601 }}
              Target RTO: {{ recovery_objective / 60 | int }} minutes
  
  tasks:
    - name: Stage 1: Assess Recovery Scope
      block:
        - name: Count servers in primary DC
          shell: "ansible -i /etc/ansible/inventory/cmdb.yml dc_{{ primary_dc }} --list-hosts | tail -1"
          register: primary_server_count
        
        - name: Count available servers in secondary DC
          shell: "ansible -i /etc/ansible/inventory/cmdb.yml dc_{{ secondary_dc }} --list-hosts | tail -1"
          register: secondary_capacity
        
        - name: Verify recovery capacity
          assert:
            that:
              - secondary_capacity.stdout | int >= primary_server_count.stdout | int
            fail_msg: |
              Insufficient capacity in {{ secondary_dc }}
              Need: {{ primary_server_count.stdout }}
              Available: {{ secondary_capacity.stdout }}
        
        - name: Log recovery scope
          copy:
            content: |
              Servers to restore: {{ primary_server_count.stdout }}
              Available capacity: {{ secondary_capacity.stdout }}
              Time: {{ ansible_date_time.iso8601 }}
            dest: /var/log/disaster-recovery/scope.log
    
    - name: Stage 2: Restore From Latest Backups
      block:
        - name: Restore database from backup
          block:
            - name: Check latest database backup
              shell: |
                ls -t /backups/database/snapshots/ | head -1
              register: latest_db_backup
            
            - name: Restore database from backup
              shell: |
                /opt/db-restore.sh \
                  --backup-file "/backups/database/snapshots/{{ latest_db_backup.stdout }}" \
                  --target-host "payment-db-secondary.internal" \
                  --verify-after-restore true
              async: 3600
              poll: 60
              register: db_restore_job
            
            - name: Verify database integrity
              shell: |
                mysql -h payment-db-secondary.internal -u devops -p{{ db_password }} \
                  -e "SELECT COUNT(*) FROM information_schema.TABLES;"
              retries: 10
              delay: 30
              until: result.rc == 0
        
        - name: Provision new servers in secondary DC
          block:
            - name: Trigger terraform apply for secondary DC
              shell: |
                cd /terraform && \
                terraform apply \
                  -var="region={{ secondary_dc }}" \
                  -var="instance_count={{ primary_server_count.stdout }}" \
                  -auto-approve
              register: terraform_apply
              async: 1800
              poll: 60
        
        - name: Configure restored servers
          include_tasks: configure-dr-servers.yml
          vars:
            target_dc: "{{ secondary_dc }}"
    
    - name: Stage 3: DNS Failover
      block:
        - name: Update DNS to point to secondary DC
          block:
            - name: Get secondary DC load balancer IP
              shell: |
                dig +short payment-api.company.com @dns-secondary.internal | head -1
              register: secondary_lb_ip
            
            - name: Update Route53 (AWS DNS)
              shell: |
                aws route53 change-resource-record-sets \
                  --hosted-zone-id "{{ route53_zone_id }}" \
                  --change-batch '{
                    "Changes": [{
                      "Action": "UPSERT",
                      "ResourceRecordSet": {
                        "Name": "payment-api.company.com",
                        "Type": "A",
                        "TTL": 60,
                        "ResourceRecords": [{"Value": "{{ secondary_lb_ip.stdout }}"}]
                      }
                    }]
                  }'
              register: dns_update
            
            - name: Wait for DNS propagation
              pause:
                seconds: 120
        
        - name: Verify DNS failover
          block:
            - name: Check DNS resolution
              shell: |
                dig +short payment-api.company.com | grep -q "{{ secondary_lb_ip.stdout }}"
              retries: 10
              delay: 10
              until: result.rc == 0
    
    - name: Stage 4: Validate Restoration
      block:
        - name: Health check on all restored servers
          uri:
            url: "http://{{ hostvars[item]['ansible_host'] }}:8080/health"
            method: GET
            status_code: 200
          loop: "{{ groups['tier_api'] }}"
          register: health_checks
          failed_when: health_checks.results | selectattr('failed', 'equalto', true) | list | length > 5
          retries: 20
          delay: 30
        
        - name: Run database integrity checks
          shell: |
            mysql -h payment-db-secondary.internal -u devops -p{{ db_password }} \
              -e "CHECKSUM TABLE payment_db.*;"
          register: checksum_result
          failed_when: "'error' in checksum_result.stdout"
        
        - name: Verify data consistency
          shell: |
            PRIMARY_COUNT=$(mysql -h payment-db-primary.internal -u devops -p{{ db_password }} \
              payment_db -e "SELECT COUNT(*) FROM transactions;" 2>/dev/null | tail -1)
            SECONDARY_COUNT=$(mysql -h payment-db-secondary.internal -u devops -p{{ db_password }} \
              payment_db -e "SELECT COUNT(*) FROM transactions;" | tail -1)
            
            if [ "$PRIMARY_COUNT" -eq "$SECONDARY_COUNT" ]; then
              echo "OK"
            else
              echo "MISMATCH: Primary=$PRIMARY_COUNT Secondary=$SECONDARY_COUNT"
              exit 1
            fi
          register: consistency_check
        
        - name: Calculate recovery metrics
          set_fact:
            recovery_time: "{{ (ansible_date_time.epoch | int) - (recovery_start_time | int) }}"
            recovery_successful: "{{ recovery_time | int < recovery_objective | int }}"
        
        - name: Send recovery completion report
          mail:
            host: smtp.internal
            to: management@company.com,devops@company.com
            subject: "✓ DISASTER RECOVERY COMPLETE"
            body: |
              Disaster Recovery Status: SUCCESS
              
              Primary DC: {{ primary_dc }} (failed)
              Recovery DC: {{ secondary_dc }}
              
              Servers Restored: {{ primary_server_count.stdout }}
              Recovery Time: {{ recovery_time }} seconds ({{ recovery_time / 60 | int }} minutes)
              Target RTO: {{ recovery_objective / 60 | int }} minutes
              Status: {{ "ON SCHEDULE" if recovery_successful else "EXCEEDED RTO" }}
              
              Database consistency: {{ consistency_check.stdout }}
              Health checks: {{ health_checks.results | selectattr('failed', 'equalto', false) | list | length }} / {{ health_checks.results | length }} passed
              
              All systems operational in {{ secondary_dc }}
  
  rescue:
    - name: Handle recovery failure
      block:
        - name: Send failure alert
          mail:
            host: smtp.internal
            to: management@company.com,devops@company.com,cto@company.com
            subject: "DISASTER RECOVERY FAILED - MANUAL INTERVENTION REQUIRED"
            body: |
              Automated disaster recovery failed
              Error: {{ ansible_failed_result.msg }}
              
              Manual intervention required immediately
              Contact: SRE on-call team
        
        - name: Generate failure report
          copy:
            content: |
              Disaster Recovery Failure Report
              ==================================
              Time: {{ ansible_date_time.iso8601 }}
              Primary DC: {{ primary_dc }}
              Error: {{ ansible_failed_result.msg }}
              
              Troubleshooting steps:
              1. Check backup integrity
              2. Verify secondary DC capacity
              3. Check database replication status
              4. Contact backup team for manual restore
            dest: /var/log/disaster-recovery/failure-{{ ansible_date_time.iso8601_basic_short }}.log
        
        - fail:
            msg: "Disaster recovery failed - manual recovery required"

# Execution - Triggered automatically on DC failure
# ansible-playbook /etc/ansible/playbooks/disaster-recovery.yml \
#   -i /etc/ansible/inventory/cmdb.yml \
#   --vault-password-file=/etc/vault/password \
#   -e "primary_dc=us-east-1" \
#   -e "secondary_dc=us-west-2"
```

---

# 🎯 SCENARIO 9: ANSIBLE TOWER / AWX - ENTERPRISE AUTOMATION

## Challenge 9.1: Implement Centralized Playbook Management & RBAC

**Problem**: Multiple teams need to run different playbooks with role-based access control.

---

### Solution 9.1: Ansible Tower Setup

```bash
# STEP 1: Install Ansible Tower (now Ansible Automation Platform)
sudo bash

# Download and install
cd /opt
wget https://releases.ansible.com/automation-platform/setup-latest.tar.gz
tar -xzf setup-latest.tar.gz
cd ansible-automation-platform-setup-x.y.z

# Configure inventory
cat > inventory << 'EOF'
[tower]
127.0.0.1 ansible_connection=local

[database]
127.0.0.1 ansible_connection=local

[all:vars]
admin_user=admin
admin_password=YourSecurePassword123!

pg_database=awx
pg_username=awx
pg_password=YourPostgresPassword456!

registry_url=quay.io
registry_username=yourusername
registry_password=yourpassword
EOF

# Run installer
bash setup.sh

# STEP 2: Create Tower projects (playbook repositories)
# Navigate to Tower UI: https://tower.internal

# Project 1: Production Deployments
curl -X POST https://tower.internal/api/v2/projects/ \
  -H "Authorization: Bearer {{ tower_token }}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Payment App Deployments",
    "description": "Production deployment playbooks",
    "scm_type": "git",
    "scm_url": "https://github.com/company/ansible-playbooks.git",
    "scm_branch": "main",
    "scm_clean": true,
    "scm_update_on_launch": true
  }'

# STEP 3: Create job templates with RBAC
cat > tower-job-template.json << 'EOF'
{
  "name": "Deploy Payment App v2.2",
  "description": "Deploy payment app to production",
  "project": "/api/v2/projects/1/",
  "playbook": "playbooks/deploy-payment-app.yml",
  "inventory": "/api/v2/inventories/1/",
  "credential": "/api/v2/credentials/1/",
  "ask_extra_vars": true,
  "extra_vars": {
    "app_version": "v2.2.0",
    "deployment_strategy": "rolling"
  },
  "limit": "prod_api_tier",
  "verbosity": 1,
  "become_enabled": true
}
EOF

curl -X POST https://tower.internal/api/v2/job_templates/ \
  -H "Authorization: Bearer {{ tower_token }}" \
  -H "Content-Type: application/json" \
  -d @tower-job-template.json

# STEP 4: Create teams and assign roles
cat > tower-rbac-setup.sh << 'EOF'
#!/bin/bash

TOWER_URL="https://tower.internal"
TOWER_TOKEN="your-api-token"

# Create DevOps team
curl -X POST $TOWER_URL/api/v2/teams/ \
  -H "Authorization: Bearer $TOWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DevOps Engineers",
    "description": "DevOps engineering team"
  }'

# Create Payment team
curl -X POST $TOWER_URL/api/v2/teams/ \
  -H "Authorization: Bearer $TOWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Payment Team",
    "description": "Payment service team"
  }'

# Grant DevOps team admin access
curl -X POST $TOWER_URL/api/v2/role_user_assignments/ \
  -H "Authorization: Bearer $TOWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "team": 1,
    "role": "admin"
  }'

# Grant Payment team read-only access to deployment job template
curl -X POST $TOWER_URL/api/v2/role_team_assignments/ \
  -H "Authorization: Bearer $TOWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "team": 2,
    "job_template": 1,
    "role": "execute"
  }'
EOF

chmod +x tower-rbac-setup.sh
./tower-rbac-setup.sh

# STEP 5: Create workflow to coordinate multiple playbooks
cat > tower-workflow.json << 'EOF'
{
  "name": "Production Release Workflow",
  "description": "Complete production release process",
  "nodes": [
    {
      "id": 1,
      "job_template": 1,
      "name": "Pre-deployment validation"
    },
    {
      "id": 2,
      "job_template": 2,
      "name": "Deploy to DC1",
      "unified_job_type": "job",
      "always_nodes": [],
      "success_nodes": [1],
      "failure_nodes": [4]
    },
    {
      "id": 3,
      "job_template": 3,
      "name": "Deploy to DC2",
      "success_nodes": [2],
      "failure_nodes": [4]
    },
    {
      "id": 4,
      "job_template": 4,
      "name": "Rollback",
      "failure_nodes": []
    }
  ]
}
EOF

# STEP 6: Set up webhooks for automated triggering
cat > tower-webhook-config.json << 'EOF'
{
  "url": "https://tower.internal/api/v2/job_templates/1/launch/",
  "method": "POST",
  "body": {
    "extra_vars": {
      "git_ref": "{{ payload.ref }}",
      "version": "{{ payload.release.tag_name }}"
    }
  }
}
EOF

# Triggered by GitHub releases:
# curl -X POST https://tower.internal/api/v2/job_templates/1/launch/ \
#   -H "Authorization: Bearer $TOWER_TOKEN" \
#   -d '{"extra_vars": {"version": "v2.2.0"}}'

# STEP 7: Set up Tower notifications
curl -X POST https://tower.internal/api/v2/notification_templates/ \
  -H "Authorization: Bearer $TOWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Slack Notifications",
    "notification_type": "slack",
    "notification_configuration": {
      "token": "xoxb-your-slack-token",
      "channels": "#devops-alerts"
    }
  }'

# STEP 8: Monitor Tower execution
# Via CLI:
tower-cli job list
tower-cli job get 42 --format json

# Via API:
curl -s https://tower.internal/api/v2/jobs/42/ \
  -H "Authorization: Bearer $TOWER_TOKEN" | jq .
```

---

# 🎯 SCENARIO 10: CONTINUOUS COMPLIANCE & AUDIT

## Challenge 10.1: Maintain Compliance Across 5000 Servers

**Problem**: CIS Benchmarks, PCI-DSS, SOC2 compliance must be maintained.

---

### Solution 10.1: Continuous Compliance Playbook

```yaml
# /etc/ansible/playbooks/compliance-check.yml
---
- name: Continuous Compliance Audit (CIS/PCI-DSS/SOC2)
  hosts: all
  gather_facts: yes
  
  vars:
    compliance_frameworks:
      - name: "CIS Linux Benchmarks"
        version: "1.1.0"
        checks:
          - id: "1.1.1"
            desc: "Ensure mounting of cramfs filesystems is disabled"
            test: "modprobe -n -v cramfs | grep 'install /bin/true'"
      
      - name: "PCI-DSS v3.2"
        version: "3.2.1"
        checks:
          - id: "2.1"
            desc: "Always change vendor-supplied defaults"
            test: "id admin || echo 'Default admin account does not exist'"
    
    compliance_report_dir: "/var/log/compliance-reports"
  
  pre_tasks:
    - name: Create compliance report directory
      file:
        path: "{{ compliance_report_dir }}"
        state: directory
        mode: 0755
  
  tasks:
    - name: CIS Benchmark Checks
      block:
        - name: 1.1 - Ensure mounting of cramfs filesystems is disabled
          shell: "modprobe -n -v cramfs 2>&1 | grep 'install /bin/true'"
          register: cis_1_1
          changed_when: false
          failed_when: false
        
        - name: 1.2 - Ensure mounting of freevxfs filesystems is disabled
          shell: "modprobe -n -v freevxfs 2>&1 | grep 'install /bin/true'"
          register: cis_1_2
          changed_when: false
          failed_when: false
        
        - name: 2.1.1 - Ensure X Window System is not installed
          shell: "dpkg -l | grep -i xserver-xorg | wc -l"
          register: cis_2_1_1
          changed_when: false
        
        - name: 2.2.4 - Ensure SSH access is limited
          shell: "grep '^AllowUsers\\|^DenyUsers\\|^AllowGroups\\|^DenyGroups' /etc/ssh/sshd_config | wc -l"
          register: cis_2_2_4
          changed_when: false
        
        - name: Compile CIS results
          set_fact:
            cis_results:
              - check: "1.1 - cramfs"
                status: "{{ 'PASS' if cis_1_1.rc == 0 else 'FAIL' }}"
              - check: "1.2 - freevxfs"
                status: "{{ 'PASS' if cis_1_2.rc == 0 else 'FAIL' }}"
              - check: "2.1.1 - X11"
                status: "{{ 'PASS' if cis_2_1_1.stdout == '0' else 'FAIL' }}"
              - check: "2.2.4 - SSH"
                status: "{{ 'PASS' if cis_2_2_4.stdout | int > 0 else 'FAIL' }}"
    
    - name: PCI-DSS Checks
      block:
        - name: PCI 2.1 - Default accounts removed
          shell: "getent passwd admin && echo 'DEFAULT_ACCOUNT_EXISTS' || echo 'OK'"
          register: pci_2_1
          changed_when: false
        
        - name: PCI 8.1.1 - User identification before access
          shell: "grep '^auth' /etc/pam.d/login | wc -l"
          register: pci_8_1_1
          changed_when: false
        
        - name: PCI 10.1 - Audit trails
          shell: "systemctl is-active auditd"
          register: pci_10_1
          changed_when: false
        
        - name: Compile PCI results
          set_fact:
            pci_results:
              - check: "2.1 - Default accounts"
                status: "{{ 'PASS' if 'OK' in pci_2_1.stdout else 'FAIL' }}"
              - check: "8.1.1 - Authentication"
                status: "{{ 'PASS' if pci_8_1_1.stdout | int > 0 else 'FAIL' }}"
              - check: "10.1 - Audit trails"
                status: "{{ 'PASS' if pci_10_1.rc == 0 else 'FAIL' }}"
    
    - name: Generate compliance report
      template:
        src: compliance-report.html.j2
        dest: "{{ compliance_report_dir }}/{{ inventory_hostname }}-compliance-{{ ansible_date_time.date }}.html"
      vars:
        report_date: "{{ ansible_date_time.iso8601 }}"
        total_checks: "{{ (cis_results | length) + (pci_results | length) }}"
        passed_checks: "{{ (cis_results | selectattr('status', 'equalto', 'PASS') | list | length) + (pci_results | selectattr('status', 'equalto', 'PASS') | list | length) }}"
        compliance_score: "{{ ((passed_checks | int / total_checks | int * 100) | int) }}%"
    
    - name: Upload compliance reports to central repository
      shell: |
        curl -X POST http://compliance-repo.internal/api/v1/reports \
          -F "file=@{{ compliance_report_dir }}/{{ inventory_hostname }}-compliance-{{ ansible_date_time.date }}.html" \
          -F "hostname={{ inventory_hostname }}" \
          -F "date={{ ansible_date_time.iso8601 }}"
      register: upload_result
    
    - name: Alert on non-compliance
      mail:
        host: smtp.internal
        to: compliance@company.com
        subject: "Non-Compliance Alert: {{ inventory_hostname }}"
        body: |
          Host: {{ inventory_hostname }}
          Compliance Score: {{ compliance_score }}
          Failed Checks: {{ total_checks | int - passed_checks | int }}
          
          CIS Failures:
          {% for check in cis_results %}
          {% if check.status == 'FAIL' %}
          - {{ check.check }}
          {% endif %}
          {% endfor %}
          
          PCI-DSS Failures:
          {% for check in pci_results %}
          {% if check.status == 'FAIL' %}
          - {{ check.check }}
          {% endif %}
          {% endfor %}
      when: compliance_score | int < 95
    
    - name: Automatic remediation of failing checks
      block:
        - name: Disable cramfs if failing
          block:
            - name: Create modprobe rule
              copy:
                content: "install cramfs /bin/true"
                dest: /etc/modprobe.d/disable_cramfs.conf
            
            - name: Remove cramfs module
              shell: "modprobe -r cramfs 2>/dev/null || true"
          
          when: cis_1_1.rc != 0
        
        - name: Enable auditd if failing
          systemd:
            name: auditd
            enabled: yes
            state: started
          when: pci_10_1.rc != 0
  
  always:
    - name: Archive compliance reports
      shell: |
        tar -czf {{ compliance_report_dir }}/archive/compliance-{{ ansible_date_time.date }}.tar.gz \
          {{ compliance_report_dir }}/*-{{ ansible_date_time.date }}.html
      ignore_errors: yes

# Execution on schedule (hourly compliance check)
# ansible-playbook /etc/ansible/playbooks/compliance-check.yml \
#   -i /etc/ansible/inventory/cmdb.yml \
#   --tags "compliance"
```

---

## 📊 QUICK REFERENCE: ANSIBLE BEST PRACTICES AT SCALE

| Pattern | Benefit | Example |
|---------|---------|---------|
| **Dynamic Inventory** | Auto-sync with infrastructure | CMDB plugin |
| **Fact Caching** | Skip repetitive fact gathering | 24-hour cache |
| **Pipelining** | Reduce SSH overhead | 40% faster execution |
| **Async Tasks** | Don't wait for each host | async: 300 poll: 0 |
| **Serial Deployment** | Prevent full outages | serial: 10% |
| **Error Handling** | Graceful failure recovery | retries, until, rescue |
| **Vault Encryption** | Secure sensitive data | ansible-vault |
| **Role-Based Tasks** | Modular, reusable code | include_role |
| **Handlers** | Event-driven restarts | notify + handlers |
| **Delegation** | Run task on different host | delegate_to |

---

## 🚀 BONUS: Advanced Ansible Patterns

### Pattern 1: Pre/Post Task Hooks

```yaml
---
- name: Deployment with Pre/Post Hooks
  hosts: all
  
  pre_tasks:
    - name: Drain from load balancer
      shell: "/opt/scripts/drain-lb.sh {{ inventory_hostname }}"
    
    - name: Wait for connections to close
      pause:
        seconds: 30
  
  tasks:
    - name: Deploy application
      shell: "/opt/scripts/deploy-app.sh"
  
  post_tasks:
    - name: Re-register with load balancer
      shell: "/opt/scripts/register-lb.sh {{ inventory_hostname }}"
    
    - name: Health check
      uri:
        url: "http://localhost:8080/health"
        status_code: 200
```

### Pattern 2: Conditional Task Execution

```yaml
---
- name: Conditional Deployments
  hosts: all
  
  tasks:
    - name: Deploy if version changed
      block:
        - name: Check current version
          shell: "cat /opt/app/.version"
          register: current_version
        
        - name: Deploy if version mismatch
          block:
            - name: Stop service
              systemd:
                name: app
                state: stopped
            
            - name: Deploy new version
              unarchive:
                src: "/builds/app-{{ desired_version }}.tar.gz"
                dest: "/opt/app"
          
          when: current_version.stdout != desired_version
```

### Pattern 3: Orchestrated Multi-Stage Deployment

```yaml
---
- name: Orchestrated Deployment
  hosts: all
  
  tasks:
    - name: Stage 1 - Prepare
      block:
        - debug: msg="Preparing..."
        - set_fact:
            stage: "prepare"
    
    - name: Stage 2 - Deploy
      block:
        - debug: msg="Deploying..."
        - set_fact:
            stage: "deploy"
      when: stage == "prepare"
    
    - name: Stage 3 - Validate
      block:
        - debug: msg="Validating..."
        - assert:
            that:
              - deployment_success
      when: stage == "deploy"
```

---

**End of Ansible Production Scenarios Document**

This comprehensive guide covers real-world Ansible automation challenges a 4-year DevOps engineer will face at enterprise scale, including inventory management, performance optimization, error handling, disaster recovery, compliance, and security automation across thousands of servers.
