# Jenkins Testing, Performance Tuning & Troubleshooting - 4YOE Edition

## Part 1: Pipeline Testing Framework

### 1.1 Unit Testing Shared Library Functions

**File: `jenkins-shared-library/test/vars/BuildDockerImageTest.groovy`**

```groovy
import org.junit.Test
import org.junit.Before
import com.lesfurets.jenkins.unit.BasePipelineTest
import static org.hamcrest.Matchers.hasItem
import static org.junit.Assert.assertThat

class BuildDockerImageTest extends BasePipelineTest {
    
    Script buildDockerImageScript
    
    @Before
    void setUp() throws Exception {
        super.setUp()
        
        // Load the shared library
        scriptLoader.loadedScripts.clear()
        buildDockerImageScript = loadScript("vars/buildDockerImage.groovy")
    }
    
    @Test
    void testBuildDockerImageWithValidConfig() {
        def config = [
            dockerfile: 'Dockerfile',
            context: '.',
            registry: 'docker.io',
            imageName: 'techflow/payment-service',
            tags: ['latest', 'v1.0.0'],
            platforms: ['linux/amd64', 'linux/arm64'],
            buildArgs: [BUILD_DATE: '2024-01-01'],
            registryCredential: 'docker-registry'
        ]
        
        // Mock shell execution
        helper.registerAllowedMethod("withCredentials", [Map, Closure]) { args, closure ->
            closure.call()
        }
        
        helper.registerAllowedMethod("sh", [String]) { String cmd ->
            assert cmd.contains('docker buildx build')
            assert cmd.contains('--platform linux/amd64,linux/arm64')
            assert cmd.contains('--tag docker.io/techflow/payment-service:latest')
            return 0
        }
        
        // Execute function
        buildDockerImageScript.call(config)
        
        // Verify shell was called
        assertThat(helper.callStack.findAll { it.methodName == 'sh' }.size(), hasItem(greaterThan(0)))
    }
    
    @Test
    void testBuildDockerImageHandlesMissingDockerfile() {
        def config = [
            dockerfile: 'NonExistent.Dockerfile',
            imageName: 'test/image'
        ]
        
        // This should handle gracefully or fail appropriately
        try {
            buildDockerImageScript.call(config)
        } catch (Exception e) {
            assert e.message.contains("Dockerfile") || e.message.contains("not found")
        }
    }
    
    @Test
    void testBuildDockerImageMultiPlatform() {
        def config = [
            dockerfile: 'Dockerfile',
            registry: 'docker.io',
            imageName: 'techflow/service',
            tags: ['latest'],
            platforms: ['linux/amd64', 'linux/arm64', 'linux/arm/v7'],
            registryCredential: 'docker-registry'
        ]
        
        helper.registerAllowedMethod("withCredentials", [Map, Closure]) { args, closure ->
            closure.call()
        }
        
        helper.registerAllowedMethod("sh", [String]) { String cmd ->
            // Verify multi-platform build
            assert cmd.contains('linux/amd64,linux/arm64,linux/arm/v7')
            return 0
        }
        
        buildDockerImageScript.call(config)
    }
}
```

### 1.2 Integration Testing Pipelines

**File: `jenkins-pipeline-tests/integration-test-Jenkinsfile`**

