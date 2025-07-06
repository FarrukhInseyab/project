export interface Tag {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  expectedValue?: string;
  position?: {
    start: number;
    end: number;
  };
}

export interface IncomingData {
  [key: string]: any;
}

export interface Mapping {
  tagId: string;
  dataKey: string;
  dataValue: any;
  confidence?: number;
  isManual?: boolean;
}

export interface TemplateCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  sort_order?: number;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description?: string;
  originalFileName: string;
  documentContent: string;
  documentHtml: string;
  tags: Tag[];
  createdAt: Date | string;
  updatedAt: Date | string;
  category?: TemplateCategory;
  isDefault?: boolean;
  previewImage?: string;
  fileBuffer?: ArrayBuffer;
  originalFilePath?: string;
}

export interface AppState {
  currentStep: number;
  documentContent: string;
  documentHtml: string;
  originalFile?: File;
  tags: Tag[];
  incomingData: IncomingData;
  mappings: Mapping[];
  populatedContent: string;
  templates: DocumentTemplate[];
  selectedTemplate?: DocumentTemplate;
  podapiCustomerNos?: string[]; // Changed from podapiRecordIds to podapiCustomerNos
}

export interface AISuggestion {
  tagId: string;
  dataKey: string;
  confidence: number;
  reasoning: string;
}