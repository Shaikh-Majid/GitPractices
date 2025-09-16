pipeline {
    agent any
    //environment {
      //  AWS_ACCESS_KEY_ID     = credentials('aws-creds')  // Jenkins injects Access Key
       // AWS_SECRET_ACCESS_KEY = credentials('aws-creds')  // Jenkins injects Secret Key
       // AWS_DEFAULT_REGION    = 'ap-south-1'
        //KUBECONFIG            = '/var/lib/jenkins/.kube/config'
   // }
    
    tools{
        maven 'maven3'
    }
    stages {
        stage('clone') {
            steps {
              git branch: 'main',
                url: 'https://github.com/Shaikh-Majid/GitPractices.git'
            }
        }
        stage('build'){
            steps{
                 sh 'mvn clean package'
            }
        }
       stage('Docker Build') {
            steps {
                script {
                    docker.withRegistry('https://index.docker.io/v1/', 'docker') {
                        def app = docker.build("shaikh888/devopsrepo:${BUILD_NUMBER}")
                        app.push()
                        sh "docker run -it shaikh888/devopsrepo:${BUILD_NUMBER} sh -c 'while true; do sleep 60; done'"
'
                    }
                }
            }
       }

    }
}
    