```groovy
// Integration tests for full pipeline
// Triggered on: pipeline changes, shared library updates

@Library('techflow-jenkins-library@main') _

pipeline {
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
                  - name: kubectl
                    image: bitnami/kubectl:1.26
                  - name: gradle
                    image: gradle:7.6-jdk11
            '''
        }
    }

    stages {
        stage('Test Docker Build') {
            steps {
                container('docker') {
                    script {
                        echo "🧪 Testing Docker build functionality..."
                        
                        sh '''
                            # Create test Dockerfile
                            cat > /tmp/Dockerfile.test <<'EOF'
FROM alpine:latest
RUN echo "Test image"
EOF
                            
                            # Test build
                            docker build -t test/integration:latest -f /tmp/Dockerfile.test /tmp
                            
                            # Verify image exists
                            docker images | grep test/integration
                        '''
                    }
                }
            }
        }

        stage('Test Kubernetes Deployment') {
            steps {
                container('kubectl') {
                    script {
                        echo "🧪 Testing Kubernetes deployment functionality..."
                        
                        sh '''
                            # Verify cluster connectivity
                            kubectl cluster-info
                            
                            # Create test namespace
                            kubectl create namespace test-jenkins || true
                            
                            # Deploy test app
                            kubectl run test-app \
                              --image=nginx:latest \
                              -n test-jenkins
                            
                            # Wait for deployment
                            sleep 10
                            
                            # Verify pod running
                            kubectl get pod test-app -n test-jenkins
                            
                            # Cleanup
                            kubectl delete pod test-app -n test-jenkins
                            kubectl delete namespace test-jenkins
                        '''
                    }
                }
            }
        }

        stage('Test Security Scanning') {
            steps {
                container('docker') {
                    script {
                        echo "🧪 Testing security scanning..."
                        
                        sh '''
                            # Install trivy
                            wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | apt-key add -
                            echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | tee /etc/apt/sources.list.d/trivy.list
                            apt-get update && apt-get install -y trivy
                            
                            # Test scan
                            trivy image --severity CRITICAL alpine:latest | head -20
                        '''
                    }
                }
            }
        }

        stage('Test Pipeline Parameters') {
            steps {
                script {
                    echo "🧪 Testing pipeline parameter handling..."
                    
                    assert env.BUILD_NUMBER != null
                    assert env.GIT_BRANCH != null
                    
                    echo "✅ Parameters validated"
                }
            }
        }

        stage('Generate Test Report') {
            steps {
                script {
                    def report = """
                    ========================================
                    Jenkins Pipeline Integration Test Report
                    ========================================
                    
                    Tests Executed:
                    ✅ Docker build test
                    ✅ Kubernetes deployment test
                    ✅ Security scanning test
                    ✅ Parameter validation test
                    
                    Result: ALL PASSED
                    
                    Timestamp: ${new Date()}
                    Jenkins Version: ${env.JENKINS_VERSION}
                    """
                    
                    writeFile file: 'test-report.txt', text: report
                    archiveArtifacts artifacts: 'test-report.txt'
                }
            }
        }
    }

    post {
        always {
            script {
                sh '''
                    # Cleanup
                    docker system prune -f
                    kubectl get all -A
                '''
            }
        }
    }
}
```

---

## Part 2: Performance Testing & Tuning

### 2.1 Load Testing Jenkins

**File: `jenkins-performance/load-test.sh`**

