from enum import Enum


class ConfigType(str, Enum):
    BOOLEAN = "boolean"
    STRING = "string"
    INT = "int"
    FLOAT = "float"
    JSON = "json"
    KEY = "key"


class ConfigCategory(str, Enum):
    GENERAL = "GENERAL"
    SCAN = "SCAN"
    PUBLISH = "PUBLISH"


CONFIG_DEFAULTS = [
    {
        "config_key": "catalog_name",
        "config_value": "default",
        "config_value_type": ConfigType.STRING,
        "config_label": "Default Catalog Name",
        "config_desc": "The Unity Catalog catalog that LakeMind scans by default.",
        "config_category": ConfigCategory.GENERAL,
        "extended_values": None,
        "config_show": 1,
    },
    {
        "config_key": "dbx_cloud",
        "config_value": "azure",
        "config_value_type": ConfigType.STRING,
        "config_label": "Databricks Cloud",
        "config_desc": "The cloud provider for this Databricks workspace (aws | azure | gcp).",
        "config_category": ConfigCategory.GENERAL,
        "extended_values": None,
        "config_show": 1,
    },
    {
        "config_key": "scan_ai_model",
        "config_value": "databricks-meta-llama-3-1-70b-instruct",
        "config_value_type": ConfigType.STRING,
        "config_label": "Scan AI Model",
        "config_desc": "The Databricks model serving endpoint used for AI-powered entity detection and metric proposal.",
        "config_category": ConfigCategory.SCAN,
        "extended_values": None,
        "config_show": 1,
    },
    {
        "config_key": "confidence_threshold",
        "config_value": "0.7",
        "config_value_type": ConfigType.FLOAT,
        "config_label": "Confidence Threshold",
        "config_desc": "Minimum confidence score for AI-proposed metrics and dimensions to be shown for review.",
        "config_category": ConfigCategory.SCAN,
        "extended_values": None,
        "config_show": 1,
    },
    {
        "config_key": "auto_approve_threshold",
        "config_value": "0.95",
        "config_value_type": ConfigType.FLOAT,
        "config_label": "Auto-approve Threshold",
        "config_desc": "Proposals above this confidence score are auto-approved without human review.",
        "config_category": ConfigCategory.SCAN,
        "extended_values": None,
        "config_show": 1,
    },
    {
        "config_key": "genie_token_limit",
        "config_value": "4096",
        "config_value_type": ConfigType.INT,
        "config_label": "Genie Token Limit",
        "config_desc": "Maximum token count for generated Genie workspace instructions.",
        "config_category": ConfigCategory.PUBLISH,
        "extended_values": None,
        "config_show": 1,
    },
]
