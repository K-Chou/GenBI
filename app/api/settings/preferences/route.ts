import { NextResponse } from "next/server";
import { getUserPreferenceMemory, saveUserPreferenceMemory } from "@/lib/file-store";
import type { UserPreferenceMemory } from "@/lib/types";

function createEmptyMemory(): UserPreferenceMemory {
  return {
    businessPreferences: [],
    chartPreferences: [],
    layoutPreferences: [],
    negativePreferences: [],
    updatedAt: new Date().toISOString(),
    visualPreferences: [],
  };
}

function getUserId(request: Request) {
  return request.headers.get("x-genbi-user-id") ?? request.headers.get("x-artifactdash-user-id") ?? "default";
}

export async function GET(request: Request) {
  return NextResponse.json((await getUserPreferenceMemory(getUserId(request))) ?? createEmptyMemory());
}

export async function DELETE(request: Request) {
  const memory = createEmptyMemory();
  await saveUserPreferenceMemory(memory, getUserId(request));
  return NextResponse.json(memory);
}
