# 🚀 Jenkins Deep Dive: Production Scenario for 4-Year DevOps Engineer

**Company**: TechFlow Inc. (500+ microservices, billions of transactions daily)  
**Your Role**: Senior DevOps Engineer  
**Current State**: Chaotic Jenkins setup, slow builds, frequent failures, security issues  
**Mission**: Transform Jenkins into a scalable, secure, high-performance CI/CD platform

---

## 📊 Current Jenkins Infrastructure Problems

```
Status Dashboard:
├── 10 Jenkins masters (not clustered)
├── 200+ agents (inconsistently configured)
├── 500+ jobs (no organization, naming chaos)
├── Build queue times: 15-45 minutes average
├── Pipeline failures: 30% of deployments
├── Security incidents: 2 this quarter (exposed credentials)
├── No centralized logging/monitoring
├── Infrastructure-as-Code: Zero (all manual configs)
└── Cost: $50K/month on EC2 for idle agents
```

---

# 🎯 PART 1: JENKINS ARCHITECTURE & HIGH AVAILABILITY

## Challenge 1.1: Redesign from Single-Master to High-Availability Cluster

### Current (Bad) Architecture
```
❌ Single Jenkins master on t2.large EC2
❌ If master dies → entire CI/CD is down
❌ No backup configuration
❌ Data loss risk
❌ Cannot scale without master downtime
```

### Target (Good) Architecture
```
✅ Jenkins Master HA with:
   ├── CloudBees CI (Enterprise) OR Open-source HA setup
   ├── EBS volumes for master persistence
   ├── Multi-AZ deployment
   ├── Automated backups (jobs, secrets, plugins)
   └── RTO: < 15 minutes, RPO: < 5 minutes

✅ Agent Pool Architecture:
   ├── Kubernetes-based agents (dynamic scaling)
   ├── Docker-based agent templates
   ├── GPU agents for performance testing
   ├── Static agents for critical builds
   └── Auto-scaling: 5-200 agents based on queue depth
```

### Terraform Infrastructure-as-Code (Production Grade)

**File: `jenkins-infrastructure/main.tf`**

```hcl
# ELB for Jenkins Master HA
resource "aws_elb" "jenkins_master" {
  name               = "jenkins-master-elb"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  internal           = false

  listener {
    instance_port     = 8080
    instance_protocol = "http"
    lb_port           = 80
    lb_protocol       = "http"
  }

  listener {
    instance_port      = 8080
    instance_protocol  = "https"
    lb_port            = 443
    lb_protocol        = "https"
    ssl_certificate_id = aws_acm_certificate.jenkins.arn
  }

  health_check {
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 3
    interval            = 30
    target              = "TCP:8080"
  }

  tags = {
    Name = "jenkins-master-elb"
  }
}

# EBS Volume for Jenkins persistent data
resource "aws_ebs_volume" "jenkins_home" {
  availability_zone = "us-east-1a"
  size              = 500
  type              = "gp3"
  iops              = 3000
  throughput        = 125
  encrypted         = true
  kms_key_id        = aws_kms_key.jenkins.arn

  tags = {
    Name = "jenkins-home-volume"
  }
}

# Auto Scaling Group for Jenkins Masters
resource "aws_autoscaling_group" "jenkins_master_asg" {
  name                = "jenkins-master-asg"
  vpc_zone_identifier = [aws_subnet.private_1a.id, aws_subnet.private_1b.id]
  
  min_size         = 2
  max_size         = 3
  desired_capacity = 2

  health_check_type         = "ELB"
  health_check_grace_period = 300

  launch_template {
    id      = aws_launch_template.jenkins_master.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "jenkins-master"
    propagate_launch_template = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Jenkins Master EC2 instances configuration
resource "aws_launch_template" "jenkins_master" {
  name          = "jenkins-master-launch-template"
  image_id      = data.aws_ami.ubuntu.id
  instance_type = "r5.2xlarge"  # 8 vCPU, 64 GB RAM

  block_device_mappings {
    device_name = "/dev/sda1"
    ebs {
      volume_size           = 100
      volume_type           = "gp3"
      iops                  = 3000
      throughput            = 125
      delete_on_termination = true
      encrypted             = true
    }
  }

  iam_instance_profile {
    name = aws_iam_instance_profile.jenkins_master.name
  }

  security_groups = [aws_security_group.jenkins_master.id]

  user_data = base64encode(templatefile("${path.module}/jenkins-init.sh", {
    ebs_volume_id = aws_ebs_volume.jenkins_home.id
    jenkins_url   = "https://jenkins.techflow.com"
    backup_bucket = aws_s3_bucket.jenkins_backup.id
  }))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "jenkins-master"
    }
  }
}

# Security Group
resource "aws_security_group" "jenkins_master" {
  name        = "jenkins-master-sg"
  description = "Security group for Jenkins master"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 50000
    to_port     = 50000
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]  # Agent communication
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "jenkins-master-sg"
  }
}

# IAM Role for Jenkins Master
resource "aws_iam_role" "jenkins_master" {
  name = "jenkins-master-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

# Attach policies
resource "aws_iam_role_policy" "jenkins_master" {
  name = "jenkins-master-policy"
  role = aws_iam_role.jenkins_master.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EC2DescribeInstances"
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:DescribeImages",
          "ec2:DescribeSecurityGroups",
          "ec2:AttachVolume",
          "ec2:DetachVolume",
          "ec2:CreateSnapshot"
        ]
        Resource = "*"
      },
      {
        Sid    = "S3BackupAccess"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.jenkins_backup.arn,
          "${aws_s3_bucket.jenkins_backup.arn}/*"
        ]
      },
      {
        Sid    = "EBSAccess"
        Effect = "Allow"
        Action = [
          "ebs:DescribeVolumes",
          "ec2:DescribeVolumes"
        ]
        Resource = "*"
      },
      {
        Sid    = "KMSDecrypt"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.jenkins.arn
      }
    ]
  })
}

resource "aws_iam_instance_profile" "jenkins_master" {
  name = "jenkins-master-profile"
  role = aws_iam_role.jenkins_master.name
}

# S3 Backup Bucket
resource "aws_s3_bucket" "jenkins_backup" {
  bucket = "techflow-jenkins-backup-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "jenkins-backup"
  }
}

resource "aws_s3_bucket_versioning" "jenkins_backup" {
  bucket = aws_s3_bucket.jenkins_backup.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "jenkins_backup" {
  bucket = aws_s3_bucket.jenkins_backup.id

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm     = "aws:kms"
        kms_master_key_id = aws_kms_key.jenkins.arn
      }
    }
  }
}

# KMS Key for encryption
resource "aws_kms_key" "jenkins" {
  description             = "KMS key for Jenkins encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true
}

# Outputs
output "jenkins_url" {
  value = "https://jenkins.techflow.com"
}

output "elb_dns_name" {
  value = aws_elb.jenkins_master.dns_name
}
```

**File: `jenkins-infrastructure/jenkins-init.sh`**

```bash
#!/bin/bash
set -ex

# Update system
apt-get update
apt-get install -y \
  openjdk-11-jdk \
  git \
  curl \
  wget \
  awscli \
  docker.io \
  nfs-common \
  jq

# Mount EBS volume for persistent Jenkins data
VOLUME_ID="${ebs_volume_id}"
DEVICE="/dev/xvdf"

# Wait for volume to attach
for i in {1..30}; do
  if [ -e "$DEVICE" ]; then
    break
  fi
  echo "Waiting for volume to attach..."
  sleep 2
done

# Format and mount (only if new)
if ! sudo blkid "$DEVICE" | grep -q ext4; then
  sudo mkfs.ext4 "$DEVICE"
fi

sudo mkdir -p /var/lib/jenkins
sudo mount "$DEVICE" /var/lib/jenkins
sudo chown -R jenkins:jenkins /var/lib/jenkins
sudo chmod 755 /var/lib/jenkins

# Add to fstab for persistence
echo "$DEVICE /var/lib/jenkins ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab

# Install Jenkins
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | sudo tee /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/ | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
apt-get update
apt-get install -y jenkins

# Configure Jenkins JVM for high performance
cat >> /etc/default/jenkins <<EOF
JAVA_ARGS="-Xmx48g -Xms48g \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=30 \
  -XX:+ParallelRefProcEnabled \
  -XX:+AlwaysPreTouch \
  -XX:+HeapDumpOnOutOfMemoryError \
  -XX:HeapDumpPath=/var/log/jenkins \
  -Dhudson.model.Node.SKIP_NODE_WEIGHT_CALC=true \
  -Dhudson.slaves.NodeProvisioner.MARGIN0=0.85 \
  -Dhudson.slaves.NodeProvisioner.MARGIN=0.05"
EOF

# Start Jenkins
systemctl enable jenkins
systemctl restart jenkins

# Wait for Jenkins to be ready
for i in {1..60}; do
  if curl -f http://localhost:8080/api/json > /dev/null 2>&1; then
    echo "Jenkins is ready"
    break
  fi
  echo "Waiting for Jenkins to start..."
  sleep 2
done

# Setup automated backups
cat > /opt/jenkins-backup.sh <<'BACKUP_EOF'
#!/bin/bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/lib/jenkins"
BUCKET="${backup_bucket}"

# Create tarball
tar -czf /tmp/jenkins_backup_$BACKUP_DATE.tar.gz \
  --exclude='$BACKUP_DIR/workspace' \
  --exclude='$BACKUP_DIR/builds' \
  --exclude='$BACKUP_DIR/.cache' \
  $BACKUP_DIR

# Upload to S3
aws s3 cp /tmp/jenkins_backup_$BACKUP_DATE.tar.gz \
  s3://$BUCKET/backups/ \
  --region us-east-1

# Keep only last 30 days
aws s3 rm s3://$BUCKET/backups/ \
  --recursive \
  --exclude "*" \
  --include "jenkins_backup_*.tar.gz" \
  --older-than-days 30

rm /tmp/jenkins_backup_$BACKUP_DATE.tar.gz
BACKUP_EOF

chmod +x /opt/jenkins-backup.sh

# Add daily backup cronjob
echo "0 2 * * * /opt/jenkins-backup.sh >> /var/log/jenkins-backup.log 2>&1" | crontab -

echo "Jenkins infrastructure setup complete"
```

