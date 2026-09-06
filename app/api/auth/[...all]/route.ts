import { auth } from "@/lib/auth"; // path to your auth file
import { NextRequest } from "next/server";

export const GET = async (req: NextRequest) => auth.handler(req);
export const POST = async (req: NextRequest) => auth.handler(req);
