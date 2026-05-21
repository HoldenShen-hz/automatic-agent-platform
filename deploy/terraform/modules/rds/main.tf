variable "project_name" {
  description = "Project name"
  type        = string
  default     = "automatic-agent"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_storage_gb" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_max_storage_gb" {
  description = "Maximum allocated storage in GB"
  type        = number
  default     = 100
}

variable "private_subnet_ids" {
  description = "Private subnet IDs used by the RDS subnet group"
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block allowed to reach RDS from inside the VPC"
  type        = string
}

variable "storage_encrypted" {
  description = "Whether to enable storage encryption"
  type        = bool
  default     = true
}

variable "kms_key_id" {
  description = "Optional KMS key ARN for RDS encryption"
  type        = string
  default     = null
}

locals {
  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = local.tags
}

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-${var.environment}-rds"
  description = "Security group for RDS"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "PostgreSQL from VPC"
  }

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Restricted control-plane egress"
  }

  tags = local.tags
}

resource "aws_db_parameter_group" "main" {
  name   = "${var.project_name}-${var.environment}-postgres16"
  family = "postgres16"

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = local.tags
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-${var.environment}"
  engine         = "postgres"
  engine_version = "16.2"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_storage_gb
  max_allocated_storage = var.db_max_storage_gb
  storage_encrypted     = var.storage_encrypted
  kms_key_id            = var.kms_key_id

  db_name     = replace("${var.project_name}_${var.environment}", "-", "_")
  username    = "aa_admin"
  port        = 5432
  multi_az    = var.environment == "prod"
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.main.name

  manage_master_user_password    = true
  master_user_secret_kms_key_id  = var.kms_key_id
  backup_retention_period        = var.environment == "prod" ? 30 : 7
  backup_window                  = "03:00-04:00"
  maintenance_window             = "mon:04:00-mon:05:00"
  deletion_protection            = var.environment == "prod"
  iam_database_authentication_enabled = true
  enabled_cloudwatch_logs_exports     = ["postgresql", "upgrade"]
  performance_insights_enabled        = true
  monitoring_interval                 = 60
  skip_final_snapshot                 = var.environment != "prod"

  tags = local.tags
}

output "db_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "db_instance_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "db_instance_arn" {
  description = "RDS instance ARN"
  value       = aws_db_instance.main.arn
}