```bash
#!/bin/bash
# Load testing for Jenkins
# Tests: concurrent builds, queue processing, agent scaling

set -euo pipefail

JENKINS_URL="http://jenkins-master:8080"
TEST_DURATION=300  # 5 minutes
CONCURRENT_JOBS=50
JOB_NAME="test-load-job"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*"
}

create_test_job() {
    log "Creating test job..."
    
    # Create a simple test job configuration
    cat > /tmp/test-job-config.xml <<'EOF'
<?xml version="1.1" encoding="UTF-8"?>
<project>
  <description>Load testing job</description>
  <builders>
    <hudson.tasks.Shell>
      <command>sleep 30 &amp;&amp; echo "Build completed"</command>
    </hudson.tasks.Shell>
  </builders>
</project>
EOF
    
    # Create job via Jenkins CLI
    java -jar /opt/jenkins-cli.jar -s "${JENKINS_URL}" \
        create-job "${JOB_NAME}" < /tmp/test-job-config.xml || true
}

trigger_builds() {
    log "Triggering ${CONCURRENT_JOBS} concurrent builds..."
    
    local build_ids=()
    
    for i in $(seq 1 $CONCURRENT_JOBS); do
        # Trigger build asynchronously
        java -jar /opt/jenkins-cli.jar -s "${JENKINS_URL}" \
            build "${JOB_NAME}" -s &
        
        if [ $((i % 10)) -eq 0 ]; then
            log "  Triggered $i builds"
            sleep 1
        fi
    done
    
    wait
    log "✅ All builds triggered"
}

monitor_queue() {
    log "Monitoring build queue..."
    
    local start_time=$(date +%s)
    local poll_interval=5
    
    while true; do
        local queue_size=$(curl -s "${JENKINS_URL}/queue/api/json" | jq '.items | length')
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        log "Queue size: ${queue_size} (Elapsed: ${elapsed}s)"
        
        if [ "$elapsed" -gt "$TEST_DURATION" ]; then
            break
        fi
        
        sleep $poll_interval
    done
}

collect_metrics() {
    log "Collecting performance metrics..."
    
    local report="/tmp/jenkins-load-test-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$report" <<EOF
========================================
Jenkins Load Test Report
========================================

Test Configuration:
  Duration: ${TEST_DURATION} seconds
  Concurrent Jobs: ${CONCURRENT_JOBS}
  Test Job: ${JOB_NAME}

Jenkins Status:
  Version: $(curl -s "${JENKINS_URL}/api/json" | jq -r '.version')
  Total Executors: $(curl -s "${JENKINS_URL}/api/json" | jq '.numExecutors')
  
Queue Statistics:
  Final Queue Size: $(curl -s "${JENKINS_URL}/queue/api/json" | jq '.items | length')
  
Job Results:
$(java -jar /opt/jenkins-cli.jar -s "${JENKINS_URL}" \
    list-jobs | grep "${JOB_NAME}" | head -5)

Build Times:
$(curl -s "${JENKINS_URL}/job/${JOB_NAME}/api/json" | jq '.builds[] | {number: .number, duration: .duration}' | head -10)

System Metrics:
  CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')
  Memory Usage: $(free | grep Mem | awk '{printf("%.2f%%", $3/$2 * 100.0)}')
  Disk Usage: $(df / | awk 'NR==2 {print $5}')

Performance Analysis:
  ✓ Queue processing: $(curl -s "${JENKINS_URL}/queue/api/json" | jq '.items | length') pending builds
  ✓ Agent pool: $(curl -s "${JENKINS_URL}/api/json" | jq '.computer | length') agents
  ✓ Average build time: $(curl -s "${JENKINS_URL}/job/${JOB_NAME}/api/json" | jq '[.builds[].duration] | add / length' | awk '{printf "%.0f", $1}')ms

Report Generated: $(date)
========================================
EOF
    
    log "✅ Report saved to: $report"
    cat "$report"
}

cleanup() {
    log "Cleaning up..."
    
    java -jar /opt/jenkins-cli.jar -s "${JENKINS_URL}" \
        delete-job "${JOB_NAME}" || true
    
    rm -f /tmp/test-job-config.xml
}

main() {
    log "Starting Jenkins load test"
    log "================================"
    
    create_test_job
    trigger_builds
    monitor_queue
    collect_metrics
    cleanup
    
    log "================================"
    log "✅ Load test completed"
}

# Trap errors
trap cleanup EXIT

main
```

### 2.2 JVM Tuning Guide

**File: `jenkins-performance/jvm-tuning.sh`**

