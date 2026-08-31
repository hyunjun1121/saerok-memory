import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertSupportedNodeVersion,
  hasManagedBlock,
  isSupportedNodeVersion,
  removeManagedBlock,
  setManagedBlock,
} from "./pi-setup-utils.mjs";

test("Pi runtime accepts pinned Node 24 LTS range only", () => {
  for (const version of ["v24.19.0", "24.19.1", "v24.20.0"]) {
    assert.equal(isSupportedNodeVersion(version), true, version);
    assert.doesNotThrow(() => assertSupportedNodeVersion(version));
  }
  for (const version of ["v20.19.2", "v22.13.0", "v23.11.1", "v24.18.9", "v25.0.0", "24.19", "v24.19.0-rc.1", ""]) {
    assert.equal(isSupportedNodeVersion(version), false, version);
    assert.throws(() => assertSupportedNodeVersion(version), />=24\.19\.0 <25/);
  }
});

test("managed Labwc block is additive, replaceable, and idempotent", () => {
  const original = "panel &\nbackground &\n";
  const first = setManagedBlock(original, "haru-kiosk", "'/opt/haru/start' 'ko' &");
  assert.match(first, /^panel &\nbackground &/);
  assert.equal(hasManagedBlock(first, "haru-kiosk"), true);
  assert.equal(setManagedBlock(first, "haru-kiosk", "'/opt/haru/start' 'ko' &"), first);

  const replaced = setManagedBlock(first, "haru-kiosk", "'/opt/haru/start' 'ja' &");
  assert.doesNotMatch(replaced, /'ko'/);
  assert.match(replaced, /'ja'/);
  assert.equal((replaced.match(/BEGIN HARU MANAGED/g) ?? []).length, 1);
  assert.equal(removeManagedBlock(replaced, "haru-kiosk"), original);
});

test("managed Labwc block fails closed on malformed or unsafe input", () => {
  assert.throws(
    () => setManagedBlock("# BEGIN HARU MANAGED: haru-kiosk\n", "haru-kiosk", "start &"),
    /Malformed managed block/,
  );
  assert.throws(() => setManagedBlock("", "../bad", "start &"), /Invalid managed block id/);
  assert.throws(() => setManagedBlock("", "haru-kiosk", "start\nsecond"), /one non-empty line/);
});

test("fresh Pi provision contract pins official ARM64 Node and kiosk safeguards", async () => {
  const [provision, bootstrap, launcher, autostartSetup, autostartLauncher, doctor, packageJson, nodeVersion] = await Promise.all([
    readFile(new URL("./provision-pi.sh", import.meta.url), "utf8"),
    readFile(new URL("./bootstrap-pi.sh", import.meta.url), "utf8"),
    readFile(new URL("./start-market.sh", import.meta.url), "utf8"),
    readFile(new URL("./autostart-pi.sh", import.meta.url), "utf8"),
    readFile(new URL("./autostart-launch.sh", import.meta.url), "utf8"),
    readFile(new URL("./doctor-pi.sh", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../.node-version", import.meta.url), "utf8"),
  ]);

  assert.match(provision, /NODE_VERSION="24\.19\.0"/);
  assert.match(provision, /01443c1e1a29e531ccad5a46fefa6df490d2189c49f7955904aecdbb0fe86fdc/);
  assert.match(provision, /SHASUMS256\.txt/);
  assert.match(provision, /sha256sum -c/);
  assert.match(provision, /--no-same-owner --strip-components=1/);
  assert.match(provision, /chown -R root:root/);
  assert.match(provision, /chmod 0755 "\$NODE_PARTIAL_ROOT"/);
  assert.match(provision, /Existing Node install must not be a symlink/);
  assert.match(provision, /\.partial\.XXXXXXXX/);
  assert.match(provision, /sudo mv -- "\$NODE_PARTIAL_ROOT" "\$NODE_INSTALL_ROOT"/);
  assert.match(provision, /! -user root/);
  assert.match(provision, /-perm \/022/);
  assert.match(provision, /apt-get -y full-upgrade/);
  assert.match(provision, /do_wayland W2/);
  assert.match(provision, /do_boot_behaviour B4/);
  assert.doesNotMatch(provision, /rpi-update/);
  assert.match(bootstrap, /pi-setup-utils\.mjs" check-node/);
  assert.match(bootstrap, /--include=dev --include=optional --ignore-scripts=false/);
  assert.doesNotMatch(bootstrap, /chmod \+x/);
  assert.match(launcher, /flock -n/);
  assert.match(launcher, /start\.lock/);
  assert.match(launcher, /--auto-accept-camera-and-microphone-capture/);
  assert.match(launcher, /--noerrdialogs/);
  assert.doesNotMatch(launcher, /--no-sandbox/);
  assert.match(autostartSetup, /bash "\$SCRIPT_DIR\/autostart-launch\.sh"/);
  assert.match(autostartLauncher, /for DISPLAY_ATTEMPT in 1 2 3 4 5 6 7 8 9 10/);
  assert.match(autostartLauncher, /starting Haru with the active desktop layout/);
  assert.match(doctor, /--kiosk/);
  assert.match(doctor, /--nfc/);
  assert.match(doctor, /Saved Haru display config missing/);
  assert.match(doctor, /autologin-user=/);
  assert.match(doctor, /autologin-session=/);
  assert.deepEqual(packageJson.engines, { node: ">=24.19.0 <25" });
  assert.equal(nodeVersion.trim(), "24.19.0");
});