---

## Challenge 1.2: Kubernetes-based Agent Autoscaling

### Problem
- Static agents waste resources during low traffic
- Manual scaling during peaks causes delays
- No resource isolation between jobs

### Solution: Jenkins on Kubernetes with Dynamic Agent Provisioning

**File: `jenkins-k8s/jenkins-deployment.yaml`**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: jenkins

---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: jenkins
  namespace: jenkins

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: jenkins
rules:
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["create", "delete", "get", "list", "patch", "update", "watch"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"]
  - apiGroups: [""]
    resources: ["pods/log"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods/exec"]
    verbs: ["create", "delete", "get", "list", "patch", "update", "watch"]
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["get", "list", "watch"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: jenkins
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: jenkins
subjects:
  - kind: ServiceAccount
    name: jenkins
    namespace: jenkins

---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: jenkins-storage
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
allowVolumeExpansion: true

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: jenkins-home
  namespace: jenkins
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: jenkins-storage
  resources:
    requests:
      storage: 500Gi

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: jenkins
  namespace: jenkins
spec:
  serviceName: jenkins
  replicas: 2
  selector:
    matchLabels:
      app: jenkins
  template:
    metadata:
      labels:
        app: jenkins
    spec:
      serviceAccountName: jenkins
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      
      containers:
      - name: jenkins
        image: jenkins/jenkins:2.387.3-lts-jdk11
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 50000
          name: agent
        
        env:
        - name: JAVA_OPTS
          value: >
            -Xmx4g -Xms4g
            -XX:+UseG1GC
            -XX:MaxGCPauseMillis=30
            -Dhudson.slaves.NodeProvisioner.MARGIN0=0.85
            -Dhudson.slaves.NodeProvisioner.MARGIN=0.05
        - name: CASC_JENKINS_CONFIG
          value: /var/jenkins_home/casc_configs
        
        resources:
          requests:
            cpu: "2"
            memory: "4Gi"
          limits:
            cpu: "4"
            memory: "8Gi"
        
        livenessProbe:
          httpGet:
            path: /login
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 5
        
        readinessProbe:
          httpGet:
            path: /login
            port: 8080
          initialDelaySeconds: 20
          periodSeconds: 5
          timeoutSeconds: 5
          failureThreshold: 3
        
        volumeMounts:
        - name: jenkins-home
          mountPath: /var/jenkins_home
        - name: docker-sock
          mountPath: /var/run/docker.sock
        - name: casc-config
          mountPath: /var/jenkins_home/casc_configs
      
      volumes:
      - name: docker-sock
        hostPath:
          path: /var/run/docker.sock
      - name: casc-config
        configMap:
          name: jenkins-casc-config
  
  volumeClaimTemplates:
  - metadata:
      name: jenkins-home
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: jenkins-storage
      resources:
        requests:
          storage: 500Gi

---
apiVersion: v1
kind: Service
metadata:
  name: jenkins
  namespace: jenkins
spec:
  type: LoadBalancer
  ports:
  - name: http
    port: 80
    targetPort: 8080
  - name: agent
    port: 50000
    targetPort: 50000
  selector:
    app: jenkins

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: jenkins-casc-config
  namespace: jenkins
data:
  jenkins.yaml: |
    jenkins:
      securityRealm:
        ldap:
          configurations:
            - displayNameAttributeName: "displayName"
              groupMembershipStrategy:
                fromGroupSearch:
                  groupMemberFilter: "(&(cn=*)(memberUid={0}))"
                  groupNameFilter: "(&(cn=*)(objectclass=posixGroup))"
              inhibitInferRootDN: false
              managerDN: "cn=admin,dc=techflow,dc=com"
              managerPasswordSecret: "${LDAP_MANAGER_PASS}"
              rootDN: "dc=techflow,dc=com"
              server: "ldap://ldap.techflow.com:389"
              userIdStrategy:
                caseInsensitive: true
              userSearch: "uid={0},ou=people,dc=techflow,dc=com"
      authorizationStrategy:
        projectMatrix:
          permissions:
            - "hudson.model.Item.Build:devops-team"
            - "hudson.model.Item.Cancel:devops-team"
            - "hudson.model.Item.Configure:devops-team"
            - "hudson.model.Item.Delete:devops-team"
            - "hudson.model.Item.Discover:authenticated"
            - "hudson.model.Item.Move:devops-team"
            - "hudson.model.Item.Read:authenticated"
            - "hudson.model.Run.Delete:devops-team"
            - "hudson.model.Run.Update:devops-team"
            - "hudson.model.View.Configure:devops-team"
            - "hudson.model.View.Create:devops-team"
            - "hudson.model.View.Delete:devops-team"
            - "hudson.model.View.Read:authenticated"
            - "hudson.model.Hudson.Administer:devops-team"
      remotingSecurity:
        enabled: true
      slaveAgentPort: 50000
      views:
        - all:
            name: "all"
        - list:
            columns:
              - "status"
              - "weather"
              - "job"
              - "lastSuccess"
              - "lastFailure"
              - "lastDuration"
              - "buildButtonColumn"
            includeRegex: ".*"
            name: "list"
    unclassified:
      location:
        url: "https://jenkins.techflow.com/"
      kubernetes:
        containerCap: 200
        containerCapStr: "200"
        jenkinsUrl: "http://jenkins.jenkins:8080"
        templates:
          - name: "docker-agent"
            namespace: "jenkins"
            image: "jenkins/inbound-agent:4.11.2-1"
            imagePullPolicy: "IfNotPresent"
            privileged: true
            instanceCap: 100
            instanceCapStr: "100"
            livenessProbe:
              failureThreshold: 5
              periodSeconds: 10
              timeoutSeconds: 5
            resources:
              limits:
                cpu: "2000m"
                memory: "2Gi"
              requests:
                cpu: "500m"
                memory: "512Mi"
            volumes:
              - hostPathVolume:
                  hostPath: "/var/run/docker.sock"
                  mountPath: "/var/run/docker.sock"
          - name: "performance-agent"
            namespace: "jenkins"
            image: "jenkins/inbound-agent:4.11.2-1"
            imagePullPolicy: "IfNotPresent"
            privileged: false
            instanceCap: 50
            instanceCapStr: "50"
            nodeSelector: "workload=performance"
            resources:
              limits:
                cpu: "8000m"
                memory: "16Gi"
              requests:
                cpu: "4000m"
                memory: "8Gi"
```

---

# 🔧 PART 2: ADVANCED JENKINS PIPELINES

## Challenge 2.1: Multi-Branch Pipeline with Shared Libraries

### Problem
- 500+ jobs with duplicated code
- No consistency across pipelines
- Difficult to update patterns globally

### Solution: Centralized Shared Library with Reusable Components

**File: `jenkins-shared-library/vars/buildDockerImage.groovy`**

```groovy
def call(Map config) {
    // config = [
    //   dockerfile: 'Dockerfile',
    //   context: '.',
    //   registry: 'docker.io',
    //   imageName: 'techflow/payment-service',
    //   tags: ['latest', 'v1.0.0'],
    //   platforms: ['linux/amd64', 'linux/arm64'],
    //   buildArgs: [BUILD_DATE: new Date().toString()],
    //   registryCredential: 'docker-registry'
    // ]

    def registry = config.registry ?: 'docker.io'
    def imageName = config.imageName
    def tags = config.tags ?: ['latest']
    def platforms = config.platforms ?: ['linux/amd64']
    def buildArgs = config.buildArgs ?: [:]
    def dockerfile = config.dockerfile ?: 'Dockerfile'
    def context = config.context ?: '.'

    echo "🔨 Building Docker image: ${imageName}"
    
    withCredentials([usernamePassword(
        credentialsId: config.registryCredential,
        usernameVariable: 'REGISTRY_USER',
        passwordVariable: 'REGISTRY_PASS'
    )]) {
        sh '''
            # Login to registry
            echo "$REGISTRY_PASS" | docker login -u "$REGISTRY_USER" --password-stdin ${registry}
            
            # Build image with buildkit for advanced features
            export DOCKER_BUILDKIT=1
            
            # Construct build arguments
            BUILD_ARGS=""
            ''' + buildArgs.collect { k, v -> "BUILD_ARGS=\"\\$BUILD_ARGS --build-arg ${k}=${v}\"" }.join('\n') + '''
            
            # Build for multiple platforms using buildx
            docker buildx build \
              --push \
              --platform ${platforms.join(',')} \
              --file ${dockerfile} \
              --context ${context} \
              ''' + buildArgs.collect { k, v -> "--build-arg ${k}='${v}'" }.join(' ') + ''' \
              ''' + tags.collect { "--tag ${registry}/${imageName}:${it}" }.join(' ') + ''' \
              .
            
            # Pull and verify image locally
            docker pull ${registry}/${imageName}:${tags[0]}
            
            # Scan image for vulnerabilities
            trivy image --severity HIGH,CRITICAL ${registry}/${imageName}:${tags[0]}
        '''
    }
    
    echo "✅ Docker image built successfully"
}
```

**File: `jenkins-shared-library/vars/deployToKubernetes.groovy`**

```groovy
def call(Map config) {
    // config = [
    //   cluster: 'production',
    //   namespace: 'default',
    //   deployment: 'payment-service',
    //   image: 'docker.io/techflow/payment-service:v1.0.0',
    //   replicas: 3,
    //   timeout: '10m',
    //   healthCheckRetries: 30,
    //   kubeconfig: 'kubeconfig-prod',
    //   strategy: 'rolling' // or 'canary', 'blue-green'
    // ]

    def cluster = config.cluster
    def namespace = config.namespace
    def deployment = config.deployment
    def image = config.image
    def replicas = config.replicas ?: 3
    def timeout = config.timeout ?: '10m'
    def strategy = config.strategy ?: 'rolling'

    echo "🚀 Deploying to Kubernetes cluster: ${cluster}"

    withCredentials([file(credentialsId: config.kubeconfig, variable: 'KUBECONFIG')]) {
        sh """
            set +e
            
            # Set kubeconfig
            export KUBECONFIG=$KUBECONFIG
            
            # Verify cluster connectivity
            kubectl cluster-info
            kubectl config current-context
            
            # Check namespace exists
            if ! kubectl get namespace ${namespace} &> /dev/null; then
                echo "Creating namespace: ${namespace}"
                kubectl create namespace ${namespace}
            fi
            
            # Apply deployment configuration
            kubectl set image deployment/${deployment} \
              ${deployment}=${image} \
              -n ${namespace} \
              --record
            
            # Trigger rollout
            kubectl rollout status deployment/${deployment} \
              -n ${namespace} \
              --timeout=${timeout}
            
            ROLLOUT_STATUS=$?
            
            if [ $ROLLOUT_STATUS -ne 0 ]; then
                echo "❌ Deployment failed, rolling back..."
                kubectl rollout undo deployment/${deployment} \
                  -n ${namespace}
                exit 1
            fi
            
            # Verify deployment health
            kubectl get deployment ${deployment} -n ${namespace} -o wide
            kubectl get pods -n ${namespace} -l app=${deployment}
            
            # Port-forward and verify service health
            kubectl port-forward -n ${namespace} svc/${deployment} 8080:8080 &
            PORT_FORWARD_PID=$!
            sleep 2
            
            HEALTH_CHECK_RETRIES=${config.healthCheckRetries ?: 30}
            for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
                if curl -f http://localhost:8080/health &> /dev/null; then
                    echo "✅ Service is healthy"
                    kill $PORT_FORWARD_PID
                    exit 0
                fi
                echo "Health check attempt $i/$HEALTH_CHECK_RETRIES"
                sleep 2
            done
            
            kill $PORT_FORWARD_PID
            echo "❌ Service health check failed"
            exit 1
        """
    }

    echo "✅ Deployment to Kubernetes complete"
}
```

**File: `jenkins-shared-library/vars/runSecurityScans.groovy`**

```groovy
def call(Map config) {
    // config = [
    //   scanTypes: ['sast', 'dast', 'dependency', 'container'],
    //   artifactPath: 'build/artifacts',
    //   reportPath: 'build/security-reports',
    //   failOnHighSeverity: true
    // ]

    def scanTypes = config.scanTypes ?: ['sast', 'dependency']
    def artifactPath = config.artifactPath ?: '.'
    def reportPath = config.reportPath ?: 'security-reports'
    def failOnHighSeverity = config.failOnHighSeverity ?: true

    echo "🔒 Running security scans: ${scanTypes}"

    sh """
        mkdir -p ${reportPath}
        CRITICAL_FOUND=0
        
        # SAST: Static Application Security Testing (SonarQube)
        if [[ "${scanTypes}" == *"sast"* ]]; then
            echo "Running SonarQube SAST..."
            sonar-scanner \
              -Dsonar.projectKey=techflow-payment \
              -Dsonar.sources=src \
              -Dsonar.host.url=https://sonarqube.techflow.com \
              -Dsonar.login=${SONARQUBE_TOKEN}
        fi
        
        # Dependency Scanning
        if [[ "${scanTypes}" == *"dependency"* ]]; then
            echo "Running Dependency Check..."
            dependency-check.sh \
              --project "Payment Service" \
              --scan ${artifactPath} \
              --format JSON \
              --out ${reportPath}/dependency-check-report.json \
              --fail CVSS 7
            
            if [ \$? -ne 0 ]; then
                CRITICAL_FOUND=1
            fi
        fi
        
        # Container Image Scanning
        if [[ "${scanTypes}" == *"container"* ]]; then
            echo "Running Trivy container scan..."
            trivy image \
              --severity HIGH,CRITICAL \
              --format json \
              --output ${reportPath}/trivy-report.json \
              docker.io/techflow/payment-service:latest
            
            CRITICAL_COUNT=\$(jq '[.Results[].Vulnerabilities[] | select(.Severity=="CRITICAL")] | length' ${reportPath}/trivy-report.json)
            if [ \$CRITICAL_COUNT -gt 0 ]; then
                CRITICAL_FOUND=1
            fi
        fi
        
        # DAST: Dynamic Application Security Testing
        if [[ "${scanTypes}" == *"dast"* ]]; then
            echo "Running ZAP DAST..."
            docker run --rm \
              -v \$(pwd)/${reportPath}:/zap/wrk \
              owasp/zap2docker-stable \
              zap-baseline.py \
              -t http://app-under-test:8080 \
              -r /zap/wrk/zap-report.html
        fi
        
        if [ \$CRITICAL_FOUND -eq 1 ] && [ "${failOnHighSeverity}" == "true" ]; then
            echo "❌ Critical vulnerabilities found"
            exit 1
        fi
        
        echo "✅ Security scans complete"
    """

    publishHTML([
        reportDir: reportPath,
        reportFiles: '*.html',
        reportName: 'Security Scan Reports'
    ])
}
```

**File: `jenkins-shared-library/vars/notifyStakeholders.groovy`**

```groovy
def call(Map config) {
    // config = [
    //   status: 'SUCCESS/FAILURE',
    //   channels: ['slack', 'email', 'teams'],
    //   recipients: ['devops-team@techflow.com'],
    //   slackChannel: '#deployments',
    //   buildDetails: ['version': 'v1.0.0', 'environment': 'prod']
    // ]

    def status = config.status
    def channels = config.channels ?: ['slack', 'email']
    def recipients = config.recipients ?: []
    def slackChannel = config.slackChannel
    def buildDetails = config.buildDetails ?: [:]

    def color = status == 'SUCCESS' ? 'good' : 'danger'
    def emoji = status == 'SUCCESS' ? '✅' : '❌'
    def message = """
        ${emoji} Build ${status}
        Job: ${env.JOB_NAME}
        Build: #${env.BUILD_NUMBER}
        Duration: ${currentBuild.durationString}
        User: ${env.BUILD_USER ?: 'automation'}
        Details: ${buildDetails.collectEntries { k, v -> ["$k": "$v"] }}
    """

    if (channels.contains('slack')) {
        slackSend(
            channel: slackChannel,
            color: color,
            message: message,
            webhookUrl: env.SLACK_WEBHOOK_URL
        )
    }

    if (channels.contains('email')) {
        emailext(
            subject: "[${status}] ${env.JOB_NAME} #${env.BUILD_NUMBER}",
            body: message,
            to: recipients.join(','),
            mimeType: 'text/plain'
        )
    }

    if (channels.contains('teams')) {
        office365ConnectorSend(
            webhookUrl: env.TEAMS_WEBHOOK_URL,
            color: color,
            status: status,
            summary: "Build ${status}: ${env.JOB_NAME}",
            details: buildDetails
        )
    }
}
```

### Multi-Branch Declarative Pipeline Using Shared Library

**File: `Jenkinsfile` (in application repository)**

```groovy
@Library('techflow-jenkins-library') _

pipeline {
    agent {
        kubernetes {
            yaml '''
                apiVersion: v1
                kind: Pod
                metadata:
                  labels:
                    jenkins: agent
                spec:
                  serviceAccountName: jenkins
                  containers:
                  - name: docker
                    image: docker:20.10-dind
                    securityContext:
                      privileged: true
                    volumeMounts:
                    - name: docker-sock
                      mountPath: /var/run/docker.sock
                  - name: kubectl
                    image: bitnami/kubectl:1.26
                    command:
                    - cat
                    tty: true
                  - name: gradle
                    image: gradle:7.6-jdk11
                    command:
                    - cat
                    tty: true
                  volumes:
                  - name: docker-sock
                    hostPath:
                      path: /var/run/docker.sock
            '''
        }
    }

    environment {
        REGISTRY = 'docker.io'
        REGISTRY_CREDENTIAL = 'docker-registry-creds'
        SONARQUBE_TOKEN = credentials('sonarqube-token')
        KUBECONFIG_PROD = credentials('kubeconfig-prod')
        KUBECONFIG_STAGING = credentials('kubeconfig-staging')
        SLACK_CHANNEL = '#deployments'
        SLACK_WEBHOOK_URL = credentials('slack-webhook-url')
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '50'))
        disableConcurrentBuilds()
        timeout(time: 1, unit: 'HOURS')
        timestamps()
        ansiColor('xterm')
    }

    parameters {
        choice(name: 'DEPLOYMENT_ENV', choices: ['staging', 'production'], description: 'Target environment')
        booleanParam(name: 'SKIP_TESTS', defaultValue: false, description: 'Skip unit tests')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
                    env.GIT_BRANCH_NAME = sh(script: "git rev-parse --abbrev-ref HEAD", returnStdout: true).trim()
                    env.GIT_COMMIT_MSG = sh(script: "git log --format=%B -n 1", returnStdout: true).trim()
                }
            }
        }

        stage('Build') {
            steps {
                container('gradle') {
                    script {
                        echo "🔨 Building application..."
                        sh '''
                            gradle clean build \
                              -Pbuild.version=${BUILD_NUMBER} \
                              -Pbuild.revision=${GIT_COMMIT_SHORT} \
                              --scan
                        '''
                    }
                }
            }
        }

        stage('Unit Tests') {
            when {
                expression { params.SKIP_TESTS == false }
            }
            steps {
                container('gradle') {
                    script {
                        echo "🧪 Running unit tests..."
                        sh '''
                            gradle test \
                              --no-build-cache \
                              --max-workers=4
                        '''
                    }
                }
            }
            post {
                always {
                    junit 'build/test-results/**/*.xml'
                    jacoco(
                        execFilePattern: 'build/jacoco/*.exec',
                        classPattern: 'build/classes',
                        sourcePattern: 'src/main/java'
                    )
                }
            }
        }

        stage('Code Quality') {
            parallel {
                stage('SonarQube Analysis') {
                    steps {
                        container('gradle') {
                            script {
                                echo "🔍 Running SonarQube analysis..."
                                sh '''
                                    gradle sonarqube \
                                      -Dsonar.projectKey=techflow-payment-service \
                                      -Dsonar.host.url=https://sonarqube.techflow.com \
                                      -Dsonar.login=${SONARQUBE_TOKEN}
                                '''
                            }
                        }
                    }
                }
                stage('SAST/Dependency Scan') {
                    steps {
                        script {
                            runSecurityScans(
                                scanTypes: ['sast', 'dependency'],
                                artifactPath: 'build/artifacts',
                                reportPath: 'build/security-reports',
                                failOnHighSeverity: true
                            )
                        }
                    }
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                container('docker') {
                    script {
                        def imageName = 'techflow/payment-service'
                        def imageTag = "${env.BUILD_NUMBER}-${env.GIT_COMMIT_SHORT}"
                        def latestTag = 'latest'
                        
                        if (env.BRANCH_NAME == 'main') {
                            latestTag = 'main-latest'
                        } else if (env.BRANCH_NAME.startsWith('release/')) {
                            latestTag = env.BRANCH_NAME.replaceAll('release/', '')
                        }
                        
                        echo "🐳 Building Docker image..."
                        buildDockerImage(
                            dockerfile: 'Dockerfile',
                            context: '.',
                            registry: REGISTRY,
                            imageName: imageName,
                            tags: [imageTag, latestTag],
                            platforms: ['linux/amd64', 'linux/arm64'],
                            buildArgs: [
                                'BUILD_DATE': new Date().toString(),
                                'VCS_REF': env.GIT_COMMIT,
                                'BUILD_ID': env.BUILD_NUMBER
                            ],
                            registryCredential: REGISTRY_CREDENTIAL
                        )
                        
                        env.DOCKER_IMAGE = "${REGISTRY}/${imageName}:${imageTag}"
                    }
                }
            }
        }

        stage('Container Security Scan') {
            steps {
                script {
                    echo "🔒 Scanning container image for vulnerabilities..."
                    sh '''
                        trivy image \
                          --severity CRITICAL,HIGH \
                          --format json \
                          --output build/trivy-report.json \
                          ${DOCKER_IMAGE}
                        
                        # Fail if critical vulnerabilities found
                        CRITICAL=$(jq '[.Results[].Vulnerabilities[] | select(.Severity=="CRITICAL")] | length' build/trivy-report.json)
                        if [ $CRITICAL -gt 0 ]; then
                            echo "❌ Found $CRITICAL critical vulnerabilities"
                            exit 1
                        fi
                    '''
                }
            }
        }

        stage('Deploy to Staging') {
            when {
                branch 'develop'
            }
            steps {
                container('kubectl') {
                    script {
                        echo "🚀 Deploying to staging..."
                        deployToKubernetes(
                            cluster: 'staging',
                            namespace: 'default',
                            deployment: 'payment-service',
                            image: env.DOCKER_IMAGE,
                            replicas: 2,
                            timeout: '10m',
                            kubeconfig: 'kubeconfig-staging'
                        )
                    }
                }
            }
        }

        stage('Integration Tests (Staging)') {
            when {
                branch 'develop'
            }
            steps {
                container('docker') {
                    script {
                        echo "🧪 Running integration tests..."
                        sh '''
                            docker run --rm \
                              --network host \
                              -e TEST_API_URL=http://payment-service.default:8080 \
                              techflow/integration-tests:latest \
                              pytest tests/integration/ -v --junit-xml=test-results.xml
                        '''
                    }
                }
            }
            post {
                always {
                    junit 'test-results.xml'
                }
            }
        }

        stage('Approval for Production') {
            when {
                branch 'main'
                expression {
                    return currentBuild.result == null || currentBuild.result == 'SUCCESS'
                }
            }
            steps {
                script {
                    def userInput = input(
                        id: 'ProductionDeployment',
                        message: 'Deploy to production?',
                        parameters: [
                            booleanParam(defaultValue: false, description: 'Confirm production deployment', name: 'PROCEED'),
                            choice(name: 'DEPLOYMENT_STRATEGY', choices: ['rolling', 'canary', 'blue-green'], description: 'Deployment strategy')
                        ]
                    )
                    
                    env.DEPLOYMENT_STRATEGY = userInput.DEPLOYMENT_STRATEGY
                }
            }
        }

        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                container('kubectl') {
                    script {
                        echo "🚀 Deploying to production..."
                        deployToKubernetes(
                            cluster: 'production',
                            namespace: 'default',
                            deployment: 'payment-service',
                            image: env.DOCKER_IMAGE,
                            replicas: 5,
                            timeout: '15m',
                            strategy: env.DEPLOYMENT_STRATEGY ?: 'rolling',
                            kubeconfig: 'kubeconfig-prod'
                        )
                    }
                }
            }
        }

        stage('Production Health Check') {
            when {
                branch 'main'
            }
            steps {
                container('docker') {
                    script {
                        echo "🏥 Running production health checks..."
                        sh '''
                            # Monitor metrics
                            kubectl port-forward -n default svc/payment-service 9090:9090 &
                            PORT_FWD_PID=$!
                            sleep 2
                            
                            # Check error rate
                            ERROR_RATE=$(curl -s http://localhost:9090/metrics | grep 'http_requests_total{status="5' | awk '{print $2}')
                            if [ -z "$ERROR_RATE" ] || [ $(echo "$ERROR_RATE < 1" | bc) -eq 1 ]; then
                                echo "✅ Error rate is acceptable"
                            else
                                echo "❌ High error rate detected"
                                kill $PORT_FWD_PID
                                exit 1
                            fi
                            
                            kill $PORT_FWD_PID
                        '''
                    }
                }
            }
        }
    }

    post {
        always {
            script {
                def buildStatus = currentBuild.result ?: 'UNKNOWN'
                notifyStakeholders(
                    status: buildStatus,
                    channels: ['slack', 'email'],
                    slackChannel: env.SLACK_CHANNEL,
                    recipients: ['devops-team@techflow.com'],
                    buildDetails: [
                        'Environment': params.DEPLOYMENT_ENV ?: 'N/A',
                        'Git Commit': env.GIT_COMMIT_SHORT,
                        'Branch': env.BRANCH_NAME,
                        'Docker Image': env.DOCKER_IMAGE ?: 'Not built'
                    ]
                )
            }
        }
        failure {
            script {
                echo "❌ Pipeline failed"
                // Trigger incident response
                sh '''
                    curl -X POST https://incidents.techflow.com/api/incidents \
                      -H "Content-Type: application/json" \
                      -d '{
                        "title": "Jenkins Pipeline Failure: '${JOB_NAME}' #'${BUILD_NUMBER}'",
                        "description": "Build failed. Check logs: '${BUILD_URL}'",
                        "severity": "high"
                      }'
                '''
            }
        }
        success {
            script {
                echo "✅ Pipeline completed successfully"
            }
        }
        cleanup {
            cleanWs()
        }
    }
}
```

---

# 🔐 PART 3: JENKINS SECURITY HARDENING

## Challenge 3.1: Credential Management & Secret Rotation

### Problem
- Credentials stored in plain text
- No secret rotation policy
- Developers have direct access to production credentials

### Solution: Vault Integration with HashiCorp Vault

**File: `jenkins-security/vault-jenkins-integration.groovy`**

```groovy
import com.datapipe.jenkins.vault.configuration.GlobalVaultConfiguration
import com.datapipe.jenkins.vault.configuration.VaultConfiguration

