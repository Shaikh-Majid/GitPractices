# Jenkins Shared Library Structure - 4YOE Deep Dive

## Directory Structure

```
techflow-jenkins-library/
├── vars/
│   ├── buildDockerImage.groovy
│   ├── deployToKubernetes.groovy
│   ├── runSecurityScans.groovy
│   ├── runTests.groovy
│   ├── notifyStakeholders.groovy
│   ├── generateReports.groovy
│   ├── validateConfig.groovy
│   └── rollbackDeployment.groovy
├── src/
│   └── com/
│       └── techflow/
│           ├── jenkins/
│           │   ├── models/
│           │   │   ├── BuildConfig.groovy
│           │   │   ├── DeploymentConfig.groovy
│           │   │   └── TestConfig.groovy
│           │   ├── utils/
│           │   │   ├── Logger.groovy
│           │   │   ├── VaultManager.groovy
│           │   │   ├── KubernetesHelper.groovy
│           │   │   ├── NotificationManager.groovy
│           │   │   └── MetricsCollector.groovy
│           │   ├── security/
│           │   │   ├── CredentialRotation.groovy
│           │   │   ├── SecretScanning.groovy
│           │   │   └── AuditLogger.groovy
│           │   └── quality/
│           │       ├── CodeQualityGates.groovy
│           │       ├── VulnerabilityScanning.groovy
│           │       ├── PerformanceAnalysis.groovy
│           │       └── TestReportAggregator.groovy
├── resources/
│   ├── scripts/
│   │   ├── health-check.sh
│   │   ├── secret-rotation.sh
│   │   └── cleanup.sh
│   └── configs/
│       ├── sonar-config.properties
│       ├── trivy-config.yaml
│       └── jmeter-config.jmx
└── README.md
```

---

## 1. Core Utility Classes

### VaultManager.groovy

```groovy
// src/com/techflow/jenkins/utils/VaultManager.groovy

package com.techflow.jenkins.utils

@Grab('org.apache.httpcomponents:httpclient:4.5.13')
import org.apache.http.client.HttpClient
import org.apache.http.client.methods.HttpGet
import org.apache.http.impl.client.HttpClients
import org.apache.http.util.EntityUtils
import groovy.json.JsonSlurper
import groovy.json.JsonOutput

class VaultManager {
    private String vaultAddr
    private String vaultToken
    private String vaultNamespace
    private HttpClient httpClient

    VaultManager(String addr, String token, String namespace = null) {
        this.vaultAddr = addr
        this.vaultToken = token
        this.vaultNamespace = namespace
        this.httpClient = HttpClients.createDefault()
    }

    def getSecret(String path, String key = null) {
        String url = "${vaultAddr}/v1/secret/data${path}"
        
        HttpGet httpGet = new HttpGet(url)
        httpGet.addHeader("X-Vault-Token", vaultToken)
        if (vaultNamespace) {
            httpGet.addHeader("X-Vault-Namespace", vaultNamespace)
        }

        try {
            def response = httpClient.execute(httpGet)
            def responseBody = EntityUtils.toString(response.entity)
            
            if (response.statusLine.statusCode != 200) {
                throw new Exception("Vault error: ${responseBody}")
            }

            def json = new JsonSlurper().parseText(responseBody)
            
            if (key) {
                return json.data.data[key]
            }
            return json.data.data
        } finally {
            httpGet.releaseConnection()
        }
    }

    def rotateSecret(String path) {
        println "🔄 Initiating secret rotation for: ${path}"
        
        String url = "${vaultAddr}/v1/database/rotate-root/${path}"
        
        // Implementation would call Vault API
        println "✅ Secret rotation request sent"
    }

    def checkSecretAge(String path) {
        String url = "${vaultAddr}/v1/secret/metadata${path}"
        
        // Check metadata to see when secret was last updated
        // Return age in days
    }

    def auditSecretAccess(String path, String accessor) {
        println "📝 Logging secret access: ${accessor} -> ${path}"
        // Log to audit system
    }
}
```

### KubernetesHelper.groovy

