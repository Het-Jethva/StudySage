export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
  }
  
  export interface StudyTip {
    tip: string;
    icon: string;
  }
  
  export interface SuggestedQuestion {
    question: string;
    mode: string;
  }