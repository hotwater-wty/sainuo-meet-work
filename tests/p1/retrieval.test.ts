import { describe, expect, it } from "vitest";
import { LocalRetriever } from "../../experiments/p1/retrieval.js";

describe("LocalRetriever", () => {
  const retriever = new LocalRetriever([
    {
      id: "S1",
      text: "Clients MUST mask all frames sent to the server using a masking key.",
      headingPath: ["Masking"],
      containsCode: false,
    },
    {
      id: "S2",
      text: "事务方法中不要执行 HTTP 或 RPC 远程调用，避免长事务。",
      headingPath: ["事务边界"],
      containsCode: false,
    },
  ]);

  it("retrieves Latin protocol terms", () => {
    expect(retriever.search("masking key")[0]?.id).toBe("S1");
  });

  it("retrieves Chinese bigrams and identifiers", () => {
    expect(retriever.search("事务里的 RPC 调用")[0]?.id).toBe("S2");
  });
});
