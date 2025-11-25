import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { KubectlV32Layer } from '@aws-cdk/lambda-layer-kubectl-v32';
import { Construct } from 'constructs';

interface EksStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  clusterSecurityGroup: ec2.SecurityGroup;
}

export class EksStack extends cdk.Stack {
  public readonly cluster: eks.FargateCluster;

  constructor(scope: Construct, id: string, props: EksStackProps) {
    super(scope, id, props);

    // Create IAM role for EKS cluster (service role)
    const clusterRole = new iam.Role(this, 'FincraClusterRole', {
      assumedBy: new iam.ServicePrincipal('eks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSVPCResourceController'),
      ],
    });

    // Create IAM role for cluster admin access (masters role)
    const mastersRole = new iam.Role(this, 'ClusterAdminRole', {
      assumedBy: new iam.AccountRootPrincipal(),
      roleName: 'FincraEKSAdminRole',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSWorkerNodePolicy'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSVPCResourceController'),
      ],
    });

    // Layer that provides kubectl/helm binaries for cluster handlers
    const kubectlLayer = new KubectlV32Layer(this, 'kubectl');

    // Create EKS Fargate Cluster
    this.cluster = new eks.FargateCluster(this, 'FincraCluster', {
      clusterName: 'fincra-cluster_v1',
      version: eks.KubernetesVersion.V1_32, 
      vpc: props.vpc,
      securityGroup: props.clusterSecurityGroup,
      role: clusterRole,
      mastersRole: mastersRole,
      kubectlLayer,
      outputClusterName: true,
      outputConfigCommand: true,
      outputMastersRoleArn: true,
      endpointAccess: eks.EndpointAccess.PUBLIC_AND_PRIVATE,
      defaultProfile: {
        fargateProfileName: 'fincra-fargate',
        selectors: [
          { namespace: 'default' },
          { namespace: 'kube-system' },
        ],
        subnetSelection: { subnets: props.vpc.privateSubnets },
      },
    });

    // Add admin user to the cluster admins
    const adminUser = iam.User.fromUserName(this, 'MaestrohUser', 'maestroh');
    this.cluster.awsAuth.addUserMapping(adminUser, {
      groups: ['system:masters']
    });

    // Add additional Fargate profile for application namespace
    this.cluster.addFargateProfile('AppFargateProfile', {
      fargateProfileName: 'fincra-app-profile',
      selectors: [
        { namespace: 'fincra-app' },
      ],
    });

    // Create service account for AWS Load Balancer Controller
    const albServiceAccount = this.cluster.addServiceAccount('AWSLoadBalancerControllerServiceAccount', {
      name: 'aws-load-balancer-controller',
      namespace: 'kube-system',
    });

    // Add IAM policy for ALB Controller
    const albPolicyDocument = iam.PolicyDocument.fromJson(this.getAlbControllerPolicy());
    
    albServiceAccount.role.attachInlinePolicy(
      new iam.Policy(this, 'AWSLoadBalancerControllerPolicy', {
        document: albPolicyDocument,
      })
    );

    // Install AWS Load Balancer Controller using Helm
    const albController = this.cluster.addHelmChart('AWSLoadBalancerController', {
      chart: 'aws-load-balancer-controller',
      repository: 'https://aws.github.io/eks-charts',
      namespace: 'kube-system',
      release: 'aws-load-balancer-controller',
      version: '1.6.2',
      values: {
        clusterName: this.cluster.clusterName,
        serviceAccount: {
          create: false,
          name: albServiceAccount.serviceAccountName,
        },
        region: this.region,
        vpcId: props.vpc.vpcId,
      },
      wait: true,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'EKS Cluster Name',
      exportName: 'FincraEksClusterName',
    });

    new cdk.CfnOutput(this, 'ClusterArn', {
      value: this.cluster.clusterArn,
      description: 'EKS Cluster ARN',
      exportName: 'FincraEksClusterArn',
    });

    new cdk.CfnOutput(this, 'ClusterEndpoint', {
      value: this.cluster.clusterEndpoint,
      description: 'EKS Cluster Endpoint',
      exportName: 'FincraEksClusterEndpoint',
    });

    new cdk.CfnOutput(this, 'KubectlRoleArn', {
      value: this.cluster.kubectlRole?.roleArn || 'N/A',
      description: 'IAM role ARN for kubectl access',
      exportName: 'FincraKubectlRoleArn',
    });

    new cdk.CfnOutput(this, 'MastersRoleArn', {
        value: mastersRole.roleArn,
        description: 'IAM role ARN for cluster admin access',
        exportName: 'FincraMastersRoleArn',
      });qqqqqq

    new cdk.CfnOutput(this, 'ConfigCommand', {
      value: `aws eks update-kubeconfig --name ${this.cluster.clusterName} --region ${this.region}`,
      description: 'Command to configure kubectl',
    });
  }

  // AWS Load Balancer Controller IAM Policy
  private getAlbControllerPolicy(): any {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'iam:CreateServiceLinkedRole',
          ],
          Resource: '*',
          Condition: {
            StringEquals: {
              'iam:AWSServiceName': 'elasticloadbalancing.amazonaws.com',
            },
          },
        },
        {
          Effect: 'Allow',
          Action: [
            'ec2:DescribeAccountAttributes',
            'ec2:DescribeAddresses',
            'ec2:DescribeAvailabilityZones',
            'ec2:DescribeInternetGateways',
            'ec2:DescribeVpcs',
            'ec2:DescribeVpcPeeringConnections',
            'ec2:DescribeSubnets',
            'ec2:DescribeSecurityGroups',
            'ec2:DescribeInstances',
            'ec2:DescribeNetworkInterfaces',
            'ec2:DescribeTags',
            'ec2:GetCoipPoolUsage',
            'ec2:DescribeCoipPools',
            'elasticloadbalancing:DescribeLoadBalancers',
            'elasticloadbalancing:DescribeLoadBalancerAttributes',
            'elasticloadbalancing:DescribeListeners',
            'elasticloadbalancing:DescribeListenerCertificates',
            'elasticloadbalancing:DescribeSSLPolicies',
            'elasticloadbalancing:DescribeRules',
            'elasticloadbalancing:DescribeTargetGroups',
            'elasticloadbalancing:DescribeTargetGroupAttributes',
            'elasticloadbalancing:DescribeTargetHealth',
            'elasticloadbalancing:DescribeTags',
          ],
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: [
            'cognito-idp:DescribeUserPoolClient',
            'acm:ListCertificates',
            'acm:DescribeCertificate',
            'iam:ListServerCertificates',
            'iam:GetServerCertificate',
            'waf-regional:GetWebACL',
            'waf-regional:GetWebACLForResource',
            'waf-regional:AssociateWebACL',
            'waf-regional:DisassociateWebACL',
            'wafv2:GetWebACL',
            'wafv2:GetWebACLForResource',
            'wafv2:AssociateWebACL',
            'wafv2:DisassociateWebACL',
            'shield:GetSubscriptionState',
            'shield:DescribeProtection',
            'shield:CreateProtection',
            'shield:DeleteProtection',
          ],
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: [
            'ec2:AuthorizeSecurityGroupIngress',
            'ec2:RevokeSecurityGroupIngress',
          ],
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: ['ec2:CreateSecurityGroup'],
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: ['ec2:CreateTags'],
          Resource: 'arn:aws:ec2:*:*:security-group/*',
          Condition: {
            StringEquals: {
              'ec2:CreateAction': 'CreateSecurityGroup',
            },
            Null: {
              'aws:RequestTag/elbv2.k8s.aws/cluster': 'false',
            },
          },
        },
        {
          Effect: 'Allow',
          Action: ['ec2:CreateTags', 'ec2:DeleteTags'],
          Resource: 'arn:aws:ec2:*:*:security-group/*',
          Condition: {
            Null: {
              'aws:RequestTag/elbv2.k8s.aws/cluster': 'true',
              'aws:ResourceTag/elbv2.k8s.aws/cluster': 'false',
            },
          },
        },
        {
          Effect: 'Allow',
          Action: ['ec2:AuthorizeSecurityGroupIngress', 'ec2:RevokeSecurityGroupIngress', 'ec2:DeleteSecurityGroup'],
          Resource: '*',
          Condition: {
            Null: {
              'aws:ResourceTag/elbv2.k8s.aws/cluster': 'false',
            },
          },
        },
        {
          Effect: 'Allow',
          Action: [
            'elasticloadbalancing:CreateLoadBalancer',
            'elasticloadbalancing:CreateTargetGroup',
          ],
          Resource: '*',
          Condition: {
            Null: {
              'aws:RequestTag/elbv2.k8s.aws/cluster': 'false',
            },
          },
        },
        {
          Effect: 'Allow',
          Action: [
            'elasticloadbalancing:CreateListener',
            'elasticloadbalancing:DeleteListener',
            'elasticloadbalancing:CreateRule',
            'elasticloadbalancing:DeleteRule',
          ],
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: [
            'elasticloadbalancing:AddTags',
            'elasticloadbalancing:RemoveTags',
          ],
          Resource: [
            'arn:aws:elasticloadbalancing:*:*:targetgroup/*/*',
            'arn:aws:elasticloadbalancing:*:*:loadbalancer/net/*/*',
            'arn:aws:elasticloadbalancing:*:*:loadbalancer/app/*/*',
          ],
          Condition: {
            Null: {
              'aws:RequestTag/elbv2.k8s.aws/cluster': 'true',
              'aws:ResourceTag/elbv2.k8s.aws/cluster': 'false',
            },
          },
        },
        {
          Effect: 'Allow',
          Action: [
            'elasticloadbalancing:AddTags',
            'elasticloadbalancing:RemoveTags',
          ],
          Resource: [
            'arn:aws:elasticloadbalancing:*:*:listener/net/*/*/*',
            'arn:aws:elasticloadbalancing:*:*:listener/app/*/*/*',
            'arn:aws:elasticloadbalancing:*:*:listener-rule/net/*/*/*',
            'arn:aws:elasticloadbalancing:*:*:listener-rule/app/*/*/*',
          ],
        },
        {
          Effect: 'Allow',
          Action: [
            'elasticloadbalancing:ModifyLoadBalancerAttributes',
            'elasticloadbalancing:SetIpAddressType',
            'elasticloadbalancing:SetSecurityGroups',
            'elasticloadbalancing:SetSubnets',
            'elasticloadbalancing:DeleteLoadBalancer',
            'elasticloadbalancing:ModifyTargetGroup',
            'elasticloadbalancing:ModifyTargetGroupAttributes',
            'elasticloadbalancing:DeleteTargetGroup',
          ],
          Resource: '*',
          Condition: {
            Null: {
              'aws:ResourceTag/elbv2.k8s.aws/cluster': 'false',
            },
          },
        },
        {
          Effect: 'Allow',
          Action: ['elasticloadbalancing:AddTags'],
          Resource: [
            'arn:aws:elasticloadbalancing:*:*:targetgroup/*/*',
            'arn:aws:elasticloadbalancing:*:*:loadbalancer/net/*/*',
            'arn:aws:elasticloadbalancing:*:*:loadbalancer/app/*/*',
          ],
          Condition: {
            StringEquals: {
              'elasticloadbalancing:CreateAction': [
                'CreateTargetGroup',
                'CreateLoadBalancer',
              ],
            },
            Null: {
              'aws:RequestTag/elbv2.k8s.aws/cluster': 'false',
            },
          },
        },
        {
          Effect: 'Allow',
          Action: [
            'elasticloadbalancing:RegisterTargets',
            'elasticloadbalancing:DeregisterTargets',
          ],
          Resource: 'arn:aws:elasticloadbalancing:*:*:targetgroup/*/*',
        },
        {
          Effect: 'Allow',
          Action: [
            'elasticloadbalancing:SetWebAcl',
            'elasticloadbalancing:ModifyListener',
            'elasticloadbalancing:AddListenerCertificates',
            'elasticloadbalancing:RemoveListenerCertificates',
            'elasticloadbalancing:ModifyRule',
          ],
          Resource: '*',
        },
      ],
    };
  }
}