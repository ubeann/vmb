import { beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for Neon's WebSocket `Client`: it records what it was asked to do,
// so the test can see each connection opened, used and closed without a socket.
const clients = vi.hoisted(() => [] as FakeClient[]);

type FakeClient = { url: string; log: string[]; ended: boolean };

vi.mock("@neondatabase/serverless", async (importOriginal) => {
  const original = await importOriginal<typeof import("@neondatabase/serverless")>();
  class Client {
    readonly record: FakeClient;
    constructor(url: string) {
      this.record = { url, log: [], ended: false };
      clients.push(this.record);
    }
    async connect() {
      this.record.log.push("connect");
    }
    async query(query: string | { text: string }) {
      this.record.log.push((typeof query === "string" ? query : query.text).trim());
      return { rows: [], fields: [], rowCount: 0, command: "" };
    }
    async end() {
      this.record.ended = true;
    }
  }
  return { ...original, Client };
});

const { createTransactionOpener } = await import("../src/client.js");

describe("the Worker's transaction opener (ADR-0049)", () => {
  const URL = "postgres://neon.test/vmb";
  let closing: Promise<unknown>[];
  const waitUntil = (promise: Promise<unknown>) => void closing.push(promise);

  beforeEach(() => {
    closing = [];
  });

  it("opens no connection until a transaction is asked for", () => {
    createTransactionOpener(URL, waitUntil);
    expect(clients).toHaveLength(0);
  });

  it("opens a connection per transaction, and closes it after the reply through waitUntil", async () => {
    const open = createTransactionOpener(URL, waitUntil);

    const result = await open(async (tx) => {
      await tx.execute("select 1");
      // the connection is still open while the work runs
      expect(clients.at(-1)?.ended).toBe(false);
      return "done";
    });
    await open(async () => undefined);

    expect(result).toBe("done");
    const [first, second] = clients.slice(-2);
    expect(first).not.toBe(second);
    expect(first?.url).toBe(URL);
    expect(first?.log).toEqual(["connect", "begin", "select 1", "commit"]);
    expect(closing).toHaveLength(2);
    await Promise.all(closing);
    expect(first?.ended && second?.ended).toBe(true);
  });

  it("rolls back and still closes the connection when the work throws", async () => {
    const open = createTransactionOpener(URL, waitUntil);

    await expect(
      open(async () => {
        throw new Error("refused");
      })
    ).rejects.toThrow("refused");

    expect(clients.at(-1)?.log).toEqual(["connect", "begin", "rollback"]);
    expect(closing).toHaveLength(1);
  });
});
