import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateRequestLetterFile,
  requestLetterUploadFile,
  REQUEST_LETTER_MAX_BYTES,
} from "../src/utils/saplingRequestWorkflow.js";

const TYPE_MESSAGE = "Please upload a PDF, JPG, JPEG, PNG, or DOCX file.";
const SIZE_MESSAGE = "File size must not exceed 10 MB.";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  docx: DOCX_MIME,
};

const file = (name, type, size = 1024) => ({ name, type, size });

// The validator's contract: returns "" when accepted, a message string when rejected.
test("accepts pdf, jpg, jpeg, png and docx with their MIME types", () => {
  for (const [extension, mime] of Object.entries(MIME_BY_EXTENSION)) {
    assert.equal(validateRequestLetterFile(file(`letter.${extension}`, mime)), "", extension);
  }
});

test("accepts an uppercase .DOCX extension", () => {
  assert.equal(validateRequestLetterFile(file("LETTER.DOCX", DOCX_MIME)), "");
});

test("rejects .doc, .exe and .txt with the type message", () => {
  assert.equal(validateRequestLetterFile(file("letter.doc", "application/msword")), TYPE_MESSAGE);
  assert.equal(validateRequestLetterFile(file("letter.exe", "application/x-msdownload")), TYPE_MESSAGE);
  assert.equal(validateRequestLetterFile(file("letter.txt", "text/plain")), TYPE_MESSAGE);
});

test("rejects an unsupported MIME type for an allowed extension", () => {
  assert.equal(validateRequestLetterFile(file("letter.docx", "text/plain")), TYPE_MESSAGE);
});

test("rejects an extension whose MIME type does not match", () => {
  assert.equal(validateRequestLetterFile(file("letter.docx", "application/pdf")), TYPE_MESSAGE);
  assert.equal(validateRequestLetterFile(file("letter.pdf", DOCX_MIME)), TYPE_MESSAGE);
  assert.equal(validateRequestLetterFile(file("letter.jpg", "image/png")), TYPE_MESSAGE);
});

test("empty MIME type falls back to extension-only validation", () => {
  assert.equal(validateRequestLetterFile(file("letter.docx", "")), "");
});

test("enforces the 10 MB limit on docx", () => {
  assert.equal(REQUEST_LETTER_MAX_BYTES, 10 * 1024 * 1024);
  assert.equal(
    validateRequestLetterFile(file("letter.docx", DOCX_MIME, REQUEST_LETTER_MAX_BYTES + 1)),
    SIZE_MESSAGE,
  );
  assert.equal(
    validateRequestLetterFile(file("letter.docx", DOCX_MIME, REQUEST_LETTER_MAX_BYTES)),
    "",
  );
});

test("missing file is rejected with the type message (current behaviour)", () => {
  assert.equal(validateRequestLetterFile(undefined), TYPE_MESSAGE);
  assert.equal(validateRequestLetterFile(null), TYPE_MESSAGE);
});

test("wizard accept attribute and hint mention DOCX and every accepted extension validates", () => {
  const source = readFileSync(
    new URL("../src/pages/ParticipantSaplingRequestWizard.jsx", import.meta.url),
    "utf8",
  );
  const accept = source.match(/accept="([^"]+)"/)?.[1];
  assert.ok(accept, "accept attribute found");
  assert.match(accept, /\.docx/);
  assert.match(source, /PDF, JPG, JPEG, PNG or DOCX/);

  const extensions = accept.split(",").map((part) => part.trim()).filter((part) => part.startsWith("."));
  assert.deepEqual(extensions, [".pdf", ".jpg", ".jpeg", ".png", ".docx"]);
  for (const dotExtension of extensions) {
    const extension = dotExtension.slice(1);
    assert.equal(
      validateRequestLetterFile(file(`letter${dotExtension}`, MIME_BY_EXTENSION[extension])),
      "",
      dotExtension,
    );
  }
});

test("upload helper assigns the matching MIME to an empty-type docx", async () => {
  const original = new File(["docx-bytes"], "letter.DOCX", { type: "" });
  const result = requestLetterUploadFile(original);
  assert.equal(result.type, DOCX_MIME);
  assert.equal(result.name, "letter.DOCX");
  assert.equal(result.size, original.size);
  assert.equal(await result.text(), "docx-bytes");
});

test("upload helper returns a typed file unchanged", () => {
  const typed = new File(["x"], "letter.docx", { type: DOCX_MIME });
  assert.equal(requestLetterUploadFile(typed), typed);
});

test("upload helper assigns application/pdf to an empty-type pdf", () => {
  assert.equal(requestLetterUploadFile(new File(["x"], "letter.pdf", { type: "" })).type, "application/pdf");
});