pipeline {
    agent any

    environment {
        VAULT_ADDR = 'https://vault.techflow.com:8200'
        VAULT_NAMESPACE = 'jenkins'
    }

    stages {
        stage('Retrieve Secrets from Vault') {
            steps {
                script {
                    // Use Jenkins Vault plugin to retrieve secrets
                    withVault([
                        configuration: [
                            timeout: 60,
                            vaultCredentialId: 'vault-approle',
                            engineVersion: 2,
                            vaultUrl: env.VAULT_ADDR,
                            vaultNamespace: env.VAULT_NAMESPACE,
                            prefixPath: 'secret/data'
                        ],
                        vaultSecrets: [
                            [path: 'secret/data/aws/prod', secretValues: [
                                [envVar: 'AWS_ACCESS_KEY_ID', key: 'access_key'],
                                [envVar: 'AWS_SECRET_ACCESS_KEY', key: 'secret_key']
                            ]],
                            [path: 'secret/data/database/prod', secretValues: [
                                [envVar: 'DB_HOST', key: 'host'],
                                [envVar: 'DB_USER', key: 'username'],
                                [envVar: 'DB_PASS', key: 'password']
                            ]],
                            [path: 'secret/data/docker/registry', secretValues: [
                                [envVar: 'DOCKER_USERNAME', key: 'username'],
                                [envVar: 'DOCKER_PASSWORD', key: 'password']
                            ]]
                        ]
                    ]) {
                        echo "✅ Secrets retrieved from Vault"
                        
                        // Use secrets in build
                        sh '''
                            echo "Logging into Docker registry..."
                            echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin
                            
                            echo "Running deployment..."
                            AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
                            AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
                            DB_HOST=$DB_HOST \
                            DB_USER=$DB_USER \
                            DB_PASS=$DB_PASS \
                            ./deploy.sh
                        '''
                    }
                }
            }
        }

        stage('Secret Rotation Audit') {
            steps {
                script {
                    sh '''
                        echo "Checking secret age..."
                        CREATED_DATE=$(vault kv metadata get -format=json secret/aws/prod | jq -r '.metadata.created_time')
                        DAYS_OLD=$(( ($(date +%s) - $(date -d "$CREATED_DATE" +%s)) / 86400 ))
                        
                        if [ $DAYS_OLD -gt 90 ]; then
                            echo "⚠️ Secret is older than 90 days, rotation needed"
                            # Trigger secret rotation workflow
                            curl -X POST https://vault.techflow.com/api/secret-rotation/rotate \
                              -H "X-Vault-Token: $VAULT_TOKEN" \
                              -H "Content-Type: application/json" \
                              -d '{"path": "secret/aws/prod"}'
                        fi
                    '''
                }
            }
        }
    }
}
```

### Vault Configuration for Secret Rotation

**File: `vault-config/secret-rotation-policy.hcl`**

```hcl
# Vault policy for Jenkins AppRole
path "secret/data/aws/*" {
  capabilities = ["read", "list"]
}

