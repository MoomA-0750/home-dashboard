import { test } from "node:test";
import assert from "node:assert/strict";
import { isInternalAddress, isPublicHost } from "./destination";

test("家の中・この機械・リンクローカルの宛先は外ではない", () => {
  for (const address of ["127.0.0.1", "10.0.0.5", "192.168.1.10", "172.20.1.1", "169.254.169.254", "100.101.1.2", "0.0.0.0", "::1", "fe80::1", "fd12::3", "::ffff:192.168.0.1"])
    assert.equal(isInternalAddress(address), true, address);
  for (const address of ["8.8.8.8", "17.57.155.1", "172.32.0.1", "2001:4860:4860::8888"]) assert.equal(isInternalAddress(address), false, address);
});

test("IPv4 を IPv6 に写した書き方でも、中の IPv4 で判定する", () => {
  // URL は [::ffff:127.0.0.1] を [::ffff:7f00:1] に直すので、16 進の形も読む
  for (const address of ["::ffff:7f00:1", "::ffff:c0a8:1", "::7f00:1", "::127.0.0.1", "64:ff9b::a00:1", "2002:c0a8:1::", "198.18.0.1", "0:0:0:0:0:0:0:1", "::"])
    assert.equal(isInternalAddress(address), true, address);
  for (const address of ["::ffff:808:808", "64:ff9b::808:808", "2002:808:808::1"]) assert.equal(isInternalAddress(address), false, address);
  assert.equal(new URL("https://[::ffff:127.0.0.1]/").hostname, "[::ffff:7f00:1]");
});

test("名前は引いてから判定し、家の中を指す名前は断る", async () => {
  assert.equal(await isPublicHost("localhost"), false);
  assert.equal(await isPublicHost("printer.local"), false);
  assert.equal(await isPublicHost("192.168.0.1"), false);
  assert.equal(await isPublicHost("1.1.1.1"), true);
});
