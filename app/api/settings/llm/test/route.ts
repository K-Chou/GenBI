import { NextResponse } from "next/server";
import { completeChat } from "@/services/deepseek";

export async function POST() {
  try {
    const content = await completeChat({
      maxTokens: 32,
      messages: [
        { role: "system", content: "你是连接测试助手，只返回 OK。" },
        { role: "user", content: "请返回 OK" },
      ],
      temperature: 0,
    });

    return NextResponse.json({ ok: true, content });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "模型连接测试失败。" },
      { status: 500 },
    );
  }
}
