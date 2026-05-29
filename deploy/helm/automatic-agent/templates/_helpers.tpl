{{/*
Expand the name of the chart.
*/}}
{{- define "automatic-agent.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "automatic-agent.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version.
*/}}
{{- define "automatic-agent.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "automatic-agent.labels" -}}
helm.sh/chart: {{ include "automatic-agent.chart" . }}
{{ include "automatic-agent.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "automatic-agent.selectorLabels" -}}
app.kubernetes.io/name: {{ include "automatic-agent.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use.
*/}}
{{- define "automatic-agent.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "automatic-agent.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Whether a secret-backed env source will exist for the release.
*/}}
{{- define "automatic-agent.hasSecretEnv" -}}
{{- if .Values.externalSecret.enabled -}}
true
{{- else if or .Values.secrets.AA_API_JWT_SECRET .Values.secrets.ANTHROPIC_API_KEY .Values.secrets.OPENAI_API_KEY .Values.secrets.MINIMAX_API_KEY .Values.secrets.AA_STORAGE_POSTGRES_DSN -}}
true
{{- else -}}
false
{{- end -}}
{{- end }}