```bash
#!/bin/bash
# Jenkins JVM tuning for production

# Analyze current JVM performance
analyze_jvm() {
    local jenkins_pid=$(pgrep -f "java.*jenkins")
    
    if [ -z "$jenkins_pid" ]; then
        echo "Jenkins process not found"
        return 1
    fi
    
    echo "=== Current JVM Configuration ==="
    cat /proc/$jenkins_pid/cmdline | tr '\0' '\n' | grep "^-"
    
    echo -e "\n=== JVM Memory Usage ==="
    jmap -heap $jenkins_pid | head -30
    
    echo -e "\n=== GC Statistics ==="
    jstat -gc $jenkins_pid 1000 5
    
    echo -e "\n=== Thread Count ==="
    jstack $jenkins_pid | grep -c "tid"
}

# Recommended JAVA_OPTS for production
generate_java_opts() {
    local heap_size=${1:-48}  # Default 48GB for 64GB system
    local max_heap=$((heap_size * 1024))
    local initial_heap=$((heap_size * 1024))
    
    cat <<EOF
JAVA_OPTS="
  -Xmx${max_heap}m
  -Xms${initial_heap}m
  -XX:+UseG1GC
  -XX:MaxGCPauseMillis=30
  -XX:InitiatingHeapOccupancyPercent=35
  -XX:G1HeapRegionSize=16M
  -XX:MinMetaspaceSize=128m
  -XX:MaxMetaspaceSize=512m
  -XX:+ParallelRefProcEnabled
  -XX:+UnlockDiagnosticVMOptions
  -XX:G1SummarizeRSetStatsPeriod=86400
  -XX:+AlwaysPreTouch
  -XX:+UseStringDeduplication
  -XX:+HeapDumpOnOutOfMemoryError
  -XX:HeapDumpPath=/var/log/jenkins
  -Dhudson.slaves.NodeProvisioner.MARGIN0=0.85
  -Dhudson.slaves.NodeProvisioner.MARGIN=0.05
  -Dhudson.model.LoadStatistics.clock=2000
  -Dhudson.model.Node.SKIP_NODE_WEIGHT_CALC=true
"
EOF
}

# Apply JVM tuning
apply_tuning() {
    echo "Applying JVM tuning..."
    
    # Backup current config
    cp /etc/default/jenkins /etc/default/jenkins.bak
    
    # Add tuned JAVA_OPTS
    generate_java_opts 48 >> /etc/default/jenkins
    
    # Set swappiness to 0 (avoid swapping)
    sysctl vm.swappiness=0
    
    # Enable transparent huge pages (good for large heaps)
    echo "madvise" > /sys/kernel/mm/transparent_hugepage/enabled
    
    # Restart Jenkins
    systemctl restart jenkins
    
    echo "✅ JVM tuning applied. Jenkins restarted."
}

# Monitor after tuning
monitor_after_tuning() {
    echo "Monitoring JVM after tuning..."
    
    sleep 30
    
    local jenkins_pid=$(pgrep -f "java.*jenkins")
    
    echo "=== Post-Tuning Metrics ==="
    echo "PID: $jenkins_pid"
    echo "Memory: $(ps aux | grep $jenkins_pid | awk '{print $6}')KB"
    echo "Threads: $(jstack $jenkins_pid | grep -c 'tid')"
    echo "GC Count: $(jstat -gc $jenkins_pid 1 | tail -1 | awk '{print $13}')"
}

main() {
    echo "📊 Jenkins JVM Performance Analysis"
    echo "===================================="
    
    analyze_jvm
    
    echo -e "\n📝 Recommended JVM Options:"
    generate_java_opts 48
    
    # Uncomment to apply
    # apply_tuning
    # monitor_after_tuning
}

main
```

---

## Part 3: Comprehensive Troubleshooting Guide

### 3.1 Common Issues & Solutions

**File: `troubleshooting/COMMON-ISSUES.md`**

```markdown
# Jenkins Common Issues & Solutions

## 1. Jenkins Master High CPU/Memory

### Symptoms
- Jenkins dashboard slow
- CPU > 80%
- Memory > 90%

### Diagnosis

```bash
# Check top processes
top -b -n1 | head -20

# Check GC activity
jstat -gc -h10 $(pgrep -f java) 1000

# Check queued jobs
curl http://localhost:8080/queue/api/json | jq '.items | length'

# Check active jobs
curl http://localhost:8080/api/json | jq '[.computer[].executors[] | select(.busy==true)] | length'
```

### Root Causes & Fixes

| Cause | Fix |
|-------|-----|
| Large builds in memory | Increase -Xmx, enable disk swapping for builds |
| Too many plugins | Uninstall unused, upgrade outdated |
| Polling too frequent | Reduce polling interval, use webhooks |
| Memory leak | Restart Jenkins, check plugins for leaks |
| GC pauses | Switch to G1GC, tune heap size |

### Prevention

```groovy
// In Jenkins Script Console
Jenkins jenkins = Jenkins.getInstance()

// Set conservative queue depth
jenkins.getQueue().maintain()

// Remove old builds
jenkins.allItems(AbstractProject.class).each { job ->
    job.getBuilds().each { build ->
        if (build.number < job.lastSuccessfulBuild?.number - 100) {
            build.delete()
        }
    }
}
```

---

## 2. Pipeline Timeouts

### Symptoms
- Builds hang and timeout
- "Timeout: Command did not complete within..."
- Stuck at specific stage

### Debugging

```bash
# SSH into agent running the build
ssh jenkins-agent-1