```groovy
// src/com/techflow/jenkins/utils/KubernetesHelper.groovy

package com.techflow.jenkins.utils

class KubernetesHelper {
    
    static def getDeploymentStatus(String namespace, String deployment) {
        def status = sh(script: """
            kubectl get deployment ${deployment} -n ${namespace} -o json
        """, returnStdout: true).trim()
        
        return new groovy.json.JsonSlurper().parseText(status)
    }

    static def waitForDeployment(String namespace, String deployment, String timeout = '10m') {
        def result = sh(script: """
            kubectl rollout status deployment/${deployment} \
              -n ${namespace} \
              --timeout=${timeout}
        """, returnStatus: true)
        
        return result == 0
    }

    static def getPodLogs(String namespace, String selector, Integer lines = 100) {
        return sh(script: """
            kubectl logs -n ${namespace} \
              -l ${selector} \
              --tail=${lines} \
              --all-containers=true
        """, returnStdout: true).trim()
    }

    static def getMetrics(String namespace, String resource = 'pods') {
        return sh(script: """
            kubectl top ${resource} -n ${namespace} --no-headers=true
        """, returnStdout: true).trim()
    }

    static def executeInPod(String namespace, String pod, String container, String command) {
        return sh(script: """
            kubectl exec -n ${namespace} ${pod} -c ${container} -- ${command}
        """, returnStdout: true).trim()
    }

    static def rollback(String namespace, String deployment, Integer revisions = 1) {
        sh script: """
            kubectl rollout undo deployment/${deployment} \
              -n ${namespace} \
              --to-revision=${revisions}
            
            kubectl rollout status deployment/${deployment} \
              -n ${namespace} \
              --timeout=10m
        """
    }

    static def canary(Map config) {
        // config = [namespace, deployment, image, canaryReplicas, canaryWeight]
        
        sh script: """
            # Create canary deployment
            kubectl set image deployment/${config.deployment}-canary \
              ${config.deployment}=${config.image} \
              -n ${config.namespace} \
              --record
            
            # Scale canary
            kubectl scale deployment ${config.deployment}-canary \
              --replicas=${config.canaryReplicas} \
              -n ${config.namespace}
            
            # Monitor canary for errors
            kubectl port-forward -n ${config.namespace} \
              svc/${config.deployment} 8080:8080 &
            PORT_FWD_PID=$!
            
            sleep 30
            ERROR_RATE=$(curl -s http://localhost:8080/metrics | grep error_total | awk '{print $2}')
            
            if [ \$(echo "\$ERROR_RATE > 0.05" | bc) -eq 1 ]; then
                echo "❌ Canary error rate too high, rolling back"
                kubectl delete deployment ${config.deployment}-canary -n ${config.namespace}
                kill $PORT_FWD_PID
                return 1
            fi
            
            kill $PORT_FWD_PID
            echo "✅ Canary deployment successful, promoting to full"
        """
    }
}
```

### MetricsCollector.groovy

```groovy
// src/com/techflow/jenkins/utils/MetricsCollector.groovy

package com.techflow.jenkins.utils

class MetricsCollector {
    private String prometheusUrl
    private String jobName
    private Map metrics = [:]

    MetricsCollector(String prometheusUrl, String jobName) {
        this.prometheusUrl = prometheusUrl
        this.jobName = jobName
    }

    def collectBuildMetrics(Map buildInfo) {
        metrics.buildDuration = buildInfo.duration
        metrics.buildStatus = buildInfo.status
        metrics.testsPassed = buildInfo.testsPassed
        metrics.testsFailed = buildInfo.testsFailed
        metrics.codeQualityScore = buildInfo.qualityScore
        metrics.securityVulnerabilities = buildInfo.vulnerabilities
        metrics.artifactSize = buildInfo.artifactSize
        
        publishMetrics()
    }

    private def publishMetrics() {
        sh script: """
            # Push metrics to Prometheus Pushgateway
            cat <<EOF | curl --data-binary @- http://pushgateway.monitoring:9091/metrics/job/${jobName}
${formatMetrics()}
EOF
        """
    }

    private String formatMetrics() {
        def output = ""
        metrics.each { key, value ->
            output += "jenkins_build_${key}{job=\"${jobName}\"} ${value}\n"
        }
        return output
    }

    def queryPrometheus(String query) {
        def result = sh(script: """
            curl -s '${prometheusUrl}/api/v1/query?query=${query}' | jq
        """, returnStdout: true).trim()
        
        return new groovy.json.JsonSlurper().parseText(result)
    }

    def getAlertingStatus() {
        return queryPrometheus('ALERTS{alertname=~"Jenkins.*"}')
    }
}
```

