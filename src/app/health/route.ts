import { getReleaseIdentity } from "@/domain/release";

export function GET(): Response {
  return Response.json(
    {
      release: getReleaseIdentity(),
      service: "zhenghao-project-desk",
      status: "ok",
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
