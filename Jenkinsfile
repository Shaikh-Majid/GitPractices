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
        stage('Git Checkout') {
            steps {
              checkout scmGit([ 
       branches[[name:'main']]
       userRemoteConfigs:[[credentialsId: 'github-key'
                name: 'origin'
                  url: 'https://github.com/Shaikh-Majid/GitPractices.git'
               ]] 
             ])
            }
        }
        stage('Ansible'){
         when{ allOf{
            branch 'main'
          }
           }
            steps{
              sh"ansible-playbook playbook.yml"
            }
        }
       
    }
}
    