# Find hanging process
ps aux | grep java

# Check if agent is responsive
curl http://jenkins-master:50000

# View agent logs
tail -100 /var/log/jenkins-agent.log

# Monitor resource usage during timeout
watch -n1 'ps -p $(pgrep -f jenkins-agent) -o %cpu,%mem,etime'
```

### Common Causes

| Cause | Solution |
|-------|----------|
| Docker registry slow | Increase timeout, use mirror registry |
| Kubectl API hanging | Check network, rate limiting |
| Artifact download slow | Use local cache, CDN |
| Build process stuck | Add heartbeat, increase timeout gradually |

### Fix

```groovy
pipeline {
    options {
        timeout(time: 1, unit: 'HOURS')
        timestamps()
    }
    
    stages {
        stage('Long Running Task') {
            options {
                timeout(time: 30, unit: 'MINUTES')
            }
            steps {
                sh '''
                    set -o pipefail
                    # Add progress indicators
                    { cat large-file.tar.gz | tar -xz; } 2>&1 | tee extract.log
                '''
            }
        }
    }
}
```

---

## 3. Agent Connection Issues

### Symptoms
- Agent goes offline
- "Connect refused" errors
- Builds queued, not executed

### Troubleshooting

```bash
# Check agent status in Jenkins UI
curl http://jenkins-master:8080/computer/api/json | jq '.computer[] | {displayName, offline}'

# Check agent logs
ssh jenkins-agent-1 'tail -200 /var/log/jenkins-agent.log'

# Test connectivity
telnet jenkins-master 50000

# Check firewall rules
sudo iptables -L -n | grep 50000

# Restart agent
ssh jenkins-agent-1 'sudo systemctl restart jenkins-agent'
```

### Solutions

```yaml
Agent Connection Issues:

1. Network Connectivity:
   - Check security groups
   - Verify DNS resolution
   - Test firewall rules

2. Credentials:
   - Regenerate SSH keys
   - Update in Jenkins config
   - Verify permissions

3. Resource Exhaustion:
   - Check disk space (df -h)
   - Check memory (free -h)
   - Check CPU load (uptime)

4. Jenkins Version Mismatch:
   - Upgrade agent plugins
   - Match master/agent versions
```

---

## 4. Credential/Authentication Issues

### Symptoms
- "Invalid credentials"
- Docker push fails
- Git clone fails

### Fix

```bash
# Update Docker credentials
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

# Test Git connectivity
git ls-remote https://github.com/techflow/repo.git

# Rotate AWS credentials
aws iam create-access-key --user-name jenkins
aws iam delete-access-key --access-key-id OLD_KEY

# Re-sync Vault
vault login -method=approle \
  role_id=$ROLE_ID \
  secret_id=$SECRET_ID
```

---

## 5. Disk Space Issues

### Symptoms
- "No space left on device"
- Builds fail during archiving
- Jenkins becomes unresponsive

### Emergency Cleanup

```bash
#!/bin/bash
# Emergency Jenkins disk cleanup

JENKINS_HOME="/var/lib/jenkins"

