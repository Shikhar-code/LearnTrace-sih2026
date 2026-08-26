// ==========================================
// LearnTrace Intelligence Engine Types
// Schemas: LEARNTRACE_FRONTEND_V1 & LEARNTRACE_ADMIN_HEATMAP_V1
// ==========================================

export const LEARNTRACE_FRONTEND_SCHEMA_V1 = "LEARNTRACE_FRONTEND_V1" as const;
export const LEARNTRACE_ADMIN_HEATMAP_SCHEMA_V1 =
  "LEARNTRACE_ADMIN_HEATMAP_V1" as const;

export type AssessmentType =
  | "diagnostic"
  | "reassessment"
  | "general"
  | "practice";

export type MasteryTier =
  | "CRITICAL_GAP"
  | "EMERGING"
  | "DEVELOPING"
  | "PROFICIENT"
  | "MASTERED"
  | "UNKNOWN";

export type ConfidenceLabel = "LOW" | "MEDIUM" | "HIGH" | null;

export type NextActionType =
  | "LEARN_CURRENT_STEP"
  | "TAKE_DIAGNOSTIC"
  | "REVIEW_TARGET"
  | "MAINTAIN_MASTERY";

export interface NextAction {
  type: NextActionType;
  concept_id: string;
  label: string;
}

export interface ConceptMasteryCard {
  id: string;
  label: string;
  assessed: boolean;
  mastery_probability: number | null;
  mastery_score: number | null;
  tier: MasteryTier;
  confidence: number | null;
  confidence_label: ConfidenceLabel;
  can_progress: boolean;
}

export type GraphNodeRole =
  | "TARGET"
  | "ROOT_CAUSE"
  | "CONTRIBUTOR"
  | "DIAGNOSTIC_REQUIRED"
  | "PATH_CURRENT"
  | "PATH_READY"
  | "PATH_LOCKED"
  | "PATH_COMPLETED"
  | "PATH_DIAGNOSTIC_REQUIRED"
  | string;

