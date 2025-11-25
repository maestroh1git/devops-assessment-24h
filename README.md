# Fincra DevOps Take-Home Assessment

## Overview
This project demonstrates Infrastructure as Code (IaC) and CI/CD practices for deploying a Flask application on AWS EKS Fargate using AWS CDK, Kubernetes, and GitHub Actions. Everything is automated end-to-end: committing code triggers a pipeline that builds the container image, provisions the AWS infrastructure, and updates the workload on the cluster.

## What Happens When We Push Code

1. You push code to GitHub  
   ↓  
2. GitHub Actions (CI/CD) starts  
   ↓  
3. Builds Docker image of Flask app  
   ↓  
4. Pushes image to ECR 
   ↓  
5. CDK deploys VPC
   ↓  
6. CDK deploys EKS cluster 
   ↓  
7. Kubernetes creates 2 Flask pods  (for availability) 
   ↓  
8. Creates internal load balancer  
    ↓  
9. AWS creates ALB (public URL)  
    ↓  
10. Users can access: `http://ALB-URL/`  
    ↓  
11. See: `Hello, from Fincra!`

```
DEVELOPER                 AWS CLOUD                      USER

   |                          |                           |
   | 1. git push              |                           |
   |------------------------->|                           |
   |                          |                           |
   |                    GitHub Actions                    |
   |                    (CI/CD Robot)                     |
   |                          |                           |
   |                    2. Build Docker                   |
   |                    3. Push to ECR                    |
   |                    4. Deploy VPC                     |
   |                    5. Deploy EKS                     |
   |                    6. Deploy App                     |
   |                          |                           |
   |                          v                           |
   |                    ┌──────────┐                      |
   |                    │   ALB    │<---------------------|
   |                    │ (Public) │    7. http request   |
   |                    └────┬─────┘                      |
   |                         |                            |
   |                    ┌────▼─────┐                      |
   |                    │ Flask App│                      |
   |                    │ (2 Pods) │                      |
   |                    └──────────┘                      |
   |                         |                            |
   |                    Returns: Hello, from Fincra!----->|
```
    
### Components:
    - VPC: Multi-AZ VPC with public and private subnets
    - EKS Fargate Cluster: Serverless Kubernetes cluster
    - Application Load Balancer: Managed via AWS Load Balancer Controller
    - Flask Application: Simple web server returning "Hello, from Fincra!"
    - Security Groups: Configured with specific ingress/egress rules
    
### Prerequisites
    
    - AWS Account with appropriate permissions
    - GitHub account
    - Local development tools:
      - Node.js 18+
      - AWS CDK CLI
      - kubectl
      - Docker
      - Python 3.11+
    
### Project Structure
```
    ├── .github/workflows/  # CI/CD pipelines
    ├── cdk/                # AWS CDK infrastructure code
    ├── k8s/                # Kubernetes manifests
    ├── app.py              # Flask application (application code)
```
    
### Security Group Rules
    
    Egress:
    - Allow all outbound traffic
    
    Ingress:
    - TCP ports 80, 443 from 0.0.0.0/0
    - ICMP from 0.0.0.0/0
    - All TCP/UDP traffic from within VPC CIDR
    

### CI/CD Pipeline
    
    The GitHub Actions workflow automatically:
    1. Lints and tests the application code
    2. Builds and pushes Docker image to ECR
    3. Deploys infrastructure using CDK
    4. Deploys application to EKS using kubectl and Kustomize
    
    Triggers on push to `main` branch.
    
### Assumptions
    
    1. AWS account has sufficient permissions for EKS, VPC, EC2, ECR, STS
    2. GitHub Actions has AWS credentials configured
    3. Single region deployment (us-east-1)
    4. Using Fargate for serverless compute
    5. Application runs on port 5000 internally, exposed via port 80
    6. Two replicas are enough to satisfy availability requirements
    7. AWS Load Balancer Controller is already installed in the cluster
    
### Cost Optimization
    
    - Using Fargate eliminates need for managing EC2 instances
    - Single NAT Gateway to reduce costs
    - Minimal replica count (2 pods)
    
    
### Time Spent
    
    - Infrastructure design, planning and setup: 
    - Kubernetes manifests: 
    - CI/CD pipeline: 
    - Documentation: 
    - Total: 

### Resources

- Amazon EKS using CDK (TypeScript) reference implementation: https://github.com/aws-samples/amazon-eks-using-cdk-typescript
- AWS Reinvent Trivia Game: https://github.com/aws-samples/aws-reinvent-trivia-game