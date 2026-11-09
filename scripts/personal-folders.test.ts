// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isInsideFolders } from "./personal-folders";

const folders = ["/work/ladder/reports", "/work/ladder/snapshots"];
const blocked = (url: string) => isInsideFolders(url, "/work/ladder", folders);

describe("isInsideFolders", () => {
  it("blocks the files of the folders, by their URL under the root and with /@fs/", () => {
    expect(blocked("/reports/2026-11-09.html")).toBe(true);
    expect(blocked("/snapshots/2026-11-09.csv?import")).toBe(true);
    expect(blocked("/@fs/work/ladder/reports/2026-11-09.html")).toBe(true);
  });

  it("blocks the folders written with encodings and dot segments", () => {
    expect(blocked("/%72eports/a.html")).toBe(true);
    expect(blocked("/src/../reports/a.html")).toBe(true);
    expect(blocked("/@fs/work/ladder/src/../reports/a.html")).toBe(true);
    expect(blocked("/reports")).toBe(true);
  });

  it("lets everything else through, also folders that only start with the same letters", () => {
    expect(blocked("/")).toBe(false);
    expect(blocked("/src/main.tsx")).toBe(false);
    expect(blocked("/reports-guide/a.html")).toBe(false);
    expect(blocked("/@fs/work/ladder/config/theme.css")).toBe(false);
    expect(blocked("/%E0%A4%A")).toBe(false);
  });
});