export interface GraphNode extends ConceptMasteryCard {
  level: number;
  roles: GraphNodeRole[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  in_root_trace: boolean;
  in_learning_path: boolean;
}

export interface GraphView {
  direction: "PREREQUISITE_TO_DEPENDENT" | string;
  node_count: number;
  edge_count: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface LearnerGraphs {
  competency: GraphView;
  root_cause: GraphView;
}

export type StepStatus =
  | "CURRENT"
  | "READY"
  | "LOCKED"
  | "COMPLETED"
  | "DIAGNOSTIC_REQUIRED";

export interface LearningPathStep {
  concept_id: string;
  label: string;
  position: number;
  status: StepStatus;
  mastery_probability: number | null;
  mastery_score: number | null;
  tier: string;
  target_mastery: number;
  blocked_by: string[];
  estimated_minutes: number | null;
}

export interface LearningPath {
  target_id: string;
  version: number;
  steps: LearningPathStep[];
}

export interface AssessmentScoreProgress {
  attempt_id: number;
  assessment_type: AssessmentType | string;
  score: number;
  completed: boolean;
}

export interface ConceptImprovement {
  concept_id: string;
  label: string;
  change: number;
  change_percentage_points: number;
}

export interface LearnerProgress {
  assessment_scores: AssessmentScoreProgress[];
  concept_improvement: ConceptImprovement[];
}

export interface LearnerSummary {
  target: ConceptMasteryCard;
  readiness_score: number | null;
  readiness_formula: "CONFIDENCE_WEIGHTED_MEAN" | string;
  strongest_concepts: ConceptMasteryCard[];
  weakest_concepts: ConceptMasteryCard[];
  root_gap_probability: number;
  next_action: NextAction;
}

export interface LearnerFrontendPayload {
  schema_version: typeof LEARNTRACE_FRONTEND_SCHEMA_V1 | string;
  summary: LearnerSummary;
  mastery_profile: ConceptMasteryCard[];
  graphs: LearnerGraphs;
  learning_path: LearningPath | null;
  progress: LearnerProgress;
}

// ----------------------------------------------------
// Raw / Explainability Engine Response (Full Wrapper)
// ----------------------------------------------------

export interface ConceptEvidence {
  concept_id: string;
  response_count: number;
  correct_count: number;
  effective_evidence: number;
  overall_accuracy: number;
  difficulty_weighted_accuracy: number;
  recent_accuracy_5: number;
  recent_failure_rate: number;
  hard_accuracy: number;
  hint_usage_rate: number | null;
  mean_retry_count: number | null;
  mean_response_time_ratio: number | null;
  improvement_slope: number;
  high_quality_evidence_share: number;
  reassessment_delta: number | null;
  difficulty_band_coverage: number;
  missing_features: string[];
}

export interface MasteryEstimateRaw {
  concept_id: string;
  probability: number | null;
  confidence: number;
  confidence_label: string;
  tier: MasteryTier | null;
  estimator: string;
  statistical_probability: number | null;
  model_probability: number | null;
  effective_evidence: number;
  explanations: string[];
}

export interface RootCauseCandidate {
  concept_id: string;
  branch_id: string;
  posterior_probability: number;
  evidence_confidence: number;
  gap_probability: number;
  upstream_explanation: number;
  target_influence: number;
  graph_distance: number;
  role: string;
  reasons: string[];
}

export interface RootCauseAnalysisRaw {
  target_concept_id: string;
  target_gap_probability: number;
  root_causes: RootCauseCandidate[];
  contributing_gaps: RootCauseCandidate[];
  unexplained_probability: number;
  diagnostic_required_concept_ids: string[];
  algorithm_version: string;
}

export interface IntelligenceIntegrationInfo {
  attempt_ids: number[];
  user_id: number;
  curriculum_version: string;
  warnings: string[];
}

export interface IntelligenceAnalysisResponse {
  target_concept_id: string;
  evidence: Record<string, ConceptEvidence>;
  mastery: Record<string, MasteryEstimateRaw>;
  gaps: RootCauseAnalysisRaw;
  learning_path: {
    target_id: string;
    version: number;
    steps: Array<{
      concept_id: string;
      position: number;
      status: StepStatus;
      mastery: number | null;
      tier: string;
      target_mastery: number;
      blocked_by: string[];
      root_probability: number | null;
      estimated_minutes: number | null;
      explanations: string[];
    }>;
  } | null;
  integration: IntelligenceIntegrationInfo;
  frontend: LearnerFrontendPayload;
}

// ----------------------------------------------------
// Admin Cohort Heatmap Schema & Types
// ----------------------------------------------------

export interface AdminHeatmapScope {
  class_id: string;
  subject_id: string;
}

export interface AdminHeatmapSummary {
  student_count: number;
  concept_count: number;
  assessed_cell_count: number;
  coverage_percentage: number;
  average_readiness_score: number | null;
  next_action_counts: Record<string, number>;
  tier_distribution: Record<string, number>;
}

export interface AdminHeatmapScale {
  value_field: string;
  minimum: number;
  maximum: number;
  unknown: null;
  progression_gate: number;
  mastered_gate: number;
}

export interface AdminHeatmapColumn {
  concept_id: string;
  label: string;
  position: number;
}

export interface AdminHeatmapCell {
  concept_id: string;
  assessed: boolean;
  mastery_probability: number | null;
  mastery_score: number | null;
  tier: MasteryTier;
  confidence: number | null;
  can_progress: boolean;
  is_root_gap: boolean;
}

export interface AdminHeatmapRow {
  user_id: number;
  target_concept_id: string;
  readiness_score: number | null;
  next_action: NextAction;
  cells: AdminHeatmapCell[];
}

export interface AdminHeatmapConceptSummary {
  concept_id: string;
  label: string;
  assessed_students: number;
  unknown_students: number;
  average_mastery_score: number | null;
  median_mastery_score: number | null;
  at_risk_students: number;
  can_progress_students: number;
  root_gap_students: number;
  tier_distribution: Record<string, number>;
}

export interface AdminHeatmapRootGapDistribution {
  concept_id: string;
  label: string;
  student_count: number;
  student_percentage: number;
}

export interface AdminHeatmapPayload {
  schema_version: typeof LEARNTRACE_ADMIN_HEATMAP_SCHEMA_V1 | string;
  scope: AdminHeatmapScope;
  summary: AdminHeatmapSummary;
  scale: AdminHeatmapScale;
  columns: AdminHeatmapColumn[];
  rows: AdminHeatmapRow[];
  concept_summary: AdminHeatmapConceptSummary[];
  root_gap_distribution: AdminHeatmapRootGapDistribution[];
}

// ----------------------------------------------------
// Request Payloads for API Client
// ----------------------------------------------------

export interface AttemptAnalysisInput {
  attempt_id: number;
  assessment_type?: AssessmentType;
}

export interface IntelligenceAnalysisRequest {
  attempts: AttemptAnalysisInput[];
  target_concept_id?: string | null;
}
