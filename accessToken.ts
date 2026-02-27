import { readFileSync, writeFileSync } from "node:fs";
import sdk from "@vector-im/matrix-bot-sdk";

const existingContent = readFileSync(".env", "utf-8");

if (
	!process.env.MATRIX_INSTANCE ||
	!process.env.MATRIX_USER ||
	!process.env.MATRIX_PASSWORD
) {
	console.log("missing env keys");
	process.exit();
}
const auth = new sdk.MatrixAuth(process.env.MATRIX_INSTANCE);
const response = await auth.passwordLogin(
	process.env.MATRIX_USER,
	process.env.MATRIX_PASSWORD,
);
const envContent = `MATRIX_ACCESS_TOKEN=${response.accessToken}`;
const updatedContent = existingContent.includes("MATRIX_ACCESS_TOKEN")
	? existingContent.replace(/MATRIX_ACCESS_TOKEN=.*/g, envContent)
	: `${existingContent}\n${envContent}`;
writeFileSync(".env", updatedContent);
