export function selectNoticePhotoSlots<T>(photos: readonly T[]) {
  return {
    leftPhoto: photos[0],
    rightPhoto: photos.length > 1 ? photos[1] : undefined,
  };
}