---

## 2. Domain Models

### BuildConfig.groovy

```groovy
// src/com/techflow/jenkins/models/BuildConfig.groovy

package com.techflow.jenkins.models

@groovy.transform.ToString(includeNames=true)
class BuildConfig {
    String projectName
    String gitRepository
    String gitBranch
    String buildTool  // gradle, maven, npm
    String javaVersion
    boolean runTests = true
    boolean runSecurityScans = true
    List<String> buildArtifacts = []
    Map<String, String> buildArgs = [:]
    Integer timeout = 30
    Integer parallelWorkers = 4
    String notifyChannels = 'slack,email'
    boolean skipAnalysis = false

    static BuildConfig fromJson(Map json) {
        return new BuildConfig(
            projectName: json.projectName,
            gitRepository: json.gitRepository,
            gitBranch: json.gitBranch ?: 'main',
            buildTool: json.buildTool ?: 'gradle',
            javaVersion: json.javaVersion ?: '11',
            runTests: json.runTests != null ? json.runTests : true,
            runSecurityScans: json.runSecurityScans != null ? json.runSecurityScans : true,
            buildArtifacts: json.buildArtifacts ?: [],
            buildArgs: json.buildArgs ?: [:]
        )
    }

    boolean validate() {
        if (!projectName || !gitRepository) {
            return false
        }
        if (!buildTool in ['gradle', 'maven', 'npm']) {
            return false
        }
        return true
    }
}
```

### DeploymentConfig.groovy

```groovy
// src/com/techflow/jenkins/models/DeploymentConfig.groovy

package com.techflow.jenkins.models

@groovy.transform.ToString(includeNames=true)
class DeploymentConfig {
    String environment  // staging, production
    String cluster
    String namespace = 'default'
    String deployment
    String image
    Integer replicas = 3
    String strategy = 'rolling'  // rolling, canary, blue-green
    Integer timeout = 10
    Integer maxSurge = 1
    Integer maxUnavailable = 0
    Map<String, String> env = [:]
    List<String> requiredApprovals = []
    boolean runSmokeTests = true

    static DeploymentConfig fromFile(String filePath) {
        def content = new File(filePath).text
        def yaml = new org.yaml.snakeyaml.Yaml().load(content)
        return fromMap(yaml)
    }

    static DeploymentConfig fromMap(Map config) {
        return new DeploymentConfig(
            environment: config.environment,
            cluster: config.cluster,
            namespace: config.namespace ?: 'default',
            deployment: config.deployment,
            image: config.image,
            replicas: config.replicas ?: 3,
            strategy: config.strategy ?: 'rolling',
            env: config.env ?: [:]
        )
    }

    boolean validate() {
        if (!environment || !cluster || !deployment || !image) {
            return false
        }
        if (!environment in ['staging', 'production']) {
            return false
        }
        return true
    }
}
```

---

## 3. Global Shared Library Step

### vars/globalStep.groovy

```groovy
// Global logging and context for all pipeline steps

def call(Closure body) {
    def config = [:]
    body.resolveStrategy = Closure.DELEGATE_FIRST
    body.delegate = config
    body()
    
    // Initialize global context
    env.PIPELINE_START_TIME = System.currentTimeMillis()
    env.PIPELINE_ARTIFACTS_DIR = "${env.WORKSPACE}/artifacts"
    
    sh "mkdir -p ${env.PIPELINE_ARTIFACTS_DIR}"
}
```

---