path "secret/data/database/*" {
  capabilities = ["read", "list"]
}

path "secret/data/docker/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/*" {
  capabilities = ["read", "list"]
}

# JWT auth for service-to-service communication
path "auth/jwt/login" {
  capabilities = ["create", "read"]
}

# Database secret engine for dynamic database credentials
path "database/static-creds/jenkins-db-user" {
  capabilities = ["read"]
}

path "database/rotate-root/jenkins-db" {
  capabilities = ["update"]
}
```

**File: `vault-config/aws-secret-rotation.hcl`**

```hcl
path "aws/rotate-root/production" {
  capabilities = ["update"]
}

path "aws/config/root" {
  capabilities = ["update"]
}

path "aws/static-creds/jenkins-user" {
  capabilities = ["read"]
}
```

---

## Challenge 3.2: Jenkins Security Configuration & Hardening

### File: `jenkins-casc/jenkins-security.yaml`**

```yaml
jenkins:
  securityRealm:
    saml:
      binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      displayNameAttributeName: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
      groupsAttributeName: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/groups"
      idpMetadataConfiguration:
        url: "https://idp.techflow.com/metadata.xml"
      idpSso: "https://idp.techflow.com/sso"
      logoutUrl: "https://idp.techflow.com/logout"
      spMetadataConfiguration:
        forceAuthn: true
  
  authorizationStrategy:
    projectMatrix:
      permissions:
        # Admin permissions
        - "hudson.model.Hudson.Administer:devops-admins"
        
        # Developer permissions
        - "hudson.model.Item.Build:developers"
        - "hudson.model.Item.Cancel:developers"
        - "hudson.model.Item.Discover:developers"
        - "hudson.model.Item.Read:developers"
        - "hudson.model.Run.Delete:developers"
        - "hudson.model.Run.Update:developers"
        
        # Read-only permissions
        - "hudson.model.Item.Discover:all"
        - "hudson.model.Item.Read:all"
        
        # Anonymous restricted
        - "hudson.model.View.Create:authenticated"
        - "hudson.model.View.Delete:authenticated"
        - "hudson.model.View.Read:all"

  remotingSecurity:
    enabled: true
    
  crumbIssuer:
    standard:
      excludeClientIPFromCrumb: false

  slaveAgentPort: 50000
  
  disableRememberMe: false
  
  # CSRF Protection
  csrf:
    issueTokenOnGet: false
    proxyCompatibility: false

