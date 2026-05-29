export function useComplianceVm() {
    return {
        metrics: [
            { label: "标准项", value: 5 },
            { label: "待处理检查", value: 12 },
            { label: "通过率", value: "87%" },
        ],
        rows: [
            { key: "模式", value: "GDPR / SOX / HIPAA" },
            { key: "字段策略", value: "字段级脱敏与导出水印" },
            { key: "审计轨迹", value: "通过规划中的接缝接入不可变审计时间线" },
        ],
        items: [
            { title: "运行检查", description: "按标准批量运行检查并回看最近审计结果。" },
            { title: "导出报告", description: "导出合规报告与证据包，保留脱敏与审批信息。" },
            { title: "升级处理", description: "高风险不合规项升级给治理负责人和域管理员。" },
        ],
    };
}
