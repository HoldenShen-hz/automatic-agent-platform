environment          = "prod"
db_instance_class   = "db.t3.large"
db_storage_gb       = 50
redis_node_type     = "cache.t3.medium"
eks_desired_nodes   = 3
eks_min_nodes       = 2
eks_max_nodes       = 10
eks_node_instance_types = ["t3.medium", "t3.large"]
