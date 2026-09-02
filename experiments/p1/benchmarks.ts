import type { RetrievalCase } from "./types";

export const mybatisCases: RetrievalCase[] = [
  {
    id: "mybatis-transaction-mechanism",
    query: "推荐使用什么方式管理数据库事务？",
    expectedTerms: ["transaction"],
  },
  {
    id: "mybatis-http-rpc",
    query: "事务方法中为什么不应该执行 HTTP 或 RPC 调用？",
    expectedTerms: ["http", "rpc"],
  },
  {
    id: "mybatis-concurrency",
    query: "更新业务状态时如何处理并发修改？",
    expectedTerms: ["并发"],
  },
  {
    id: "mybatis-message-consistency",
    query: "数据库事务与 MQ 消息如何保证一致性？",
    expectedTerms: ["消息"],
  },
  {
    id: "mybatis-index-lock",
    query: "更新条件没有索引时有什么锁风险？",
    expectedTerms: ["索引", "锁"],
  },
];

export const rfcCases: RetrievalCase[] = [
  {
    id: "rfc-opening-handshake",
    query: "How does the WebSocket opening handshake use Upgrade and Sec-WebSocket-Key?",
    expectedTerms: ["upgrade", "sec-websocket-key"],
  },
  {
    id: "rfc-masking",
    query: "What are the client-to-server masking requirements?",
    expectedTerms: ["masking key"],
  },
  {
    id: "rfc-ping-pong",
    query: "How must a peer respond to a Ping frame?",
    expectedTerms: ["pong"],
  },
  {
    id: "rfc-closing",
    query: "How is the WebSocket closing handshake performed?",
    expectedTerms: ["close frame"],
  },
  {
    id: "rfc-origin-security",
    query: "How is the Origin header used for browser security?",
    expectedTerms: ["origin"],
  },
];
