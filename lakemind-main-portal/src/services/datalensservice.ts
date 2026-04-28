import { api } from "@/lib/api";

export interface DatalensThought {
  content: string;
  thought_type: string;
}

export interface DatalensAttachment {
  id: string;
  type: "text" | "query" | "suggested_questions";
  content?: string;
  title?: string;
  description?: string;
  sql?: string;
  statement_id?: string;
  questions?: string[];
  thoughts?: DatalensThought[];
  row_count?: number;
}

export interface DatalensMessage {
  message_id: string;
  conversation_id: string;
  space_id: string;
  content: string;
  status: string;
  attachments: DatalensAttachment[];
  created_at: number;
}

const DatalensService = {
  ask: async (spaceId: string, question: string): Promise<DatalensMessage> => {
    const res = await api.post("/api/datalens/ask", {
      space_id: spaceId,
      question,
    });
    return res.data;
  },

  followUp: async (
    spaceId: string,
    conversationId: string,
    message: string
  ): Promise<DatalensMessage> => {
    const res = await api.post("/api/datalens/follow-up", {
      space_id: spaceId,
      conversation_id: conversationId,
      message,
    });
    return res.data;
  },

  getQueryResult: async (
    spaceId: string,
    conversationId: string,
    messageId: string
  ): Promise<any> => {
    const res = await api.post("/api/datalens/query-result", {
      space_id: spaceId,
      conversation_id: conversationId,
      message_id: messageId,
    });
    return res.data;
  },

  getStatementResult: async (
    statementId: string
  ): Promise<{ columns: { name: string; type: string }[]; rows: string[][] }> => {
    const res = await api.post("/api/datalens/statement-result", {
      statement_id: statementId,
    }, false);
    return res.data;
  },
};

export default DatalensService;
