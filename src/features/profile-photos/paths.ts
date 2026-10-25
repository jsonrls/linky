export const canonicalUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const managedAvatarPattern =
  /^\/api\/profile-photos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
export function managedAvatar(value: string) {
  const match = managedAvatarPattern.exec(value);
  // JavaScript's $ can match before a terminal newline; paths must be exact.
  return match?.[0] === value ? { profile: match[1], asset: match[2] } : null;
}
export function photoUrl(profile: string, asset: string) {
  return `/api/profile-photos/${profile}/${asset}`;
}
export function photoKey(profile: string, asset: string) {
  return `${profile}/${asset}.webp`;
}
export const photoBucket = "profile-photos";
export const photoByteLimit = 3 * 1024 * 1024;
