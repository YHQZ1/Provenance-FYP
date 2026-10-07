{{- define "provenance.labels" -}}
app.kubernetes.io/part-of: provenance
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end }}

{{- define "provenance.selector" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end }}

{{- define "provenance.storageClass" -}}
{{- if .Values.storageClassName }}
storageClassName: {{ .Values.storageClassName | quote }}
{{- end }}
{{- end }}
