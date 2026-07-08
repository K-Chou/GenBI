"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/AppShell";
import { ChatPanel } from "@/components/ChatPanel";
import { PreviewFrame } from "@/components/PreviewFrame";
import type { ArtifactManifest } from "@/lib/types";

export default function HomePage() {
  const [artifact, setArtifact] = useState<ArtifactManifest | null>(null);

  return (
    <AppShell>
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="grid h-full min-h-0 items-stretch gap-6 lg:grid-cols-[420px_1fr]"
        initial={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.25 }}
      >
        <div className="min-h-0 h-full">
          <ChatPanel onArtifact={setArtifact} />
        </div>
        <PreviewFrame artifact={artifact} />
      </motion.section>
    </AppShell>
  );
}
