pipeline {
    agent { label 'master' }
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
        stage('Git Checkout') {
            steps {
              git branch: 'main',
                url: 'https://github.com/Shaikh-Majid/GitPractices.git'
            }
        }
        stage('Maven Dependencies'){
            steps{
                 sh 'mvn clean package'
            }
        }
       
    }
}
    
