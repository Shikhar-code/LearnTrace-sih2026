import axios, { AxiosError } from 'axios';
import {
  AcademicClass,
  Subject,
  Chapter,
  Topic,
  SourceDocument,
  DocumentUploadResponse,
  DocumentChunk,
  BulkChunkTopicUpdateResponse,
  Assessment,
  Question,
  StartAttemptResponse,
  SubmitResponsePayload,
  SubmitResponseResult,
  FinishAttemptResponse,
  MasteryInputResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Helper for extracting readable error messages
export const getApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: string | { msg?: string }[] }>;
    if (axiosError.response?.data?.detail) {
      const detail = axiosError.response.data.detail;
      if (typeof detail === 'string') return detail;
      if (Array.isArray(detail) && detail.length > 0) {
        return detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
      }
    }
    if (axiosError.message) {
      if (axiosError.code === 'ERR_NETWORK') {
        return 'Cannot connect to backend API. Ensure the FastAPI server is running on http://127.0.0.1:8000.';
      }
      return axiosError.message;
    }
  }
  return (error as Error)?.message || 'An unexpected error occurred';
};

// Academic Hierarchy Endpoints
export const academicApi = {
  getClasses: async (): Promise<AcademicClass[]> => {
    const response = await apiClient.get<AcademicClass[]>('/academic/classes');
    return response.data;
  },

  getSubjects: async (classLevel: number): Promise<Subject[]> => {
    const response = await apiClient.get<Subject[]>('/academic/subjects', {
      params: { class_level: classLevel },
    });
    return response.data;
  },

  getChapters: async (subjectId: number): Promise<Chapter[]> => {
    const response = await apiClient.get<Chapter[]>('/academic/chapters', {
      params: { subject_id: subjectId },
    });
    return response.data;
  },

  getTopics: async (chapterId: number): Promise<Topic[]> => {
    const response = await apiClient.get<Topic[]>('/academic/topics', {
      params: { chapter_id: chapterId },
    });
    return response.data;
  },

  createTopic: async (chapterId: number, title: string): Promise<{ status: string; topic_id: number; title: string }> => {
    const response = await apiClient.post('/topics/', {
      chapter_id: chapterId,
      title,
    });
    return response.data;
  },
};

// Documents & Ingestion Endpoints
export const documentsApi = {
  getCatalogue: async (classLevel?: number, subjectName?: string): Promise<SourceDocument[]> => {
    const response = await apiClient.get<SourceDocument[]>('/documents/catalogue', {
      params: {
        ...(classLevel !== undefined ? { class_level: classLevel } : {}),
        ...(subjectName ? { subject_name: subjectName } : {}),
      },
    });
    return response.data;
  },

  uploadDocument: async (formData: FormData): Promise<DocumentUploadResponse> => {
    const response = await apiClient.post<DocumentUploadResponse>('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getChunks: async (documentId: number): Promise<DocumentChunk[]> => {
    const response = await apiClient.get<DocumentChunk[]>('/chunks/', {
      params: { document_id: documentId },
    });
    return response.data;
  },

  assignChunkTopic: async (chunkId: number, topicId: number): Promise<{ status: string; chunk_id: number; topic_id: number; topic: string }> => {
    const response = await apiClient.patch(`/chunks/${chunkId}/topic`, { topic_id: topicId });
    return response.data;
  },

  bulkAssignChunksTopic: async (chunkIds: number[], topicId: number): Promise<BulkChunkTopicUpdateResponse> => {
    const response = await apiClient.patch<BulkChunkTopicUpdateResponse>('/chunks/bulk-topic', {
      chunk_ids: chunkIds,
      topic_id: topicId,
    });
    return response.data;
  },
};

// Questions & Assessments Endpoints
export const assessmentApi = {
  getQuestionsByTopic: async (topicId: number): Promise<Question[]> => {
    const response = await apiClient.get<Question[]>('/questions/', {
      params: { topic_id: topicId },
    });
    return response.data;
  },

  getAssessment: async (assessmentId: number): Promise<Assessment> => {
    const response = await apiClient.get<Assessment>(`/assessments/${assessmentId}`);
    return response.data;
  },

  startAttempt: async (assessmentId: number, userId: number = 1): Promise<StartAttemptResponse> => {
    const response = await apiClient.post<StartAttemptResponse>('/attempts/', {
      user_id: userId,
      assessment_id: assessmentId,
    });
    return response.data;
  },

  submitResponse: async (attemptId: number, payload: SubmitResponsePayload): Promise<SubmitResponseResult> => {
    const response = await apiClient.post<SubmitResponseResult>(`/attempts/${attemptId}/responses`, payload);
    return response.data;
  },

  finishAttempt: async (attemptId: number): Promise<FinishAttemptResponse> => {
    const response = await apiClient.post<FinishAttemptResponse>(`/attempts/${attemptId}/finish`);
    return response.data;
  },
};

// Mastery Engine Endpoints
export const masteryApi = {
  getMasteryInput: async (attemptId: number): Promise<MasteryInputResponse> => {
    const response = await apiClient.get<MasteryInputResponse>(`/mastery/input/${attemptId}`);
    return response.data;
  },
};

// System Health
export const systemApi = {
  checkHealth: async (): Promise<boolean> => {
    try {
      const response = await apiClient.get('/health', { timeout: 3000 });
      return response.data?.status === 'healthy';
    } catch {
      return false;
    }
  },
};

