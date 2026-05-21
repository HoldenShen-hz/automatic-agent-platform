terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

terraform {
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "automatic-agent"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
}

variable "availability_zones" {
  description = "Availability zones for the VPC"
  type        = list(string)
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_storage_gb" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "eks_node_instance_types" {
  description = "EKS node instance types"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "eks_desired_nodes" {
  description = "Desired number of EKS nodes"
  type        = number
  default     = 2
}

variable "eks_min_nodes" {
  description = "Minimum number of EKS nodes"
  type        = number
  default     = 1
}

variable "eks_max_nodes" {
  description = "Maximum number of EKS nodes"
  type        = number
  default     = 3
}

variable "eks_endpoint_public_access" {
  description = "Whether to expose the EKS API endpoint publicly"
  type        = bool
  default     = false
}

variable "eks_public_access_cidrs" {
  description = "Allowed CIDR blocks when public EKS API access is enabled"
  type        = list(string)
  default     = []
}

variable "cluster_kms_key_arn" {
  description = "Optional KMS key ARN for EKS secret envelope encryption"
  type        = string
  default     = null
}

variable "node_volume_kms_key_arn" {
  description = "Optional KMS key ARN for EKS node volume encryption"
  type        = string
  default     = null
}

variable "rds_kms_key_id" {
  description = "Optional KMS key ARN for RDS encryption"
  type        = string
  default     = null
}

variable "redis_auth_token" {
  description = "Redis auth token supplied via secure tfvars or CI secret injection"
  type        = string
  sensitive   = true
}

locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, { Name = "${var.project_name}-${var.environment}" })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, { Name = "${var.project_name}-${var.environment}-igw" })
}

resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone = var.availability_zones[count.index]

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-private-${var.availability_zones[count.index]}"
    Tier = "private"
  })
}

resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, length(var.availability_zones) + count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-public-${var.availability_zones[count.index]}"
    Tier = "public"
  })
}

resource "aws_eip" "nat" {
  count  = length(var.availability_zones)
  domain = "vpc"

  tags = merge(local.common_tags, { Name = "${var.project_name}-${var.environment}-nat-${count.index}" })
}

resource "aws_nat_gateway" "main" {
  count         = length(var.availability_zones)
  subnet_id     = aws_subnet.public[count.index].id
  allocation_id = aws_eip.nat[count.index].id

  tags = merge(local.common_tags, { Name = "${var.project_name}-${var.environment}-nat-${count.index}" })

  depends_on = [aws_internet_gateway.main]
}

resource "aws_route_table" "private" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = merge(local.common_tags, { Name = "${var.project_name}-${var.environment}-private-rt-${count.index}" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.common_tags, { Name = "${var.project_name}-${var.environment}-public-rt" })
}

resource "aws_route_table_association" "private" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_route_table_association" "public" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

module "eks" {
  source = "./modules/eks"

  cluster_name             = "${var.project_name}-${var.environment}"
  cluster_version          = "1.29"
  vpc_id                   = aws_vpc.main.id
  private_subnet_ids       = aws_subnet.private[*].id
  min_nodes                = var.eks_min_nodes
  max_nodes                = var.eks_max_nodes
  desired_nodes            = var.eks_desired_nodes
  instance_types           = var.eks_node_instance_types
  endpoint_public_access   = var.eks_endpoint_public_access
  public_access_cidrs      = var.eks_public_access_cidrs
  cluster_kms_key_arn      = var.cluster_kms_key_arn
  node_volume_kms_key_arn  = var.node_volume_kms_key_arn
  project_name             = var.project_name
  environment              = var.environment
}

module "rds" {
  source = "./modules/rds"

  project_name       = var.project_name
  environment        = var.environment
  db_instance_class  = var.db_instance_class
  db_storage_gb      = var.db_storage_gb
  db_max_storage_gb  = var.db_storage_gb * 5
  private_subnet_ids = aws_subnet.private[*].id
  vpc_id             = aws_vpc.main.id
  vpc_cidr           = var.vpc_cidr
  kms_key_id         = var.rds_kms_key_id
}

module "elasticache" {
  source = "./modules/elasticache"

  project_name       = var.project_name
  environment        = var.environment
  node_type          = var.redis_node_type
  num_cache_clusters = var.environment == "prod" ? 3 : 1
  private_subnet_ids = aws_subnet.private[*].id
  vpc_id             = aws_vpc.main.id
  vpc_cidr           = var.vpc_cidr
  auth_token         = var.redis_auth_token
}

module "ecr" {
  source = "./modules/ecr"

  project_name = var.project_name
  environment  = var.environment
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_node_role_arn" {
  description = "EKS node IAM role ARN"
  value       = module.eks.node_role_arn
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = module.rds.db_instance_endpoint
}

output "rds_port" {
  description = "RDS PostgreSQL port"
  value       = module.rds.db_instance_port
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = module.elasticache.redis_endpoint
}

output "redis_port" {
  description = "ElastiCache Redis port"
  value       = module.elasticache.redis_port
}

output "ecr_repository_url" {
  description = "ECR container repository URL"
  value       = module.ecr.repository_url
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}
