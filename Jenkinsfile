pipeline {
    agent any
    
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
        stage('k8s deploy'){
            steps{
               sh 'kubectl apply -f k8s-deploy.yml'
            }
        }
    }
}
