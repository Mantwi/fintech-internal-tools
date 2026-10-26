import { handle } from "@/lib/api";
import { listDemoUsers } from "@/lib/users";

export async function GET() {
  return handle(async () => ({ users: await listDemoUsers() }));
}