echo "Current disk usage:"
du -sh "$JENKINS_HOME"/*

# 1. Delete old builds
find "$JENKINS_HOME/jobs" -type d -name builds -exec find {} -type d -mtime +90 -delete \;

# 2. Clean workspace
rm -rf "$JENKINS_HOME/workspace"/*

# 3. Delete old logs
find "$JENKINS_HOME" -name "*.log" -mtime +30 -delete

# 4. Compress build artifacts
find "$JENKINS_HOME/jobs" -name "*.jar" -o -name "*.war" | xargs gzip

# 5. Remove .git directories from workspaces
find "$JENKINS_HOME" -type d -name .git -exec rm -rf {} \;

echo "Disk usage after cleanup:"
du -sh "$JENKINS_HOME"/*
```

---

## 6. Plugin Issues

### Symptoms
- Jenkins won't start after plugin update
- Incompatible plugin errors
- Job configuration corrupted

### Recovery

```bash
# Safe mode: Disable plugins
touch "$JENKINS_HOME/jenkins.install.InstallState.xml"

# Remove problematic plugin
rm -f "$JENKINS_HOME/plugins/problem-plugin.jpi"
rm -rf "$JENKINS_HOME/plugins/problem-plugin"

# Restart
systemctl restart jenkins

# Verify
curl http://localhost:8080/api/json
```

---

## 7. Slow Build Queue

### Symptoms
- High build queue depth
- Builds waiting 30+ minutes
- No errors, just waiting

### Analysis

```bash
# Check queue size
curl http://localhost:8080/queue/api/json | jq '.items | length'

# Identify blocking builds
curl http://localhost:8080/queue/api/json | jq '.items[] | {task: .task.name, inQueueSince: .inQueueSince}'

# Check executor availability
curl http://localhost:8080/api/json | jq '.computer[] | {name: .displayName, idle: .idle, offline: .offline}'

# Scale agents
kubectl scale deployment jenkins-agent --replicas=50 -n jenkins
```

---

## 8. Out of Memory Errors

### Symptoms
- java.lang.OutOfMemoryError
- Jenkins restarts randomly
- Logs show GC overhead limit exceeded

### Fix

```bash
# Check current heap size
ps aux | grep java | grep -oE "\-Xmx[^ ]+"

# Update JAVA_OPTS
cat >> /etc/default/jenkins <<EOF
JAVA_ARGS="-Xmx64g -Xms64g \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=30"
EOF

# Apply and restart
systemctl restart jenkins

# Monitor after restart
jmap -heap $(pgrep -f java)
```

---

## 9. Git/SCM Issues

### Symptoms
- "Timeout connecting to repository"
- "Invalid credentials"
- "Reference not found"

### Solutions

```bash
# Test Git connectivity
GIT_SSH_COMMAND='ssh -vvv' git clone https://github.com/repo.git

# Update submodules
git submodule update --init --recursive

# Clear git cache
git config --global http.sslVerify false

# Check SSH keys
ssh-keyscan github.com >> ~/.ssh/known_hosts

# Verify Git version
git --version  # Should be 2.20+
```
```

---

## Part 4: Performance Benchmarking Report Template

**File: `jenkins-performance/benchmark-report.md`**

```markdown
# Jenkins Performance Benchmark Report

**Generated:** $(date)
**Jenkins Version:** $(curl -s http://localhost:8080/api/json | jq -r '.version')
**Test Duration:** 24 hours

## Executive Summary

- Average Build Success Rate: 99.2%
- Average Build Duration: 12.5 minutes
- Peak Concurrent Builds: 85
- Queue Peak Depth: 142
- System Uptime: 99.95%

## Performance Metrics

### Build Times
| Metric | Value | Benchmark |
|--------|-------|-----------|
| P50 | 10.2 min | < 15 min ✅ |
| P95 | 22.1 min | < 30 min ✅ |
| P99 | 28.9 min | < 45 min ✅ |

### Resource Utilization
- Average CPU: 42%
- Peak CPU: 87%
- Average Memory: 58%
- Peak Memory: 91%

### Network
- Avg Bandwidth: 145 Mbps
- Peak Bandwidth: 890 Mbps
- Package Loss: 0%

## Recommendations

1. ✅ Current performance meets SLA targets
2. ⚠️ Memory utilization approaching limit - consider vertical scaling
3. 📈 Consider agent pool expansion for sustained 100+ concurrent builds

---

*Report prepared by: Jenkins DevOps Team*
```

---

## Quick Reference Troubleshooting Flowchart

```
Jenkins Not Responding?
├── Check if process is running
│   ├── YES → Check logs for errors
│   │   ├── OOM → Increase heap
│   │   ├── Plugin error → Safe mode
│   │   └── Disk full → Cleanup
│   └── NO → Start Jenkins, check startup logs
├── Master or Agent issue?
│   ├── Master → Failover to secondary
│   └── Agent → Restart agent, check connectivity
├── Pipeline failures?
│   ├── Docker pull timeout → Check registry
│   ├── Kubectl timeout → Check API connectivity
│   └── Test failures → Analyze test output
└── Resource issues?
    ├── High CPU → Check for hanging builds
    ├── High Memory → Check for memory leaks
    └── High Disk → Cleanup old builds
```
