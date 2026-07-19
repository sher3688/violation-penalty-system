import { describe, expect, it } from "vitest";
import { selectNoticePhotoSlots } from "../shared/noticePhotoSlots";

describe("selectNoticePhotoSlots", () => {
  it("僅有一張照片時只回傳左側照片，不建立右側照片框", () => {
    const photo = { id: 1, storageKey: "single-photo.jpg" };

    expect(selectNoticePhotoSlots([photo])).toEqual({
      leftPhoto: photo,
      rightPhoto: undefined,
    });
  });

  it("有兩張照片時依序提供左側橫式與右側直式照片", () => {
    const first = { id: 1, storageKey: "first.jpg" };
    const second = { id: 2, storageKey: "second.jpg" };

    expect(selectNoticePhotoSlots([first, second])).toEqual({
      leftPhoto: first,
      rightPhoto: second,
    });
  });
});
