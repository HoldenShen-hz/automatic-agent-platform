environment          = "staging"
db_instance_class   = "db.t3.medium"
db_storage_gb       = 20
redis_node_type     = "cache.t3.micro"
eks_desired_nodes   = 2
eks_min_nodes       = 1
eks_max_nodes       = 4
eks_node_instance_types = ["t3.medium"]
