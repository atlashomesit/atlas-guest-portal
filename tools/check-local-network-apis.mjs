import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

const distDir = path.resolve(process.cwd(), "dist");

if (!fs.existsSync(distDir)) {
  console.error("dist/ not found. Run the build before running this check.");
  process.exit(1);
}

const files = await glob("**/*.{js,html,css}", {
  cwd: distDir,
  nodir: true,
  absolute: true,
});

const patterns = [
  { label: "RTCPeerConnection", regex: /RTCPeerConnection/ },
  { label: "getUserMedia", regex: /getUserMedia/ },
  { label: "navigator.mediaDevices", regex: /navigator\.mediaDevices/ },
  { label: "navigator.bluetooth", regex: /navigator\.bluetooth/ },
  { label: "navigator.usb", regex: /navigator\.usb/ },
  { label: "navigator.serial", regex: /navigator\.serial/ },
  { label: "chrome.cast", regex: /chrome\.cast/ },
  { label: "mDNS/bonjour/upnp", regex: /\b(mdns|bonjour|upnp)\b/i },
  {
    label: "local network URL",
    regex:
      /https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})(?:[:/]|$)/i,
  },
  {
    label: ".local URL",
    regex: /https?:\/\/[^\s"']+\.local(?:[:/]|$)/i,
  },
];

const findings = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  for (const pattern of patterns) {
    if (pattern.regex.test(content)) {
      findings.push({ file, label: pattern.label });
    }
  }
}

if (findings.length > 0) {
  console.error("Local network or device access references detected in the bundle:");
  for (const finding of findings) {
    console.error(`- ${finding.label}: ${path.relative(process.cwd(), finding.file)}`);
  }
  process.exit(1);
}

console.log("Local network/device access scan passed.");
