import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly clusterSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC with public and private subnets across 2 availability zones (scale requirements)
    this.vpc = new ec2.Vpc(this, 'FincraVpc', {
      vpcName: 'fincra-vpc',
      maxAzs: 2,
      natGateways: 1, // for cost optimization, we use 1 NAT gateway
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // Create Security Group for EKS Cluster with specified rules
    this.clusterSecurityGroup = new ec2.SecurityGroup(this, 'FincraClusterSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: 'fincra-eks-cluster-sg',
      description: 'Security group for Fincra EKS cluster with custom firewall rules',
      allowAllOutbound: true, // Allow all egress
    });

    // Ingress Rule 1: Allow HTTP (port 80) from everywhere
    this.clusterSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP from internet'
    );

    // Ingress Rule 2: Allow HTTPS (port 443) from everywhere
    this.clusterSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS from internet'
    );

    // Ingress Rule 3: Allow ICMP (ping) from everywhere
    this.clusterSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.allIcmp(),
      'Allow ICMP (ping) from internet'
    );

    // Ingress Rule 4: Allow all TCP/UDP traffic within VPC
    this.clusterSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.allTcp(),
      'Allow all TCP traffic within VPC'
    );

    this.clusterSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.allUdp(),
      'Allow all UDP traffic within VPC'
    );

    // Tag the VPC for EKS discovery
    cdk.Tags.of(this.vpc).add('kubernetes.io/cluster/fincra-cluster', 'shared');

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: 'FincraVpcId',
    });

    new cdk.CfnOutput(this, 'VpcCidr', {
      value: this.vpc.vpcCidrBlock,
      description: 'VPC CIDR Block',
      exportName: 'FincraVpcCidr',
    });

    new cdk.CfnOutput(this, 'ClusterSecurityGroupId', {
      value: this.clusterSecurityGroup.securityGroupId,
      description: 'Cluster Security Group ID',
      exportName: 'FincraClusterSecurityGroupId',
    });

    new cdk.CfnOutput(this, 'PublicSubnetIds', {
      value: this.vpc.publicSubnets.map(subnet => subnet.subnetId).join(','),
      description: 'Public Subnet IDs',
      exportName: 'FincraPublicSubnetIds',
    });

    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      value: this.vpc.privateSubnets.map(subnet => subnet.subnetId).join(','),
      description: 'Private Subnet IDs',
      exportName: 'FincraPrivateSubnetIds',
    });
  }
}