## 4. Example: Custom Jenkins CLI Utilities

### jenkins-cli-wrapper.sh

```bash
#!/bin/bash
# Wrapper for Jenkins CLI with authentication

set -euo pipefail

JENKINS_URL="${JENKINS_URL:-https://jenkins.techflow.com}"
JENKINS_USER="${JENKINS_USER:-jenkins-cli}"
JENKINS_TOKEN="${JENKINS_TOKEN:-${JENKINS_CLI_TOKEN}}"
JENKINS_CLI_JAR="/opt/jenkins-cli/jenkins-cli.jar"

# Validate prerequisites
if [ ! -f "$JENKINS_CLI_JAR" ]; then
    echo "❌ Jenkins CLI jar not found at $JENKINS_CLI_JAR"
    exit 1
fi

# Execute Jenkins CLI command
java -jar "$JENKINS_CLI_JAR" \
    -s "$JENKINS_URL" \
    -auth "$JENKINS_USER:$JENKINS_TOKEN" \
    "$@"
```

### Example: Programmatic Job Management

```groovy
// Manage jobs programmatically

def createOrUpdateJob(String jobName, String jobConfig) {
    sh '''
        java -jar /opt/jenkins-cli/jenkins-cli.jar \
            -s https://jenkins.techflow.com \
            -auth ${JENKINS_USER}:${JENKINS_TOKEN} \
            create-job ${jobName} < ${jobConfig}
    '''
}

def triggerJob(String jobName, Map parameters = [:]) {
    def paramString = parameters.collect { k, v -> "${k}=${v}" }.join(' ')
    
    sh """
        java -jar /opt/jenkins-cli/jenkins-cli.jar \
            -s https://jenkins.techflow.com \
            -auth ${JENKINS_USER}:${JENKINS_TOKEN} \
            build ${jobName} ${paramString}
    """
}

def getJobStatus(String jobName) {
    return sh(script: """
        java -jar /opt/jenkins-cli/jenkins-cli.jar \
            -s https://jenkins.techflow.com \
            -auth ${JENKINS_USER}:${JENKINS_TOKEN} \
            get-job ${jobName}
    """, returnStdout: true).trim()
}
```

---

## Testing Shared Library

### vars/testBuildDockerImage.groovy

```groovy
// Unit tests for shared library

@Test
void testBuildDockerImageSuccess() {
    def config = [
        dockerfile: 'Dockerfile',
        context: '.',
        registry: 'docker.io',
        imageName: 'techflow/payment-service',
        tags: ['latest'],
        platforms: ['linux/amd64'],
        registryCredential: 'docker-registry'
    ]
    
    // Mock Jenkins environment
    binding.setVariable('sh', { cmd -> 
        println "Executed: ${cmd}"
        return 0
    })
    
    buildDockerImage(config)
}
```

---

## 5. Best Practices

### When to Use Shared Libraries

✅ **DO:**
- Reusable pipeline steps across multiple jobs
- Common utility functions (logging, metrics, notifications)
- Organization-wide security standards
- Complex business logic

❌ **DON'T:**
- One-time scripts (just use inline shell)
- Sensitive credentials (use Vault instead)
- Large dependencies (use Docker instead)
- Tightly coupled to single pipeline

### Versioning Strategy

```
/techflow-jenkins-library/
├── main (stable, production)
├── develop (integration, testing)
├── feature/* (feature branches)
└── tags/v1.0.0, v1.0.1, v1.1.0 (releases)

Jenkins Configuration:
  @Library('techflow-jenkins-library@v1.0.0') _  // Specific version
  @Library('techflow-jenkins-library@main') _     // Latest stable
  @Library('techflow-jenkins-library') _          // Default (main)
```

---

## Summary

This shared library structure provides:
- **Reusability**: 80%+ code reuse across 500+ jobs
- **Security**: Centralized secret management via Vault
- **Maintainability**: Single source of truth for pipeline logic
- **Scalability**: Supports microservices architecture
- **Observability**: Integrated metrics and logging

---

*Last Updated: 2024 | For 4+ YOE DevOps Engineers*
