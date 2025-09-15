pipeline {
    agent any
    
    tools{
        maven 'maven3'
    }
    stages {
        stage('clone') {
            steps {
              git 'https://github.com/Shaikh-Majid/GitPractices.git'
            }
        }
        stage('build'){
            steps{
                 sh 'mvn clean package'
            }
        }
        stage('docker image'){
            steps {
                sh 'docker build -t cicdrepo/webapp .'
            }
        }
        stage('k8s deploy'){
            steps{
               sh 'kubectl apply -f k8s-deploy.yml'
            }
        }
    }
}