unclassified:
  # SSL/TLS Configuration
  sslContext:
    keyStore: "/var/lib/jenkins/keystore.jks"
    keyStorePassword: "${JENKINS_KEYSTORE_PASS}"

  # Audit logging
  auditlog:
    enabled: true
    logBuildCause: true
    logJobConfiguration: true

  # Security event logging
  securityEventLog:
    enabled: true

  # Session timeout
  sessionTimeout:
    sessionTimeout: 30

  # Disable deprecated features
  disabledAdministrativeMonitors:
    - "hudson.security.SecurityRealm$BadSignatureMonitor"

  # API token settings
  apiTokenProperty:
    creationOfLegacyTokenEnabled: false

credentials:
  system:
    domainCredentials:
      - credentials:
          - jenkins:
              scope: GLOBAL
              id: "vault-approle"
              description: "Vault AppRole credentials"
              username: "${VAULT_ROLE_ID}"
              password: "${VAULT_SECRET_ID}"
          
          - ssh:
              scope: GLOBAL
              id: "github-deploy-key"
              description: "GitHub SSH deploy key"
              username: "git"
              privateKeySource:
                directEntry:
                  privateKey: "${GITHUB_PRIVATE_KEY}"
          
          - vaultString:
              scope: GLOBAL
              id: "slack-webhook-url"
              description: "Slack webhook for notifications"
              secret: "${SLACK_WEBHOOK_URL}"
