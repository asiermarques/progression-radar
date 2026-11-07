// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CsvError, detectLineBreak, formatRow, parseCsv, splitHeader } from "./csv";

describe("formatRow", () => {
  it("joins the fields with the separator", () => {
    expect(formatRow(["a", "b", ""], ",")).toBe("a,b,");
  });

  it("quotes the values that contain the separator, a quote or a line break, doubling the quotes", () => {
    expect(formatRow(["García, Ana", 'say "hi"', "two\nlines", "plain"], ",")).toBe(
      '"García, Ana","say ""hi""","two\nlines",plain',
    );
  });

  it("quotes for the separator in use only", () => {
    expect(formatRow(["a;b", "c,d"], ";")).toBe('"a;b";c,d');
    expect(formatRow(["a;b", "c,d"], ",")).toBe('a;b,"c,d"');
  });
});

describe("parseCsv", () => {
  it("reads records with the line where each starts", () => {
    expect(parseCsv("id,name\nana,Ana\nluis,Luis\n", ",")).toEqual([
      { fields: ["id", "name"], line: 1 },
      { fields: ["ana", "Ana"], line: 2 },
      { fields: ["luis", "Luis"], line: 3 },
    ]);
  });

  it("reads quoted values: separators, doubled quotes and line breaks inside", () => {
    const records = parseCsv('id,name\nana,"García, Ana"\nluis,"say ""hi"""\nmar,"two\nlines"\nend,x\n', ",");
    expect(records.map((record) => record.fields)).toEqual([
      ["id", "name"],
      ["ana", "García, Ana"],
      ["luis", 'say "hi"'],
      ["mar", "two\nlines"],
      ["end", "x"],
    ]);
    expect(records.map((record) => record.line)).toEqual([1, 2, 3, 4, 6]);
  });

  it("accepts \\r\\n and \\n, with or without a final line break", () => {
    expect(parseCsv("a,b\r\nc,d", ",").map((record) => record.fields)).toEqual([["a", "b"], ["c", "d"]]);
    expect(parseCsv("a,b\nc,d\n", ",").map((record) => record.fields)).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("keeps empty cells, and skips blank lines", () => {
    expect(parseCsv("a,b,c\n\n,,\n", ",")).toEqual([
      { fields: ["a", "b", "c"], line: 1 },
      { fields: ["", "", ""], line: 3 },
    ]);
  });

  it("reads ; as the separator", () => {
    expect(parseCsv('id;name\nana;"García; Ana"\n', ";").map((record) => record.fields)).toEqual([
      ["id", "name"],
      ["ana", "García; Ana"],
    ]);
  });

  it("is a CsvError with the line when a quote is never closed", () => {
    expect(() => parseCsv('id,name\nana,"García\nluis,Luis\n', ",")).toThrow(CsvError);
    expect(() => parseCsv('id,name\nana,"García\nluis,Luis\n', ",")).toThrow("line 2");
  });

  it("is a CsvError when a quote opens in the middle of a value", () => {
    expect(() => parseCsv('id,name\nana,Ga"rcía\n', ",")).toThrow("line 2");
  });
});

describe("splitHeader", () => {
  it("uses , when it splits the header into columns that include id", () => {
    expect(splitHeader("id,name,role")).toEqual({ separator: ",", columns: ["id", "name", "role"] });
  });

  it("uses ; when that is the one that finds id", () => {
    expect(splitHeader("id;name;role")).toEqual({ separator: ";", columns: ["id", "name", "role"] });
  });

  it("falls back to , when neither finds id, so the missing id can be reported", () => {
    expect(splitHeader("name;role")).toEqual({ separator: ",", columns: ["name;role"] });
  });

  it("is ambiguous when both separators find id but split the header differently", () => {
    expect(() => splitHeader("id,a;id")).toThrow(CsvError);
  });

  it("does not mind which separator when both read the same columns", () => {
    expect(splitHeader("id")).toEqual({ separator: ",", columns: ["id"] });
  });
});

describe("detectLineBreak", () => {
  it("is \\r\\n when the text uses it and \\n otherwise", () => {
    expect(detectLineBreak("a\r\nb\r\n")).toBe("\r\n");
    expect(detectLineBreak("a\nb\n")).toBe("\n");
    expect(detectLineBreak("")).toBe("\n");
  });
});
