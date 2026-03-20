pipeline {
    agent { label 'master'}
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
              checkout([
       $class: 'GitSCM', 
       branches: [[name: 'main']],
       userRemoteConfigs: [[credentialsId: 'github-key',
                  name: 'origin',
                  url: 'https://github.com/Shaikh-Majid/GitPractices.git'
               ]] 
             ])
       echo "BRANCH_NAME: ${env.BRANCH_NAME}"
       echo "GIT_BRANCH: ${env.GIT_BRANCH}"
            }
        }
        stage('list the ip'){
         agent { label 'deploy-node' }
         when{ anyOf{
             expression{ env.GIT_BRANCH == 'origin/main' }
             expression{ env.GIT_BRANCH == 'origin/master' }

          }
           }
            steps{
              sh "ifconfig| grep inet"
            }
        }
       
    }
}
    