```

---

## Challenge 3.3: Jenkins Agent Security

**File: `jenkins-security/agent-security-config.groovy`**

```groovy
// Groovy script to configure agent security

Jenkins jenkins = Jenkins.getInstance()

// Agent-to-master security
jenkins.setSlaveAgentPort(50000)

// Enable remoting security
jenkins.remotingSecurity = new HudsonPrivateSecurityRealm(false)

// Configure SSH key-pair authentication for agents
def agents = hudson.model.Hudson.getInstance().getComputer("")
agents.each { computer ->
    if (computer instanceof hudson.slaves.SlaveComputer) {
        def launcher = computer.launcher
        
        // Ensure only SSH key-based authentication
        if (launcher instanceof hudson.plugins.sshslaves.SSHLauncher) {
            launcher.credentialsId = "agent-ssh-key"
            launcher.javaPath = "/usr/lib/jvm/java-11-openjdk-amd64/bin/java"
            
            // Security: Verify host key
            launcher.hostKeyVerificationStrategy = 
                new hudson.plugins.sshslaves.verifiers.KnownHostsFileKeyVerificationStrategy()
            
            computer.launcher = launcher
        }
    }
}

jenkins.save()
println "✅ Agent security configured"
```

---

# 📊 PART 4: JENKINS PERFORMANCE TUNING & MONITORING

## Challenge 4.1: Pipeline Performance Optimization

### Problem
- Pipeline takes 45 minutes to complete
- No parallel execution
- Bottlenecks not identified

### Solution: Advanced Parallel Execution & Optimization

**File: `Jenkinsfile-Optimized`**

```groovy
@Library('techflow-jenkins-library') _

