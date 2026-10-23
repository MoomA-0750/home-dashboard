import { test } from "node:test";
import assert from "node:assert/strict";

// config は読み込んだ時点の環境変数で決まるので、トークンを決めずに読み込む
delete process.env.VOICE_AGENT_TOKEN;
const { agentBearerMatches, agentTokenMatches } = await import("./agentToken.js");

test("トークンを決めていなければ、誰も通さない（何も添えなくても・空でも）", () => {
  assert.equal(agentTokenMatches(undefined), false);
  assert.equal(agentTokenMatches(""), false);
  assert.equal(agentTokenMatches("anything"), false);
  assert.equal(agentBearerMatches("Bearer anything"), false);
  assert.equal(agentBearerMatches(undefined), false);
});
