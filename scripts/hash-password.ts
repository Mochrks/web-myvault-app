import readline from "node:readline";
import { hashVaultPassword } from "../src/lib/auth/password";

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        data += chunk;
      });
      process.stdin.on("end", () => resolve(data.trimEnd()));
      process.stdin.on("error", reject);
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const stdin = process.stdin;
    let muted = false;

    const onData = (char: Buffer) => {
      const str = char.toString("utf8");
      if (str === "\n" || str === "\r" || str === "\u0004") {
        muted = false;
      } else if (muted) {
        process.stdout.write("\r" + question + "*".repeat(rl.line.length));
      }
    };

    muted = true;
    stdin.on("data", onData);

    rl.question(question, (answer) => {
      muted = false;
      stdin.removeListener("data", onData);
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const password = await promptHidden("Enter vault password to hash: ");
  if (!password || password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const encoded = await hashVaultPassword(password);
  console.log("\nGenerated Argon2id hash (add to VAULT_PASSWORD_HASH):");
  console.log(encoded);
}

main().catch((err) => {
  console.error("Failed to generate password hash:", err instanceof Error ? err.message : "Unknown error");
  process.exit(1);
});