pipeline {
    agent none

    options {
        buildDiscarder(logRotator(numToKeepStr: '50'))
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
    }

    stages {
        stage('Parallel Quality Gates') {
            parallel {
                stage('Unit Tests') {
                    agent {
                        kubernetes {
                            yaml '''
                                apiVersion: v1
                                kind: Pod
                                spec:
                                  containers:
                                  - name: gradle
                                    image: gradle:7.6-jdk11
                                    command: ['cat']
                                    tty: true
                                    resources:
                                      requests:
                                        memory: "2Gi"
                                        cpu: "2"
                                      limits:
                                        memory: "4Gi"
                                        cpu: "4"
                            '''
                        }
                    }
                    steps {
                        container('gradle') {
                            sh 'gradle test --parallel --max-workers=4'
                        }
                    }
                }

                stage('Code Quality') {
                    agent {
                        kubernetes {
                            yaml '''
                                apiVersion: v1
                                kind: Pod
                                spec:
                                  containers:
                                  - name: sonar
                                    image: sonarsource/sonar-scanner-cli:latest
                            '''
                        }
                    }
                    steps {
                        container('sonar') {
                            sh '''
                                sonar-scanner \
                                  -Dsonar.projectKey=payment-service \
                                  -Dsonar.sources=src/main
                            '''
                        }
                    }
                }

                stage('Dependency Check') {
                    agent {
                        kubernetes {
                            yaml '''
                                apiVersion: v1
                                kind: Pod
                                spec:
                                  containers:
                                  - name: dependency-check
                                    image: owasp/dependency-check:latest
                            '''
                        }
                    }
                    steps {
                        container('dependency-check') {
                            sh '''
                                dependency-check.sh \
                                  --scan . \
                                  --format JSON \
                                  --project "Payment Service"
                            '''
                        }
                    }
                }

                stage('Lint & Format Check') {
                    agent {
                        kubernetes {
                            yaml '''
                                apiVersion: v1
                                kind: Pod
                                spec:
                                  containers:
                                  - name: lint
                                    image: node:18-alpine
                            '''
                        }
                    }
                    steps {
                        container('lint') {
                            sh '''
                                npm install
                                npm run lint
                                npm run format:check
                            '''
                        }
                    }
                }
            }
        }

        stage('Build Artifacts') {
            agent {
                kubernetes {
                    yaml '''
                        apiVersion: v1
                        kind: Pod
                        spec:
                          containers:
                          - name: builder
                            image: gradle:7.6-jdk11
                            resources:
                              requests:
                                memory: "4Gi"
                                cpu: "4"
                              limits:
                                memory: "8Gi"
                                cpu: "8"
                    '''
                }
            }
            steps {
                container('builder') {
                    sh '''
                        gradle build -x test \
                          --parallel \
                          --build-cache \
                          --max-workers=8
                    '''
                }
            }
        }

        stage('Parallel Docker Builds') {
            parallel {
                stage('Build Service Image') {
                    agent {
                        kubernetes {
                            yaml '''
                                apiVersion: v1
                                kind: Pod
                                spec:
                                  containers:
                                  - name: docker
                                    image: docker:20.10-dind
                                    securityContext:
                                      privileged: true
                            '''
                        }
                    }
                    steps {
                        container('docker') {
                            sh '''
                                docker buildx build \
                                  --push \
                                  --platform linux/amd64,linux/arm64 \
                                  --tag docker.io/techflow/payment-service:latest \
                                  .
                            '''
                        }
                    }
                }

                stage('Build Test Image') {
                    agent {
                        kubernetes {
                            yaml '''
                                apiVersion: v1
                                kind: Pod
                                spec:
                                  containers:
                                  - name: docker
                                    image: docker:20.10-dind
                                    securityContext:
                                      privileged: true
                            '''
                        }
                    }
                    steps {
                        container('docker') {
                            sh '''
                                docker buildx build \
                                  --push \
                                  --platform linux/amd64 \
                                  --file Dockerfile.test \
                                  --tag docker.io/techflow/payment-service-test:latest \
                                  .
                            '''
                        }
                    }
                }
            }
        }

        stage('Deploy & Test Parallel') {
            parallel {
                stage('Deploy Staging') {
                    agent {
                        kubernetes {
                            yaml '''
                                apiVersion: v1
                                kind: Pod
                                spec:
                                  containers:
                                  - name: kubectl
                                    image: bitnami/kubectl:1.26
                            '''
                        }
                    }
                    steps {
                        container('kubectl') {
                            sh '''
                                kubectl apply -f k8s-staging/ -n staging
                                kubectl rollout status deployment/payment-service -n staging
                            '''
                        }
                    }
                }

                stage('Run Performance Tests') {
                    agent {
                        kubernetes {
                            yaml '''
                                apiVersion: v1
                                kind: Pod
                                metadata:
                                  labels:
                                    workload: performance
                                spec:
                                  containers:
                                  - name: jmeter
                                    image: justb4/jmeter:latest
                                    resources:
                                      requests:
                                        memory: "4Gi"
                                        cpu: "4"
                                      limits:
                                        memory: "8Gi"
                                        cpu: "8"
                            '''
                        }
                    }
                    steps {
                        container('jmeter') {
                            sh '''
                                jmeter -n -t tests/performance/payment-api.jmx \
                                  -l results/performance.jtl \
                                  -j results/jmeter.log \
                                  -Jthreads=100 \
                                  -Jrampup=60 \
                                  -Jduration=300
                            '''
                        }
                    }
                }

                stage('Run Security Tests') {
                    agent {
                        kubernetes {
                            yaml '''
                                apiVersion: v1
                                kind: Pod
                                spec:
                                  containers:
                                  - name: zap
                                    image: owasp/zap2docker-stable:latest
                            '''
                        }
                    }
                    steps {
                        container('zap') {
                            sh '''
                                zap-baseline.py \
                                  -t http://payment-service-staging:8080 \
                                  -r zap-report.html
                            '''
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            sh '''
                # Collect metrics and logs
                kubectl logs -n jenkins deployment/jenkins --tail=1000 > jenkins-logs.txt
                docker stats --no-stream > docker-stats.txt
            '''
        }
    }
}
```

---

## Challenge 4.2: Jenkins Monitoring & Observability

### File: `jenkins-monitoring/prometheus-config.yaml`**

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'jenkins-master'
    static_configs:
      - targets: ['jenkins-master:8080']
    metrics_path: '/metrics'
    bearer_token: '${JENKINS_API_TOKEN}'
    scrape_interval: 30s

  - job_name: 'jenkins-agents'
    consul_sd_configs:
      - server: 'consul.service.consul:8500'
        services: ['jenkins-agent']
    relabel_configs:
      - source_labels: [__meta_consul_node]
        target_label: instance

  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: keep
        regex: jenkins

alert_rules_files:
  - '/etc/prometheus/rules/*.yml'
```

### File: `jenkins-monitoring/alerts.yml`**

```yaml
groups:
  - name: jenkins_alerts
    interval: 30s
    rules:
      - alert: JenkinsMasterDown
        expr: up{job="jenkins-master"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Jenkins Master is DOWN"
          description: "Jenkins master {{ $labels.instance }} has been down for more than 2 minutes"

      - alert: JenkinsBuildQueueHighe
        expr: rate(jenkins_queue_size[5m]) > 50
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Jenkins build queue is HIGH"
          description: "Jenkins has {{ $value }} builds queued"

      - alert: JenkinsJobFailureRate
        expr: rate(jenkins_jobs_failed_total[5m]) > 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Jenkins job failure rate is HIGH"
          description: "Failure rate: {{ $value | humanizePercentage }}"

      - alert: JenkinsAgentOffline
        expr: jenkins_executor_free_total == 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "All Jenkins agents are busy"
          description: "No free executors available on {{ $labels.instance }}"

      - alert: JenkinsDiskSpaceLow
        expr: jenkins_node_disk_free_bytes < 10737418240  # 10GB
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Jenkins disk space is LOW"
          description: "Only {{ $value | humanize }}B free on {{ $labels.instance }}"

      - alert: JenkinsMemoryUsageHigh
        expr: jenkins_jvm_memory_used_bytes / jenkins_jvm_memory_max_bytes > 0.85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Jenkins memory usage is HIGH"
          description: "Memory usage: {{ $value | humanizePercentage }}"
```

### File: `jenkins-monitoring/grafana-dashboard.json`**

```json
{
  "dashboard": {
    "title": "Jenkins CI/CD Monitoring",
    "panels": [
      {
        "title": "Build Success Rate",
        "targets": [
          {
            "expr": "rate(jenkins_jobs_success_total[5m]) / (rate(jenkins_jobs_success_total[5m]) + rate(jenkins_jobs_failed_total[5m]))"
          }
        ],
        "type": "gauge"
      },
      {
        "title": "Average Build Duration",
        "targets": [
          {
            "expr": "rate(jenkins_job_duration_seconds_sum[5m]) / rate(jenkins_job_duration_seconds_count[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Queue Wait Time",
        "targets": [
          {
            "expr": "rate(jenkins_queue_wait_seconds_sum[5m]) / rate(jenkins_queue_wait_seconds_count[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Agent Availability",
        "targets": [
          {
            "expr": "jenkins_executor_free_total / jenkins_executor_total"
          }
        ],
        "type": "heatmap"
      },
      {
        "title": "Jenkins JVM Metrics",
        "targets": [
          {
            "expr": "jenkins_jvm_memory_used_bytes",
            "legendFormat": "Memory Used"
          },
          {
            "expr": "jenkins_jvm_gc_count_total",
            "legendFormat": "GC Count"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

---

# 🚨 PART 5: REAL-WORLD TROUBLESHOOTING SCENARIOS

## Challenge 5.1: Production Pipeline Failure - Root Cause Analysis

### Scenario: Payment Service Pipeline Fails 3x During Business Hours

```
Timeline:
09:15 - Jenkins job "deploy-payment-service" fails
09:16 - Retry fails with same error
09:17 - Production team reports payment processing is slow
09:20 - You get paged
```

### Troubleshooting Playbook

**Step 1: Collect Evidence**

```bash
#!/bin/bash
# troubleshoot-pipeline-failure.sh

BUILD_ID=$1
JOB_NAME="deploy-payment-service"

echo "📊 Collecting evidence for build #$BUILD_ID..."

# 1. Jenkins build logs
echo "=== Jenkins Build Logs ==="
curl -s "https://jenkins.techflow.com/job/${JOB_NAME}/${BUILD_ID}/consoleText" > build-logs.txt
head -100 build-logs.txt

# 2. Check Jenkins master health
echo "=== Jenkins Master Health ==="
curl -s "https://jenkins.techflow.com/api/json" | jq '.queue | length'

# 3. Agent status
echo "=== Agent Status ==="
curl -s "https://jenkins.techflow.com/api/json" | jq '.computer[] | {name, offline}'

# 4. Docker pull failures (common issue)
echo "=== Docker Registry Issues ==="
docker pull docker.io/techflow/payment-service:latest 2>&1 | tail -50

# 5. Kubernetes deployment status
echo "=== Kubernetes Deployment Status ==="
kubectl describe deployment payment-service -n default
kubectl get events -n default --sort-by='.lastTimestamp' | tail -20

# 6. Application logs
echo "=== Application Error Logs ==="
kubectl logs -n default deployment/payment-service --tail=200 | grep -i error

# 7. Metrics: Check if previous deployment is healthy
echo "=== Deployment Metrics ==="
kubectl top nodes
kubectl top pods -n default

# 8. Jenkins plugin list (may have incompatibilities)
echo "=== Jenkins Plugins ==="
curl -s "https://jenkins.techflow.com/pluginManager/api/json?tree=plugins[*]" | jq

# 9. Check recent Git commits
echo "=== Recent Commits ==="
git log --oneline -10

# 10. Network connectivity to registry
echo "=== Network Diagnostics ==="
nc -zv docker.io 443
nc -zv registry-1.docker.io 443
```

**Step 2: Analyze & Identify Root Cause**

```groovy
// analyze-failure.groovy
// Jenkins script console

import hudson.model.Run
import hudson.model.Result
import java.text.SimpleDateFormat

def job = Jenkins.instance.getItem("deploy-payment-service")
def recentBuilds = job.builds.take(10)

println "=== Recent Build Analysis ==="
recentBuilds.each { run ->
    println """
    Build #${run.number}:
      Status: ${run.result}
      Duration: ${run.durationString}
      Started: ${new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(run.startTime.time)}
      Caused by: ${run.cause}
    """
}

// Check for common failure patterns
def failedBuilds = recentBuilds.findAll { it.result == Result.FAILURE }
if (failedBuilds.size() > 2) {
    println "⚠️ Multiple consecutive failures detected"
}

// Analyze build log
def latestBuild = job.lastBuild
def logText = latestBuild.log

if (logText.contains("docker pull")) {
    println "🔴 Docker registry connectivity issue"
} else if (logText.contains("rollout status")) {
    println "🔴 Kubernetes rollout timeout"
} else if (logText.contains("health check")) {
    println "🔴 Application health check failure"
} else if (logText.contains("SonarQube")) {
    println "🔴 Code quality gate failure"
}
```

**Common Failure Scenarios & Fixes:**

| Issue | Symptoms | Fix |
|-------|----------|-----|
| Docker Registry Timeout | `docker pull` hangs for 5+ minutes | Check registry health, increase timeout in Jenkins config |
| Agent OOM | `Java.lang.OutOfMemoryError` | Increase agent JVM heap, add more agents |
| Kubernetes API Rate Limit | `429: Too Many Requests` | Configure exponential backoff, reduce polling frequency |
| Secret Rotation In Progress | `Authentication failed` | Re-sync Vault, rotate credentials |
| Network Connectivity | `Connection refused` | Check VPC security groups, DNS resolution |
| Database Migration Lock | Deployment hangs at `Apply migrations` | Kill blocking queries in database |

---

## Challenge 5.2: Jenkins Master High CPU/Memory Usage

### Symptoms
- Jenkins dashboard becomes unresponsive
- Jobs queue up indefinitely
- CPU at 90%+, Memory at 95%+

### Diagnosis & Resolution

**File: `jenkins-health-check.groovy`**

```groovy
import java.lang.management.ManagementFactory
import java.lang.management.MemoryUsage

// Jenkins Script Console Diagnostic

println "=== Jenkins Health Diagnostics ==="

// 1. JVM Memory Analysis
def runtime = Runtime.getRuntime()
def maxMemory = runtime.maxMemory() / (1024 * 1024)
def totalMemory = runtime.totalMemory() / (1024 * 1024)
def freeMemory = runtime.freeMemory() / (1024 * 1024)
def usedMemory = totalMemory - freeMemory

println """
JVM Memory Status:
  Max: ${maxMemory}MB
  Allocated: ${totalMemory}MB
  Used: ${usedMemory}MB (${(usedMemory/totalMemory*100).toInteger()}%)
  Free: ${freeMemory}MB
"""

if (usedMemory / totalMemory > 0.85) {
    println "⚠️ WARNING: Memory usage above 85%, consider restarting"
}

// 2. Executor Analysis
def jenkins = Jenkins.getInstance()
def totalExecutors = jenkins.numExecutors
def busyExecutors = jenkins.getComputer("").countBusy()
def queueSize = jenkins.queue.items.size()

println """
Executor Status:
  Total: ${totalExecutors}
  Busy: ${busyExecutors}
  Queue: ${queueSize} jobs waiting
"""

// 3. Active Job Analysis
println "\nTop 10 Active Jobs by Duration:"
def activeJobs = []
jenkins.allItems.each { item ->
    if (item.isBuilding()) {
        def duration = System.currentTimeMillis() - item.getLastBuild().getStartTime().getTime()
        activeJobs.add([name: item.name, duration: duration])
    }
}

activeJobs.sort { -it.duration }.take(10).each { job ->
    println "  ${job.name}: ${(job.duration/1000).toInteger()}s"
}

// 4. Plugin Issues
println "\nTop 10 Slowest Plugins (load time):"
jenkins.pluginManager.plugins.sort { -it.load_time }.take(10).each { plugin ->
    println "  ${plugin.displayName}: ${plugin.load_time}ms"
}

// 5. Disk I/O (builds directory)
def buildsDir = new File(jenkins.getRootDir(), "builds")
def totalSize = buildsDir.listFiles().sum { it.directorySize() } / (1024*1024)
println "\nBuilds Directory: ${totalSize}MB"

// 6. Recommendations
println "\n=== Recommendations ==="
if (usedMemory / totalMemory > 0.85) {
    println "1. ⚠️ Increase JVM heap (-Xmx flag)"
}
if (queueSize > 100) {
    println "2. 📈 Scale up agents"
}
if (busyExecutors / totalExecutors > 0.9) {
    println "3. 🔧 Add more executors"
}
println "4. 🗑️  Consider archiving old builds"
```

**Preventive Maintenance Script:**

```groovy
@Grab('commons-io:commons-io:2.11.0')

import org.apache.commons.io.FileUtils
import hudson.model.Job

// Auto-cleanup old builds
def jenkins = Jenkins.getInstance()
def maxBuildAge = 90 * 24 * 60 * 60 * 1000  // 90 days in milliseconds
def currentTime = System.currentTimeMillis()
def deletedCount = 0
def freedSpace = 0

jenkins.allItems(Job.class).each { job ->
    job.builds.each { run ->
        def buildAge = currentTime - run.startTime.time.time
        if (buildAge > maxBuildAge && run.number < job.lastSuccessfulBuild?.number) {
            def buildDir = run.rootDir
            def buildSize = FileUtils.sizeOfDirectory(buildDir)
            
            run.delete()
            deletedCount++
            freedSpace += buildSize
        }
    }
}

println "✅ Cleanup Complete:"
println "   Builds Deleted: ${deletedCount}"
println "   Space Freed: ${freedSpace / (1024*1024)}MB"
```

---

# ✅ PART 6: PRODUCTION INCIDENT RESPONSE

## Challenge 6.1: Jenkins-Related Incident Runbook

**File: `runbooks/jenkins-pipeline-failure-runbook.md`**

```markdown
# Jenkins Pipeline Failure Incident Runbook

## SEV-1: Production Deployment Blocked

### Initial Assessment (5 min)
- [ ] Check Jenkins master status: `curl https://jenkins.techflow.com/api/json`
- [ ] Check agent availability: `kubectl get nodes -o wide`
- [ ] Check build queue size: `curl https://jenkins.techflow.com/queue/api/json | jq '.items | length'`
- [ ] Check recent build logs for error patterns

### Common Causes & Fixes

#### 1. Docker Registry Unreachable
```bash
# Test registry connectivity
docker pull docker.io/techflow/payment-service:latest --dry-run

# If failed, check DNS
nslookup registry-1.docker.io

# Fix: Update agents' Docker daemon settings
cat > /etc/docker/daemon.json <<EOF
{
  "registry-mirrors": [
    "https://docker.techflow.internal.mirror"
  ]
}
EOF
systemctl restart docker
```

#### 2. Kubernetes API Rate Limited
```bash
# Check API server health
kubectl cluster-info
kubectl api-resources

# Reduce polling frequency in Jenkins
# Configure exponential backoff in shared libraries
```

#### 3. Out of Memory on Agent
```bash
# Check agent memory
kubectl top nodes

# Restart agent and increase heap
kubectl delete pod jenkins-agent-xxx
# Pod will be recreated with more memory
```

### Escalation Path
- 5 min: Page Jenkins SRE
- 10 min: Page platform team lead
- 15 min: Page VP Engineering if production impact

### Communication Template
```
🚨 INCIDENT: Jenkins Deploy Pipeline Blocked

Impact: Production deployments are blocked
Severity: SEV-1
Duration: 12 minutes
RCA: Docker registry rate-limited (500 pull/hr quota)

Mitigation:
- Queued builds paused
- Upgrading Docker registry mirror
- Expected resolution: 15 min

Next Update: 09:45 UTC
```
```

---

# 🏆 FINAL PRODUCTION CHECKLIST

```yaml
Jenkins Production Readiness Checklist:

1. HIGH AVAILABILITY:
   ✅ Multi-master setup with load balancing
   ✅ EBS volumes with encryption
   ✅ Automated backups (daily, 30-day retention)
   ✅ RTO < 15 minutes, RPO < 5 minutes

2. SECURITY:
   ✅ RBAC configured (SAML/LDAP integration)
   ✅ Secrets managed via Vault
   ✅ Secret rotation policy (90 days)
   ✅ Disabled deprecated protocols (TLS 1.2+)
   ✅ Agent-to-master security enabled
   ✅ CSR F protection enabled
   ✅ API token rotation enforced

3. PERFORMANCE:
   ✅ Auto-scaling agents (5-200 based on load)
   ✅ Kubernetes pod resources limited
   ✅ Build cache enabled
   ✅ Average build time: < 15 minutes
   ✅ Pipeline parallelization: > 50%

4. MONITORING & ALERTING:
   ✅ Prometheus scraping Jenkins metrics
   ✅ Grafana dashboards for visibility
   ✅ Alerts: Master down, High queue, Low agents, Memory critical
   ✅ Build logs centralized (ELK/Splunk)
   ✅ Audit logging enabled

5. DISASTER RECOVERY:
   ✅ DR site with latest backup
   ✅ Failover tested monthly
   ✅ Configuration-as-Code version controlled
   ✅ Job definitions in Git (JCasC)

6. COMPLIANCE:
   ✅ SOC2 compliance verified
   ✅ Audit logs retention: 1 year
   ✅ Access logs encrypted
   ✅ Credentials never logged

7. DOCUMENTATION:
   ✅ Runbooks for common issues
   ✅ Architecture diagrams
   ✅ Disaster recovery procedures
   ✅ Security hardening guide
```

---

## Summary: Expected Outcomes After Implementation

| Metric | Before | After |
|--------|--------|-------|
| Build Success Rate | 70% | 99.5% |
| Average Pipeline Duration | 45 min | 15 min |
| Pipeline Parallelization | 0% | 80%+ |
| Security Vulnerabilities | 47 (CRITICAL: 8) | 0 CRITICAL |
| RTO (Master Failure) | 4 hours | 15 minutes |
| Cost/Build | $2.50 | $0.30 |
| Agent Utilization | 35% | 85% |
| On-call Incidents/Month | 15 | 2 |

---

## 📚 Resources & References

- **Jenkins Documentation**: https://docs.jenkins.io
- **HashiCorp Vault**: https://www.vaultproject.io/docs
- **Kubernetes Jenkins Plugin**: https://plugins.jenkins.io/kubernetes/
- **Jenkins Configuration-as-Code**: https://plugins.jenkins.io/configuration-as-code/
- **Prometheus Monitoring**: https://prometheus.io/docs
- **OWASP Security Best Practices**: https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/

---

**Last Updated**: 2024 | **Version**: 1.0 | **Status**: Ready for Production
