export function resolveApiUrl(platform: App.Platform | undefined): string {
  return platform?.env?.API_URL ?? "http://localhost:8787";
}
