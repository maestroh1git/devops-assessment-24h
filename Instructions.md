# DevOps take-home
This is a hands-on assessment of Infrastructure-as-Code (IaC), CI/CD, and public cloud providers. Use AWS as the platform of choice; you may use the `AWS Cloud Development Kit (CDK)` — preferably, or `CloudFormation`. Please do not spend more than 3-4 hours on this task. You're not expected to set up your own personal cloud account, but there should be enough configuration details so that deploying to a real cloud environment will theoretically work. Be prepared to justify your design.

## Setup:
- Create a repository in your own GitHub account and use the free tier of GitHub Actions.

## Background:
A simple Flask webserver that displays "Hello, from MAX!" runs on a EKS fargate cluster on the AWS Cloud. The cluster that runs it has several security group rules associated. The firewall rules are:

- Allow all egress
- Deny all ingress, but allow:
```
TCP Ports 80, 443 from everywhere on the internet
ICMP (ping) from  everywhere on the internet
Allow all tcp/udp internal traffic within the VPC
```

## The problem:
The above cloud-native application was manually configured using Web console UIs, and it was accidentally deleted by a junior developer. Neither the cloud security group rules nor the EKS cluster configuration were captured in IaC. Your assignment is to create the cloud resources in configuration files and set up CI/CD to create/update the rules based on code changes in the master branch. This would allow arbitrary deployments of the application stack, resilient to incidents. It also allows a team of DevOps engineers to collaborate on new infrastructure definitions.

## Requirements:
- Update the `./github/workflows/config.yml` file that installs CLI tools as needed, configures authentication, performs basic sanity tests, and deploys resources; and set up CI/CD using GitHub Actions to create/update the resources based on code changes in the main branch.
- Use AWS CDK (preferably) or CloudFormation to define the infrastructure in configuration file(s) that includes a VPC network for the EKS Fargate cluster, and security group rules.
- (Theoretically deployed) EKS Fargate cluster that runs the Python webserver container defined in `app.py` on startup and any restarts. The Dockerfile for building the container image is already provided.
- (Theoretically deployed) Working AWS Application Load Balancer via an Ingress controller to see "Hello, from MAX!" in a web browser. Provide Kubernetes manifest files (e.g., deployment, service, ingress) for deploying the Flask application on the EKS Fargate cluster.
- Basic Documentation (README.md) that includes installation instructions, usage examples, and any assumptions made; and an architecture diagram.
- Avoid unnecessary abstractions in the form of configuration templates and/or modules.
