import '@cspotcode/source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { EksStack } from '../lib/eks-stack';

const app = new cdk.App();

// Create VPC with security groups
const vpcStack = new VpcStack(app, 'FincraVpcStack', {
  description: 'VPC and networking infrastructure for Fincra application'
});

// Create EKS Fargate Cluster
const eksStack = new EksStack(app, 'FincraEksStack', {
  vpc: vpcStack.vpc,
  clusterSecurityGroup: vpcStack.clusterSecurityGroup,
  description: 'EKS Fargate cluster for Fincra application'
});

// Set up dependencies
eksStack.addDependency(vpcStack);

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'Fincra');
cdk.Tags.of(app).add('Environment', 'Development');
cdk.Tags.of(app).add('ManagedBy', 'CDK');
